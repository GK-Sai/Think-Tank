"""
The database, as SQLAlchemy 2.0 models.

Every table here exists because something in the React app reads it. The
shapes the API hands back are built in schemas.py; this file is only about
what is stored and how the rows hang together.

Two conventions worth knowing before you read on:

  * Ids are plain integers, matching the seed data the demo already used, so
    a link like /ideas/104 keeps working after the switch.
  * A description ("flowchart", "bulletPoints", "paragraph", "uploadFile")
    is stored whole, as JSONB, exactly as the editor produced it. The four
    editors live side by side in one object so switching tabs never destroys
    what was typed into another — see emptyDescription() in the frontend.
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Role(str, enum.Enum):
    chairman = "chairman"
    member = "member"


# The status words are the ones the UI prints and colours (see statusTagClass
# in lib/format.js), so they are stored as text rather than a PG enum — the
# chairman can be given a new one without a migration.
IDEA_STATUSES = ("Draft", "Under Review", "Approved", "In Progress", "On Hold", "Rejected")
TASK_STATUSES = ("In Progress", "Completed", "Re Assign", "On Hold")
PRIORITIES = ("High", "Medium", "Low")
DESCRIPTION_TYPES = ("flowchart", "bulletPoints", "paragraph", "uploadFile")


def empty_description() -> dict[str, Any]:
    """All four editors, side by side. Mirrors emptyDescription() in seed.js."""
    return {"flowchart": {"shapes": [], "links": []}, "bulletPoints": [""], "paragraph": "", "uploadFile": []}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))

    name: Mapped[str] = mapped_column(String(120))
    # `title` is the job title in the Role pill; `role` is what the API enforces.
    title: Mapped[str] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"), default=Role.member)
    dept: Mapped[str] = mapped_column(String(64))

    # The avatar is a (sex, variant) pair the frontend draws from; it travels
    # as the two-element list `av`.
    avatar_sex: Mapped[str] = mapped_column(String(10), default="male")
    avatar_variant: Mapped[int] = mapped_column(Integer, default=0)

    # Stamped on every authenticated request. "Online" means "was doing
    # something here a moment ago" rather than a socket being held open.
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ideas: Mapped[list["Idea"]] = relationship(
        back_populates="owner", foreign_keys="Idea.owner_id", lazy="raise",
    )


class Idea(Base):
    __tablename__ = "ideas"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    tagline: Mapped[str] = mapped_column(String(300), default="")
    purpose: Mapped[str] = mapped_column(Text, default="")
    dept: Mapped[Optional[str]] = mapped_column(String(64))
    tag: Mapped[Optional[str]] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="Under Review", index=True)

    # `created` is the calendar day the cards print; created_at is the instant.
    created: Mapped[date] = mapped_column(Date, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    implementation_date: Mapped[Optional[date]] = mapped_column(Date)
    from_log: Mapped[Optional[int]] = mapped_column(Integer)
    sample: Mapped[bool] = mapped_column(Boolean, default=False)

    description_type: Mapped[str] = mapped_column(String(20), default="paragraph")
    description_content: Mapped[dict] = mapped_column(JSONB, default=empty_description)

    # Everything the idea page needs is eager-loaded: async SQLAlchemy cannot
    # lazy-load an attribute on attribute access, so a missed relationship is
    # a runtime error rather than an extra query.
    owner: Mapped[User] = relationship(back_populates="ideas", foreign_keys=[owner_id], lazy="selectin")
    shares: Mapped[list["IdeaShare"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan", lazy="selectin"
    )
    revisions: Mapped[list["IdeaRevision"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan",
        order_by="IdeaRevision.id", lazy="selectin",
    )
    comments: Mapped[list["IdeaComment"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan",
        order_by="IdeaComment.id", lazy="selectin",
    )
    activity: Mapped[list["IdeaActivity"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan",
        order_by="IdeaActivity.created_at.desc()", lazy="selectin",
    )


class IdeaShare(Base):
    """The short list of people the chairman hands the project to."""

    __tablename__ = "idea_shares"
    __table_args__ = (UniqueConstraint("idea_id", "user_id", name="uq_idea_share"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    idea_id: Mapped[int] = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    idea: Mapped[Idea] = relationship(back_populates="shares")
    user: Mapped[User] = relationship(lazy="selectin")


class IdeaRevision(Base):
    """
    One saved version of the description.

    Each version keeps the description it *was* — type and content both — so
    the flowchart the chairman drew is still drawn as a flowchart after
    somebody edits it into a paragraph. `text` is the flattened, readable copy
    the history panel prints.
    """

    __tablename__ = "idea_revisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    idea_id: Mapped[int] = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    text: Mapped[str] = mapped_column(Text)
    description_type: Mapped[Optional[str]] = mapped_column(String(20))
    description_content: Mapped[Optional[dict]] = mapped_column(JSONB)

    idea: Mapped[Idea] = relationship(back_populates="revisions")
    author: Mapped[Optional[User]] = relationship(lazy="selectin")


class IdeaComment(Base):
    __tablename__ = "idea_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    idea_id: Mapped[int] = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    text: Mapped[str] = mapped_column(Text)
    # The original time stays; this is added so nobody can quietly rewrite
    # what they said an hour ago.
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    idea: Mapped[Idea] = relationship(back_populates="comments")
    author: Mapped[Optional[User]] = relationship(lazy="selectin")


class IdeaActivity(Base):
    """The idea's own change history, behind the clock icon on the detail page."""

    __tablename__ = "idea_activity"

    id: Mapped[int] = mapped_column(primary_key=True)
    idea_id: Mapped[int] = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    what: Mapped[str] = mapped_column(Text)

    idea: Mapped[Idea] = relationship(back_populates="activity")
    actor: Mapped[Optional[User]] = relationship(lazy="selectin")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    dept: Mapped[str] = mapped_column(String(64), default="Executive")

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    assigned_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    # Deleting an idea does not delete the work it produced — the task is cut
    # loose instead, which is what the mock did.
    idea_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ideas.id", ondelete="SET NULL"), index=True)
    log_id: Mapped[Optional[int]] = mapped_column(Integer)
    log_title: Mapped[str] = mapped_column(String(300), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Where the task sits on the calendar, as a real instant.
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    due: Mapped[date] = mapped_column(Date, index=True)

    status: Mapped[str] = mapped_column(String(32), default="In Progress", index=True)
    priority: Mapped[str] = mapped_column(String(16), default="Medium")

    owner: Mapped[User] = relationship(foreign_keys=[owner_id], lazy="selectin")
    assigned_by: Mapped[Optional[User]] = relationship(foreign_keys=[assigned_by_id], lazy="selectin")


class ThinkLog(Base):
    __tablename__ = "think_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    title: Mapped[str] = mapped_column(String(300), default="Untitled log")
    sample: Mapped[bool] = mapped_column(Boolean, default=False)

    owner: Mapped[User] = relationship(lazy="selectin")
    points: Mapped[list["ThinkLogPoint"]] = relationship(
        back_populates="log", cascade="all, delete-orphan",
        order_by="ThinkLogPoint.position", lazy="selectin",
    )


class ThinkLogPoint(Base):
    """
    A note, and what it has become.

    `states` is a list, not a single value: the chairman can send the same
    note to Tasks and to Ideas and both have to survive. Marking it a task
    used to overwrite the fact that it was already an idea.
    """

    __tablename__ = "think_log_points"

    id: Mapped[int] = mapped_column(primary_key=True)
    log_id: Mapped[int] = mapped_column(ForeignKey("think_logs.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text)
    states: Mapped[list] = mapped_column(JSONB, default=list)

    log: Mapped[ThinkLog] = relationship(back_populates="points")


class DmThread(Base):
    """
    One row per pair of people.

    The pair is stored sorted (user_a_id < user_b_id), which is what makes
    "find the thread between these two" a single indexed lookup either way
    round.
    """

    __tablename__ = "dm_threads"
    __table_args__ = (UniqueConstraint("user_a_id", "user_b_id", name="uq_dm_pair"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_a_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user_b_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    messages: Mapped[list["DmMessage"]] = relationship(
        back_populates="thread", cascade="all, delete-orphan",
        order_by="DmMessage.id", lazy="selectin",
    )


class DmMessage(Base):
    __tablename__ = "dm_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    thread_id: Mapped[int] = mapped_column(ForeignKey("dm_threads.id", ondelete="CASCADE"), index=True)
    from_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    thread: Mapped[DmThread] = relationship(back_populates="messages")


class Notification(Base):
    """
    One row per recipient.

    A notification is for something a person has to know about and would not
    otherwise see: a new idea, a task assigned to them, a project shared with
    them, a message. Everything else lives on the page it happened on. A bell
    that pings on every edit is a bell people stop reading.
    """

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notif_user_unread", "user_id", "unread"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    icon: Mapped[str] = mapped_column(String(24), default="idea")
    title: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    unread: Mapped[bool] = mapped_column(Boolean, default=True)
    reminder: Mapped[bool] = mapped_column(Boolean, default=False)
    link: Mapped[Optional[str]] = mapped_column(String(300))
