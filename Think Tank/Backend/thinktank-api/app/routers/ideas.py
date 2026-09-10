"""
Ideas — the board, and the discussion page behind each one.

Almost every endpoint here returns the *whole* idea rather than just the bit
that changed. That is deliberate and it is what the frontend expects: posting
a comment re-renders the page from one response, so there is never a moment
where the comment is on screen but the version trail below it is stale.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import (
    Idea,
    IdeaActivity,
    IdeaComment,
    IdeaRevision,
    IdeaShare,
    Role,
    Task,
    User,
)
from app.rules import (
    DEPT_TAG,
    can_comment_on_idea,
    can_edit_idea,
    can_see_idea,
    clip,
    describe,
    everyone_else,
    log_activity,
    notify,
    now,
    require_comment,
    require_edit,
    title_from,
)
from app.schemas import CommentIn, IdeaIn, IdeaPatchIn, RevisionIn, ShareIn, idea_out
from app.security import current_user

router = APIRouter(prefix="/api/ideas", tags=["ideas"])


# --- shared plumbing -----------------------------------------------------


async def _load(db: AsyncSession, idea_id: int, me: User) -> Idea:
    idea = await db.get(Idea, idea_id)
    if idea is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That idea no longer exists")
    if not can_see_idea(idea, me):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this idea")
    return idea


async def _assignments(db: AsyncSession, idea_id: int) -> list[Task]:
    rows = await db.execute(select(Task).where(Task.idea_id == idea_id).order_by(Task.id))
    return list(rows.scalars())


async def _render(db: AsyncSession, idea: Idea, me: User) -> dict:
    """Refresh, then serialise — so the response is what the database now holds."""
    await db.refresh(idea)
    return idea_out(
        idea,
        me,
        assignments=await _assignments(db, idea.id),
        can_comment=can_comment_on_idea(idea, me),
        can_edit=can_edit_idea(idea, me),
    )


# --- the board -----------------------------------------------------------


@router.get("")
async def list_ideas(
    me: User = Depends(current_user),
    db: AsyncSession = Depends(get_session),
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
):
    stmt = select(Idea).order_by(Idea.created_at.desc(), Idea.id.desc())
    if status_filter:
        stmt = stmt.where(Idea.status == status_filter)
    if q:
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(Idea.title.ilike(needle) | Idea.purpose.ilike(needle))

    rows = await db.execute(stmt)
    ideas = [i for i in rows.scalars() if can_see_idea(i, me)]

    # One query for every idea's tasks rather than one per idea.
    ids = [i.id for i in ideas]
    tasks_by_idea: dict[int, list[Task]] = {}
    if ids:
        task_rows = await db.execute(select(Task).where(Task.idea_id.in_(ids)).order_by(Task.id))
        for t in task_rows.scalars():
            tasks_by_idea.setdefault(t.idea_id, []).append(t)

    return [
        idea_out(
            i, me,
            assignments=tasks_by_idea.get(i.id, []),
            can_comment=can_comment_on_idea(i, me),
            can_edit=can_edit_idea(i, me),
        )
        for i in ideas
    ]


@router.get("/{idea_id}")
async def get_idea(idea_id: int, me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    idea = await _load(db, idea_id, me)
    return await _render(db, idea, me)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_idea(body: IdeaIn, me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    """
    The chairman opens an idea: a tagline, a purpose, a department and a
    description. Everyone is told, so they can come and answer.
    """
    if me.role != Role.chairman:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the chairman can open a new idea")

    at = now()
    idea_status = body.status or "Under Review"
    text = describe(body.description_type, body.description_content, body.purpose)

    idea = Idea(
        title=title_from(body.tagline),
        tagline=body.tagline,
        purpose=body.purpose,
        dept=body.dept,
        tag=body.tag or DEPT_TAG.get(body.dept or "", "Innovation"),
        status=idea_status,
        created=date.today(),
        created_at=at,
        updated_at=at,
        owner_id=me.id,
        from_log=body.from_log,
        description_type=body.description_type,
        description_content=body.description_content,
    )
    db.add(idea)
    await db.flush()                      # we need the id for the rows below

    shared_ids = [uid for uid in dict.fromkeys(body.shared_with) if uid != me.id]
    for uid in shared_ids:
        db.add(IdeaShare(idea_id=idea.id, user_id=uid))

    db.add(IdeaActivity(idea_id=idea.id, actor_id=me.id, created_at=at, what="created this idea"))
    db.add(IdeaRevision(
        idea_id=idea.id, author_id=me.id, created_at=at, text=text,
        # Each version keeps the description it *was*, so the flowchart the
        # chairman drew is still drawable after somebody edits it.
        description_type=body.description_type,
        description_content=body.description_content,
    ))

    # Everyone. A Draft is announced to nobody.
    if idea_status != "Draft":
        notify(db, user_ids=await everyone_else(db, me), icon="idea",
               title=f"New idea: {clip(idea.title)}", link=f"/ideas/{idea.id}")

        # The people named on the way in are carrying it, not just reading it,
        # and the dialog that named them says they are told so. Without this
        # second line they got the same "new idea" everybody got.
        if shared_ids:
            rows = await db.execute(select(User).where(User.id.in_(shared_ids)))
            names = [u.name for u in rows.scalars()]
            if names:
                log_activity(db, idea, me, f"shared this project with {', '.join(names)}")
            notify(db, user_ids=shared_ids, icon="ok",
                   title=f"Shared with you: {clip(idea.title)}", link=f"/ideas/{idea.id}")

    await db.commit()
    return await _render(db, idea, me)


@router.put("/{idea_id}")
async def update_idea(
    idea_id: int, body: IdeaIn,
    me: User = Depends(current_user), db: AsyncSession = Depends(get_session),
):
    """The full editor — tagline, purpose, department, description."""
    idea = await _load(db, idea_id, me)
    require_edit(idea, me)

    was_draft = idea.status == "Draft"
    dept_changed = bool(body.dept and body.dept != idea.dept)

    idea.title = title_from(body.tagline)
    idea.tagline = body.tagline
    idea.purpose = body.purpose
    idea.dept = body.dept or idea.dept
    idea.tag = body.tag or DEPT_TAG.get(body.dept or "", idea.tag)
    idea.status = body.status or idea.status
    idea.description_type = body.description_type
    idea.description_content = body.description_content

    if idea.status == "Draft":
        log_activity(db, idea, me, "updated this draft")
    elif was_draft:
        # It has just been published — this is the moment the company hears
        # about it, not the moment the row was first written.
        log_activity(db, idea, me, "created this idea")
        notify(db, user_ids=await everyone_else(db, me), icon="idea",
               title=f"New idea: {clip(idea.title)}", link=f"/ideas/{idea.id}")
    else:
        log_activity(db, idea, me,
                     f"moved this idea to {idea.dept}" if dept_changed else "updated the idea")

    await db.commit()
    return await _render(db, idea, me)


@router.delete("/{idea_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_idea(idea_id: int, me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    idea = await _load(db, idea_id, me)
    if me.role != Role.chairman and idea.owner_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own ideas")

    # The work an idea produced outlives the idea: tasks are cut loose rather
    # than deleted with it (the FK is ON DELETE SET NULL).
    await db.delete(idea)
    await db.commit()
    return None


# --- the discussion page -------------------------------------------------


@router.post("/{idea_id}/revisions")
async def add_revision(
    idea_id: int, body: RevisionIn,
    me: User = Depends(current_user), db: AsyncSession = Depends(get_session),
):
    """
    Save a new version of the description.

    Takes the description in whatever shape it was written — the flowchart's
    shapes and links, the bullet list, the paragraph, the file list — and
    stores that, so an edited flowchart is shown as the edited flowchart
    rather than reverting to the drawing it started as. A flattened text copy
    goes into the revision trail alongside it, because a history only ever
    needs to be readable.

    A bare `text` is still accepted, which is what the old text-only editor
    sent.
    """
    idea = await _load(db, idea_id, me)
    require_edit(idea, me)

    as_text = body.description_content is None and body.text is not None
    if as_text:
        d_type = idea.description_type
        content = {**(idea.description_content or {}), "paragraph": body.text}
        text = (body.text or "").strip()
    else:
        d_type = body.description_type or idea.description_type
        content = body.description_content
        if not content:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "There is nothing to save")
        text = describe(d_type, content, idea.purpose)

    if not (text or "").strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The description cannot be empty")

    # Freeze the description onto the version it belongs to before a newer one
    # arrives. Without this, a version saved without a snapshot of its own
    # turns into plain text the moment somebody edits after it — the
    # chairman's original flowchart would stop being a flowchart.
    if idea.revisions:
        previous = idea.revisions[-1]
        if not previous.description_type:
            previous.description_type = idea.description_type
            previous.description_content = idea.description_content

    # The stored description is replaced, not just the text summary, so every
    # reader sees the new version.
    idea.description_type = d_type
    idea.description_content = content

    db.add(IdeaRevision(
        idea_id=idea.id, author_id=me.id, created_at=now(), text=text.strip(),
        description_type=d_type, description_content=content,
    ))
    log_activity(db, idea, me, "edited the idea")

    await db.commit()
    return await _render(db, idea, me)


@router.post("/{idea_id}/comments")
async def add_comment(
    idea_id: int, body: CommentIn,
    me: User = Depends(current_user), db: AsyncSession = Depends(get_session),
):
    idea = await _load(db, idea_id, me)
    require_comment(idea, me)

    clean = (body.text or "").strip()
    if not clean:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Write something first")

    at = now()
    db.add(IdeaComment(idea_id=idea.id, author_id=me.id, created_at=at, text=clean))
    idea.updated_at = at

    await db.commit()
    return await _render(db, idea, me)


@router.patch("/{idea_id}/comments/{comment_id}")
async def edit_comment(
    idea_id: int, comment_id: int, body: CommentIn,
    me: User = Depends(current_user), db: AsyncSession = Depends(get_session),
):
    """
    Edit your own message. The original time stays and an `edited_at` is
    added, so nobody can quietly rewrite what they said an hour ago.
    """
    idea = await _load(db, idea_id, me)
    require_comment(idea, me)

    comment = await db.get(IdeaComment, comment_id)
    if comment is None or comment.idea_id != idea.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That message no longer exists")
    if comment.author_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own messages")

    clean = (body.text or "").strip()
    if not clean:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A message cannot be empty")

    comment.text = clean
    comment.edited_at = now()
    idea.updated_at = comment.edited_at

    await db.commit()
    return await _render(db, idea, me)


@router.delete("/{idea_id}/comments/{comment_id}")
async def remove_comment(
    idea_id: int, comment_id: int,
    me: User = Depends(current_user), db: AsyncSession = Depends(get_session),
):
    idea = await _load(db, idea_id, me)

    comment = await db.get(IdeaComment, comment_id)
    if comment is None or comment.idea_id != idea.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That comment no longer exists")
    if comment.author_id != me.id and me.role != Role.chairman:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own comments")

    await db.delete(comment)
    await db.commit()
    return await _render(db, idea, me)


@router.post("/{idea_id}/share")
async def share_idea(
    idea_id: int, body: ShareIn,
    me: User = Depends(current_user), db: AsyncSession = Depends(get_session),
):
    """
    Hand the project to the people who will carry it.

    The chairman's second closing move, beside choosing the department: a
    short list of the team members most connected to the work. They are told
    directly, and they are named on the idea page so everyone can see who
    picked it up.
    """
    if me.role != Role.chairman:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the chairman can share a project")

    idea = await _load(db, idea_id, me)
    before = {s.user_id for s in idea.shares}
    wanted = {uid for uid in body.member_ids if uid != me.id}

    for share in list(idea.shares):
        if share.user_id not in wanted:
            await db.delete(share)
    for uid in wanted - before:
        db.add(IdeaShare(idea_id=idea.id, user_id=uid))

    added = sorted(wanted - before)
    if added:
        rows = await db.execute(select(User).where(User.id.in_(added)))
        names = [u.name for u in rows.scalars()]
        log_activity(db, idea, me, f"shared this project with {', '.join(names)}")
        notify(db, user_ids=added, icon="ok",
               title=f"Shared with you: {clip(idea.title)}", link=f"/ideas/{idea.id}")
    else:
        idea.updated_at = now()

    await db.commit()
    return await _render(db, idea, me)


@router.patch("/{idea_id}")
async def patch_idea(
    idea_id: int, body: IdeaPatchIn,
    me: User = Depends(current_user), db: AsyncSession = Depends(get_session),
):
    """
    The two decisions that are the chairman's alone: the implementation date
    and the status. The frontend sends one or the other, never both.
    """
    if me.role != Role.chairman:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the chairman can make that change")

    idea = await _load(db, idea_id, me)
    fields = body.model_dump(exclude_unset=True)

    if "implementation_date" in fields:
        d = fields["implementation_date"]
        idea.implementation_date = d
        # Scheduling an idea is the decision to do it, so it stops being a
        # draft or a review item at the same moment.
        if d and idea.status in ("Under Review", "Draft"):
            idea.status = "Approved"
        log_activity(db, idea, me,
                     f"set the implementation date to {d}" if d else "cleared the implementation date")

    if "status" in fields and fields["status"]:
        idea.status = fields["status"]
        log_activity(db, idea, me, f"set the status to {idea.status}")

    await db.commit()
    return await _render(db, idea, me)
