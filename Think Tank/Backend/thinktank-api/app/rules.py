"""
The rules the app runs on.

These are lifted from the comments at the top of src/lib/mockApi.js, which is
the specification the React screens were built against. They live here rather
than inside the routers so there is one place to read them, and one place to
change them.

The life of an idea
-------------------
1. The chairman writes it — a tagline, a purpose, a department, and a
   description in whichever editor suits it.
2. Every team member is notified and comes to the discussion page. Everyone
   posts, and everyone may edit the idea's text; each edit is a new version
   stamped with who wrote it and when.
3. The chairman sets the implementation date and shares the project with the
   people who will carry it. The discussion stays open throughout.

SEEING an idea       Once an idea leaves Draft it is visible to the whole
                     organisation. A Draft belongs to its author alone.
POSTING on an idea   Everybody, for as long as the idea exists.
CHAIRMAN ONLY        Creating an idea, setting the implementation date,
                     sharing the project, assigning tasks, changing status,
                     and the think log's Add to Idea / Add to Task.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Idea, IdeaActivity, Notification, Role, User

CHAIR_LABEL = "Chairman"

# A sensible Category/Tag per department, applied when an idea is created.
# Mirrors DEPT_TAG in src/data/seed.js.
DEPT_TAG = {
    "I.T Department": "Technology",
    "Loans": "Lending",
    "Insurance": "Risk",
    "Deposits": "Deposits",
    "Recovery": "Collections",
    "Accounts": "Cost Saving",
    "Marketing": "Marketing",
    "Sales": "Market Expansion",
    "Operations": "Process",
    "HR": "People",
    "Legal": "Compliance",
    "Admin": "Administration",
}


def now() -> datetime:
    return datetime.now(timezone.utc)


def actor_label(u: User) -> str:
    """What to call the actor in a notification line."""
    return CHAIR_LABEL if u.role == Role.chairman else u.name


def clip(text: str, limit: int = 42) -> str:
    """
    A notification is a line you scan in a list, not something you read.
    Long titles get cut rather than allowed to wrap into a paragraph.
    """
    t = (text or "").strip()
    return t if len(t) <= limit else t[: limit - 1].rstrip() + "…"


def title_from(tagline: str | None) -> str:
    return (tagline or "Untitled idea").strip() or "Untitled idea"


# --- visibility ----------------------------------------------------------


def can_see_idea(idea: Idea, me: User) -> bool:
    """A Draft is private to its author; anything published is org-wide."""
    return me.role == Role.chairman or idea.owner_id == me.id or idea.status != "Draft"


def can_comment_on_idea(idea: Idea, me: User) -> bool:
    """
    Who may post.

    While the discussion is open: everybody, chairman and team member alike —
    it is one room, and the point of telling the whole company about an idea
    is that the whole company can answer.
    """
    if idea.status == "Draft":
        return idea.owner_id == me.id or me.role == Role.chairman
    return True


def can_edit_idea(idea: Idea, me: User) -> bool:
    """
    Editing the idea's own text is the room's too: anyone in the discussion
    may sharpen the wording, and the signed version trail keeps it honest.
    """
    if idea.status == "Draft":
        return idea.owner_id == me.id or me.role == Role.chairman
    return True


def require_comment(idea: Idea, me: User) -> None:
    if not can_comment_on_idea(idea, me):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot post on this idea")


def require_edit(idea: Idea, me: User) -> None:
    if not can_edit_idea(idea, me):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot edit this idea")


# --- notifications -------------------------------------------------------


async def everyone_else(db: AsyncSession, me: User) -> list[int]:
    """Everyone with an account, minus whoever caused the change."""
    rows = await db.execute(select(User.id).where(User.id != me.id))
    return list(rows.scalars())


async def member_ids_of_depts(db: AsyncSession, dept_names: Iterable[str]) -> list[int]:
    names = [d for d in dept_names if d]
    if not names:
        return []
    rows = await db.execute(select(User.id).where(User.dept.in_(names)))
    return list(rows.scalars())


def notify(
    db: AsyncSession,
    *,
    user_ids: Iterable[int],
    title: str,
    icon: str = "idea",
    reminder: bool = False,
    link: str | None = None,
) -> datetime:
    """
    One notification per recipient, all stamped with the same instant so the
    line reads identically for everyone.

    Deliberately narrow. A bell that pings on every edit, every comment and
    every status change is a bell people stop reading, and then the one
    message that mattered goes past unnoticed. So a notification is only for
    something a person has to know about and would not otherwise see:

      · the chairman has opened a new idea       (everyone)
      · a task has been assigned to you          (the assignee)
      · a project has been shared with you       (the person named)
      · somebody has sent you a message          (the recipient)

    Everything else lives on the page it happened on — the change history
    behind the clock icon, and the discussion itself.
    """
    at = now()
    for uid in dict.fromkeys(user_ids):          # de-duplicated, order kept
        db.add(Notification(user_id=uid, icon=icon, title=title, created_at=at,
                            unread=True, reminder=reminder, link=link))
    return at


def log_activity(db: AsyncSession, idea: Idea, me: User, what: str) -> None:
    """
    Records what changed on the idea itself, so the page carries its own
    history rather than relying on somebody still having the notification.
    """
    at = now()
    db.add(IdeaActivity(idea_id=idea.id, actor_id=me.id, created_at=at, what=what))
    idea.updated_at = at


# --- descriptions --------------------------------------------------------


def describe(description_type: str | None, content: dict[str, Any] | None, fallback: str = "") -> str:
    """
    Flattens whichever description editor is active into plain text.

    The revision trail on the detail page is text, whatever the source — a
    history only ever needs to be readable. The structured version is stored
    alongside it so the flowchart is still drawn as a flowchart.
    """
    c = content or {}
    if description_type == "paragraph":
        return (c.get("paragraph") or fallback or "").strip()
    if description_type == "bulletPoints":
        return "\n".join(b.strip() for b in (c.get("bulletPoints") or []) if b and b.strip())
    if description_type == "uploadFile":
        names = ", ".join(f.get("name", "") for f in (c.get("uploadFile") or []) if f.get("name"))
        return names or fallback
    shapes = ((c.get("flowchart") or {}).get("shapes")) or []
    return " → ".join(s.get("label", "") for s in shapes) or fallback
