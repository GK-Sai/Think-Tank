"""
Tasks — the list, the calendar, and the numbers on the dashboard.

Two kinds of thing come back from `GET /api/tasks`: real task rows, and
implementation milestones derived from ideas. See `milestone_out` for why the
second kind is computed rather than stored.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Idea, Role, Task, User
from app.rules import clip, log_activity, member_ids_of_depts, notify, now
from app.schemas import APP_TZ, TaskIn, TaskPatchIn, milestone_out, task_out
from app.security import current_user

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


async def _visible(db: AsyncSession, me: User) -> list[Task]:
    """The chairman sees the whole board; everyone else sees their own work."""
    stmt = select(Task).order_by(Task.id)
    if me.role != Role.chairman:
        stmt = stmt.where(Task.owner_id == me.id)
    rows = await db.execute(stmt)
    return list(rows.scalars())


@router.get("")
async def list_tasks(me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    tasks = await _visible(db, me)

    # Every published idea with a date, on everybody's calendar. A date the
    # chairman has set is the company's deadline, not a private note to the
    # two people carrying it — if it is on the calendar at all it has to be on
    # the same day for everyone.
    rows = await db.execute(
        select(Idea).where(Idea.implementation_date.is_not(None), Idea.status != "Draft")
    )
    milestones = [milestone_out(i, me) for i in rows.scalars()]

    return [task_out(t) for t in tasks] + milestones


@router.get("/stats")
async def task_stats(me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    tasks = await _visible(db, me)
    today = date.today()
    done = sum(1 for t in tasks if t.status == "Completed")
    # A task is overdue the moment its due date passes, whatever it was saved
    # as — the same rule effStatus() applies in the browser.
    overdue = sum(1 for t in tasks if t.status != "Completed" and t.due < today)
    return {"total": len(tasks), "completed": done, "overdue": overdue, "pending": len(tasks) - done}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_tasks(body: TaskIn, me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    """
    Assign work.

    `member_ids` names people directly; `dept_names` hands the same task to a
    whole department. One row is written per person, so each of them owns
    their copy and can move it to Completed without touching anybody else's.

    `idea_id` ties the task back to the idea it came from, which is what puts
    it on that idea's page; `log_id` / `log_title` carry the think-log line it
    started life as.
    """
    if me.role != Role.chairman:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the chairman can assign tasks")

    targets = list(dict.fromkeys(
        [*body.member_ids, *await member_ids_of_depts(db, body.dept_names)]
    ))
    targets = [t for t in targets if t != me.id]
    if not targets:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pick at least one person or department")

    at = now()
    start = body.start_at or at
    if start.tzinfo is None:
        start = start.replace(tzinfo=APP_TZ)

    owners = await db.execute(select(User).where(User.id.in_(targets)))
    owner_by_id = {u.id: u for u in owners.scalars()}

    created: list[Task] = []
    for uid in targets:
        owner = owner_by_id.get(uid)
        if owner is None:
            continue
        task = Task(
            title=body.title,
            description=body.description or "",
            dept=owner.dept or "Executive",       # a task's department follows its owner
            owner_id=uid,
            assigned_by_id=me.id,
            idea_id=body.idea_id,
            log_id=body.log_id,
            log_title=body.log_title or "",
            created_at=at,
            start_at=start,
            due=body.due or date.today(),
            status="In Progress",
            priority=body.priority or "Medium",
        )
        db.add(task)
        created.append(task)

    notify(db, user_ids=[t.owner_id for t in created], icon="task",
           title=f"New task: {clip(body.title)}", link="/tasks")

    if body.idea_id:
        idea = await db.get(Idea, body.idea_id)
        if idea:
            who = ", ".join(body.dept_names) if body.dept_names else ", ".join(
                owner_by_id[u].name for u in targets if u in owner_by_id
            )
            log_activity(db, idea, me, f"assigned “{body.title}” to {who}")

    await db.commit()
    for t in created:
        await db.refresh(t)
    return [task_out(t) for t in created]


@router.patch("/{task_id}")
async def update_task(
    task_id: str, body: TaskPatchIn,
    me: User = Depends(current_user), db: AsyncSession = Depends(get_session),
):
    # A milestone is derived from its idea, so there is nothing here to edit.
    if task_id.startswith("impl-"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "An implementation date is changed on the idea, not here",
        )
    if not task_id.isdigit():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That task no longer exists")

    task = await db.get(Task, int(task_id))
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That task no longer exists")
    # Your own work is yours to move; the chairman can move anybody's.
    if me.role != Role.chairman and task.owner_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only change your own tasks")

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "start_at" and value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=APP_TZ)
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task_out(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_task(
    task_id: str,
    me: User = Depends(current_user), db: AsyncSession = Depends(get_session),
):
    if task_id.startswith("impl-"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "An implementation date is cleared on the idea, not here",
        )
    if not task_id.isdigit():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That task no longer exists")

    task = await db.get(Task, int(task_id))
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That task no longer exists")
    if me.role != Role.chairman and task.owner_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own tasks")

    await db.delete(task)
    await db.commit()
    return None
