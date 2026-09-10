"""
What goes out, and what is allowed in.

The frontend has adapters (toIdea, toTask, toMember … in src/lib/httpApi.js)
that translate this API's snake_case into the flat camelCase the React
components were written against. Those adapters are the contract: every key
built here exists because one of them reads it. Change a name and a screen
goes blank, so the serializers below are written out longhand rather than
generated, and each one sits next to the adapter it feeds.

Timestamps go out in the organisation's own timezone, with the offset
attached ("2026-09-04T10:00:00+05:30"). That matters for one specific reason:
the task adapter derives a calendar day with `start_at.slice(0, 10)`, so a
task at 10am on the 4th has to *say* the 4th, not the 3rd in UTC.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

from app.config import settings
from app.models import (
    DmMessage,
    DmThread,
    Idea,
    IdeaActivity,
    IdeaComment,
    IdeaRevision,
    Notification,
    Role,
    Task,
    ThinkLog,
    User,
)

APP_TZ = ZoneInfo("Asia/Kolkata")


# --- little helpers ------------------------------------------------------


def iso(value: Optional[datetime]) -> Optional[str]:
    """An instant, in the organisation's timezone, with its offset."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(APP_TZ).isoformat()


def ymd(value: Optional[date]) -> Optional[str]:
    return value.isoformat() if value else None


def clock(value: Optional[datetime]) -> str:
    """"10:00 AM" — the label the calendar prints beside a task."""
    if value is None:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    local = value.astimezone(APP_TZ)
    return local.strftime("%I:%M %p")


def is_online(user: Optional[User]) -> bool:
    if user is None or user.last_seen_at is None:
        return False
    seen = user.last_seen_at
    if seen.tzinfo is None:
        seen = seen.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - seen < timedelta(seconds=settings.online_window_seconds)


# --- users ---------------------------------------------------------------


def public_user(u: Optional[User]) -> Optional[dict[str, Any]]:
    """
    A person, as everyone else may see them.

    Deliberately built field by field: the password hash must never leave
    here, and a `**u.__dict__` would eventually let it.
    """
    if u is None:
        return None
    return {
        "id": u.id,
        "name": u.name,
        "title": u.title,
        "role": u.role.value if isinstance(u.role, Role) else u.role,
        "dept": u.dept,
        "email": u.email,
        "av": [u.avatar_sex, u.avatar_variant],
        "label": "Chairman" if u.role == Role.chairman else u.title,
        "online": is_online(u),
        "last_seen_at": iso(u.last_seen_at),
    }


# `toMember` reads exactly these keys, so the member list is the same object.
member_out = public_user


# --- ideas ---------------------------------------------------------------


def revision_out(r: IdeaRevision, idea: Idea, is_last: bool) -> dict[str, Any]:
    return {
        "id": r.id,
        "author": public_user(r.author),
        "created_at": iso(r.created_at),
        "text": r.text,
        # Rows written before versions carried their own snapshot: the last one
        # is by definition what the idea holds now, so it can borrow it.
        "description_type": r.description_type or (idea.description_type if is_last else None),
        "description_content": r.description_content or (idea.description_content if is_last else None),
    }


def comment_out(c: IdeaComment) -> dict[str, Any]:
    return {
        "id": c.id,
        "author": public_user(c.author),
        "created_at": iso(c.created_at),
        "edited_at": iso(c.edited_at),
        "text": c.text,
    }


def activity_out(a: IdeaActivity) -> dict[str, Any]:
    return {
        "id": a.id,
        "actor": public_user(a.actor),
        "created_at": iso(a.created_at),
        "what": a.what,
    }


def idea_out(
    idea: Idea,
    me: User,
    *,
    assignments: list[Task] | None = None,
    can_comment: bool = False,
    can_edit: bool = False,
) -> dict[str, Any]:
    revisions = list(idea.revisions)
    last_index = len(revisions) - 1
    return {
        "id": idea.id,
        "title": idea.title,
        "tagline": idea.tagline,
        "purpose": idea.purpose,
        "dept": idea.dept,
        "tag": idea.tag,
        "status": idea.status,
        "created": ymd(idea.created),
        "created_at": iso(idea.created_at),
        "updated_at": iso(idea.updated_at),
        "owner": public_user(idea.owner),
        "shared_with": [public_user(s.user) for s in idea.shares if s.user],
        "implementation_date": ymd(idea.implementation_date),
        "from_log": idea.from_log,
        "sample": idea.sample,
        # Worked out here rather than in the browser, so the rule lives in one
        # place and the API is the thing that decides.
        "can_comment": can_comment,
        "can_edit_idea": can_edit,
        "description_type": idea.description_type,
        "description_content": idea.description_content,
        "activity": [activity_out(a) for a in idea.activity],
        "assignments": [task_out(t) for t in (assignments or [])],
        "revisions": [revision_out(r, idea, i == last_index) for i, r in enumerate(revisions)],
        "comments": [comment_out(c) for c in idea.comments],
    }


# --- tasks ---------------------------------------------------------------


def task_out(t: Task) -> dict[str, Any]:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "dept": t.dept,
        "owner": public_user(t.owner),
        "assigned_by": public_user(t.assigned_by),
        "idea_id": t.idea_id,
        "log_id": t.log_id,
        "log_title": t.log_title,
        "start_at": iso(t.start_at),
        "created_at": iso(t.created_at),
        "time": clock(t.start_at),
        "due": ymd(t.due),
        "status": t.status,
        "priority": t.priority,
    }


def milestone_out(idea: Idea, me: User) -> dict[str, Any]:
    """
    An implementation date, as a calendar entry.

    Worked out from the idea every time the calendar is read rather than
    copied into a task row per person — two records to keep in step, and one
    of them silently wrong the moment the date moves. The string id is what
    stops anything mistaking it for a real, editable task.
    """
    start = datetime.combine(idea.implementation_date, datetime.min.time(), tzinfo=APP_TZ).replace(hour=9)
    return {
        "id": f"impl-{idea.id}",
        "milestone": True,
        "idea_id": idea.id,
        "title": f"{idea.title} — implementation",
        "description": idea.purpose or "",
        "dept": idea.dept or "",
        "owner": public_user(me),
        "assigned_by": public_user(idea.owner),
        "log_id": None,
        "log_title": "",
        "created_at": iso(idea.updated_at or idea.created_at),
        "start_at": start.isoformat(),
        "time": clock(start),
        "due": ymd(idea.implementation_date),
        "status": "In Progress",
        "priority": "High",
    }


# --- think logs ----------------------------------------------------------


def log_out(l: ThinkLog) -> dict[str, Any]:
    return {
        "id": l.id,
        "date": ymd(l.date),
        "created_at": iso(l.created_at),
        "title": l.title,
        "owner": public_user(l.owner),
        "sample": l.sample,
        "points": [{"id": p.id, "text": p.text, "states": list(p.states or [])} for p in l.points],
    }


# --- messages ------------------------------------------------------------


def message_out(m: DmMessage, me_id: int) -> dict[str, Any]:
    return {
        "id": m.id,
        "from": {"id": m.from_id},
        "mine": m.from_id == me_id,
        "text": m.text,
        "created_at": iso(m.created_at),
    }


def thread_out(t: Optional[DmThread], other: User, me: User, *, with_messages: bool) -> dict[str, Any]:
    messages = list(t.messages) if t else []
    last = messages[-1] if messages else None
    return {
        "with": public_user(other),
        "last_text": last.text if last else "",
        # Who spoke last, so the list can say "You: …" the way every messaging
        # app does.
        "last_mine": bool(last and last.from_id == me.id),
        "last_at": iso(last.created_at) if last else None,
        "unread": sum(1 for m in messages if m.from_id != me.id and m.read_at is None),
        "messages": [message_out(m, me.id) for m in messages] if with_messages else [],
    }


# --- notifications -------------------------------------------------------


def notif_out(n: Notification) -> dict[str, Any]:
    return {
        "id": n.id,
        "icon": n.icon,
        "title": n.title,
        # A real instant, rendered in the reader's own clock. The API no
        # longer decides what "Today" means for somebody else.
        "created_at": iso(n.created_at),
        "link": n.link,
        "unread": n.unread,
        "reminder": n.reminder,
    }


# =========================================================================
#  Request bodies
# =========================================================================


class LoginIn(BaseModel):
    username: str
    password: str


class InviteIn(BaseModel):
    name: str
    email: str
    dept: str
    role: str                     # the job title
    avatar_sex: str = "male"
    avatar_variant: int = 0


class MemberPatchIn(BaseModel):
    name: Optional[str] = None
    dept: Optional[str] = None
    role: Optional[str] = None    # the job title, again


class IdeaIn(BaseModel):
    tagline: str
    purpose: str = ""
    dept: Optional[str] = None
    status: Optional[str] = None
    tag: Optional[str] = None
    description_type: str = "paragraph"
    description_content: dict[str, Any] = Field(default_factory=dict)
    shared_with: list[int] = Field(default_factory=list)
    from_log: Optional[int] = None


class IdeaPatchIn(BaseModel):
    """PATCH /api/ideas/{id} carries one decision at a time."""

    status: Optional[str] = None
    implementation_date: Optional[date] = None


class RevisionIn(BaseModel):
    """
    A new version of the description.

    Either the description itself (type + content), or a bare `text`, which is
    what the older text-only editor sent.
    """

    text: Optional[str] = None
    description_type: Optional[str] = None
    description_content: Optional[dict[str, Any]] = None


class CommentIn(BaseModel):
    text: str


class ShareIn(BaseModel):
    member_ids: list[int] = Field(default_factory=list)


class TaskIn(BaseModel):
    title: str
    description: str = ""
    due: Optional[date] = None
    priority: str = "Medium"
    # `member_ids` names people; `dept_names` hands the same task to a whole
    # department. Either or both.
    member_ids: list[int] = Field(default_factory=list)
    dept_names: list[str] = Field(default_factory=list)
    idea_id: Optional[int] = None
    log_id: Optional[int] = None
    log_title: str = ""
    start_at: Optional[datetime] = None


class TaskPatchIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due: Optional[date] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    start_at: Optional[datetime] = None


class PointIn(BaseModel):
    text: str
    states: list[str] = Field(default_factory=list)


class ThinkLogIn(BaseModel):
    points: list[PointIn]
    title: Optional[str] = None


class PointPatchIn(BaseModel):
    text: Optional[str] = None


class MessageIn(BaseModel):
    text: str


PointState = Literal["idea", "task"]
