"""
The demo data, ported from src/lib/mockDb.js.

Run it once the tables exist:

    python seed.py

It wipes the tables it owns and writes them again, so it is safe to re-run
while you are still setting things up — and destructive once real data is in
there, which is why it refuses unless you pass --force or the database is
empty.

Everything is dated relative to today, exactly as the demo was: the board
always looks like a board somebody has been using for three weeks, with
overdue work on it, rather than a page of rows all stamped with the day you
happened to install it.
"""

from __future__ import annotations

import asyncio
import sys
from datetime import date, datetime, timedelta

from sqlalchemy import func, select, text
from zoneinfo import ZoneInfo

from app.db import SessionLocal
from app.models import (
    DmMessage,
    DmThread,
    Idea,
    IdeaActivity,
    IdeaComment,
    IdeaRevision,
    IdeaShare,
    Notification,
    Role,
    Task,
    ThinkLog,
    ThinkLogPoint,
    User,
    empty_description,
)
from app.security import hash_password

TZ = ZoneInfo("Asia/Kolkata")
TODAY = date.today()


def day(offset: int) -> date:
    return TODAY + timedelta(days=offset)


def stamp(offset: int, hour: int, minute: int) -> datetime:
    return datetime.combine(day(offset), datetime.min.time(), tzinfo=TZ).replace(
        hour=hour, minute=minute
    )


def para(t: str) -> dict:
    return {**empty_description(), "paragraph": t}


def bullets(items: list[str]) -> dict:
    return {**empty_description(), "bulletPoints": items}


# --------------------------------------------------------------------------
#  accounts
#
#  Exactly the credentials the sign-in screen advertises: the chairman is
#  `chairman` / `gk`, every team member uses `tt123`. Change them the day this
#  stops being a demo — and change SECRET_KEY with them.
# --------------------------------------------------------------------------

USERS = [
    (1, "chairman", "gk",    "G. Krishna",    "Chairman",            Role.chairman, "Executive",      "chairman@thinktank.co", "male",   3),
    (2, "priya",    "tt123", "Priya Iyer",    "Head of Finance",     Role.member,   "Accounts",       "priya@thinktank.co",    "female", 0),
    (3, "meera",    "tt123", "Meera Nair",    "Operations Lead",     Role.member,   "Operations",     "meera@thinktank.co",    "female", 1),
    (4, "ananya",   "tt123", "Ananya Rao",    "Engineering Manager", Role.member,   "I.T Department", "ananya@thinktank.co",   "female", 2),
    (5, "rohit",    "tt123", "Rohit Sharma",  "Marketing Lead",      Role.member,   "Marketing",      "rohit@thinktank.co",    "male",   4),
    (6, "sana",     "tt123", "Sana Fatima",   "Product Manager",     Role.member,   "I.T Department", "sana@thinktank.co",     "female", 4),
    (7, "vikram",   "tt123", "Vikram Shetty", "Operations Manager",  Role.member,   "Operations",     "vikram@thinktank.co",   "male",   5),
    (8, "karthik",  "tt123", "Karthik Menon", "HR Business Partner", Role.member,   "HR",             "karthik@thinktank.co",  "male",   1),
]

FLOWCHART_106 = {
    **empty_description(),
    "flowchart": {
        "shapes": [
            {"id": 1, "label": "Branch enters closing cash", "x": 40, "y": 40,  "w": 170, "h": 60, "type": "process"},
            {"id": 2, "label": "Nightly roll-up job",        "x": 40, "y": 150, "w": 170, "h": 60, "type": "process"},
            {"id": 3, "label": "Regional dashboard",         "x": 40, "y": 260, "w": 170, "h": 60, "type": "process"},
        ],
        # The last step goes back to the first — a return arrow, routed round
        # the side rather than back up through the steps.
        "links": [{"from": 1, "to": 2}, {"from": 2, "to": 3}, {"from": 3, "to": 1, "back": True}],
    },
}

BULLETS_102 = [
    "Open a two-hour Saturday counter at the three busiest branches.",
    "Staff it on rotation so no one works more than one weekend a month.",
    "Pre-approve documents online so the counter visit is signature only.",
    "Review footfall after eight weeks before expanding.",
]

BULLETS_105 = [
    "One afternoon a quarter, each department demos what it built.",
    "Twenty minutes per team, no slides longer than five pages.",
    "Rotate the host department so the load is shared.",
]

# --------------------------------------------------------------------------
#  ideas
#
#  `revisions` is what drives the Created By / Edited By blocks on the detail
#  page: entry 0 is the original, each edit appends one. `shared_with` is the
#  short list of people the chairman handed the project to.
# --------------------------------------------------------------------------

IDEAS = [
    dict(
        id=101,
        title="Enhance User Onboarding with Interactive Tutorials",
        purpose="New joiners drop off in the first week because nothing walks them through the platform. Guided tutorials would close that gap.",
        dept="I.T Department", tag="Technology", status="Under Review",
        created=day(-6), created_at=stamp(-6, 10, 12), updated_at=stamp(-1, 16, 5),
        shared_with=[], implementation_date=None,
        description_type="paragraph",
        description_content=para(
            "Develop a series of interactive tutorials that guide new users through the key features of the Think Tank platform. These tutorials should be engaging, visually appealing, and provide step-by-step instructions to ensure users can quickly and effectively utilize the platform’s capabilities. Include progress tracking and the ability to revisit tutorials at any time."
        ),
        revisions=[
            (1, stamp(-6, 10, 12), "Develop a series of interactive tutorials that guide new users through the key features of the Think Tank platform, with step-by-step instructions so people can use it properly in their first week.", "paragraph"),
            # A team member sharpened the chairman's wording — the
            # collaborative edit the discussion page is built around.
            (4, stamp(-4, 15, 20), "Develop a series of interactive tutorials that guide new users through the key features of the Think Tank platform. These tutorials should be engaging, visually appealing, and provide step-by-step instructions to ensure users can quickly and effectively utilize the platform’s capabilities. Include progress tracking and the ability to revisit tutorials at any time.", "paragraph"),
        ],
        comments=[
            (6, stamp(-5, 11, 48), "This is a great idea. Interactive tutorials would lift engagement a lot, especially for the branch staff who only use us twice a week."),
            (4, stamp(-4, 15, 22), "I have added progress tracking and the ability to revisit a tutorial to the description — without those two, people who get interrupted never come back to it."),
            (3, stamp(-3, 9, 40), "Agreed. We should also consider tooltips for the advanced features, so a new user is not shown everything at once."),
            (5, stamp(-1, 16, 5), "If we record the tutorials as short videos I can reuse them on the customer side too. Same script, two audiences."),
        ],
    ),
    dict(
        id=102,
        title="Weekend Loan Desk for Small Traders",
        purpose="Traders cannot visit on weekdays, so applications stall. A Saturday desk would capture that demand.",
        # Discussion finished: handed to Loans and shared with the two people
        # who will run it.
        dept="Loans", tag="Lending", status="Approved",
        created=day(-14), created_at=stamp(-14, 9, 25), updated_at=stamp(-9, 15, 32),
        shared_with=[2, 3], implementation_date=day(21),
        description_type="bulletPoints", description_content=bullets(BULLETS_102),
        revisions=[
            (1, stamp(-14, 9, 25), "Open a short Saturday counter for small traders at our busiest branches, staffed on rotation, with paperwork pre-approved online.", "paragraph"),
            (2, stamp(-11, 10, 5), "Open a two-hour Saturday counter at the three busiest branches, staffed on rotation so no one works more than one weekend a month, with paperwork pre-approved online so the visit is signature only. Review footfall after eight weeks before expanding.", "bulletPoints"),
        ],
        comments=[
            (2, stamp(-11, 10, 8), "I have put the rotation rule into the description — one weekend a month is the most we can ask without paying overtime."),
            (7, stamp(-10, 12, 30), "Kondapur, Ameerpet and Gachibowli are the three with weekend footfall. The others would sit empty."),
            (1, stamp(-9, 15, 30), "Good. Approved for a pilot at those three. Report footfall after eight weeks."),
        ],
    ),
    dict(
        id=103,
        title="Recovery Call Scripts by Delinquency Stage",
        purpose="Every officer improvises. Consistent scripts would lift recovery rates and keep us compliant.",
        dept="Recovery", tag="Collections", status="In Progress",
        created=day(-9), created_at=stamp(-9, 8, 55), updated_at=stamp(-4, 14, 45),
        shared_with=[7], implementation_date=day(10),
        description_type="paragraph",
        description_content=para(
            "Write one approved script per delinquency stage — 15, 30, 60 and 90 days — with the exact language the regulator expects, an escalation path, and a short list of concessions an officer may offer without approval."
        ),
        revisions=[
            (1, stamp(-9, 8, 55), "Write one approved script per delinquency stage — 15, 30, 60 and 90 days — with the exact language the regulator expects and an escalation path.", "paragraph"),
            (7, stamp(-5, 11, 15), "Write one approved script per delinquency stage — 15, 30, 60 and 90 days — with the exact language the regulator expects, an escalation path, and a short list of concessions an officer may offer without approval.", "paragraph"),
        ],
        comments=[
            (7, stamp(-5, 11, 18), "Added the concessions list — officers need to know what they can offer without ringing the chairman at nine at night."),
            (8, stamp(-5, 14, 2), "Whatever the wording ends up being, we will need a short training session before it goes live."),
            (1, stamp(-4, 14, 40), "Agreed on both. Vikram, this is yours — draft the 15 and 30 day scripts first."),
        ],
    ),
    dict(
        id=104,
        title="Referral Rewards for Existing Depositors",
        purpose="Word of mouth already brings us deposits. Paying for it properly would bring more.",
        # Raised this morning — the newest thing in the room.
        dept="Marketing", tag="Marketing", status="Under Review",
        created=day(-1), created_at=stamp(-1, 17, 8), updated_at=stamp(0, 9, 15),
        shared_with=[], implementation_date=None,
        description_type="paragraph",
        description_content=para(
            "Give existing depositors a small fixed reward for every referral that opens an account and keeps it funded for ninety days. Track referrals through a code in the mobile app so nothing has to be handled at the branch."
        ),
        revisions=[
            (1, stamp(-1, 17, 8), "Give existing depositors a small fixed reward for every referral that opens an account and keeps it funded for ninety days. Track referrals through a code in the mobile app so nothing has to be handled at the branch.", "paragraph"),
        ],
        comments=[
            (5, stamp(0, 9, 15), "Ninety days funded is the right test — anything shorter and we pay for accounts that close in a month."),
        ],
    ),
    dict(
        id=105,
        title="Quarterly Skills Exchange Between Departments",
        purpose="Departments solve the same problems twice because nobody talks across the floor.",
        dept="HR", tag="People", status="On Hold",
        created=day(-21), created_at=stamp(-21, 13, 15), updated_at=stamp(-15, 10, 2),
        shared_with=[8], implementation_date=None,
        description_type="bulletPoints", description_content=bullets(BULLETS_105),
        revisions=[
            (1, stamp(-21, 13, 15), "One afternoon a quarter, each department demos what it built to everyone else. Twenty minutes per team, rotating host.", "bulletPoints"),
        ],
        comments=[
            (8, stamp(-18, 9, 30), "Happy to run it, but not while the audit is open — nobody has an afternoon spare until it closes."),
            (1, stamp(-15, 10, 0), "Good idea, wrong quarter. HR owns it. Bring it back after the audit closes."),
        ],
    ),
    dict(
        id=106,
        title="Single Dashboard for Branch Cash Position",
        purpose="Branch managers phone each other to find cash. One screen would end that.",
        dept="Operations", tag="Process", status="In Progress",
        created=day(-11), created_at=stamp(-11, 11, 35), updated_at=stamp(-10, 11, 40),
        shared_with=[3, 4], implementation_date=day(30),
        description_type="flowchart", description_content=FLOWCHART_106,
        revisions=[
            (1, stamp(-11, 11, 35), "Every branch posts its closing cash position; a nightly job rolls it up into one regional dashboard managers can read before they open.", "flowchart"),
        ],
        comments=[
            (3, stamp(-11, 14, 10), "Every branch can post a closing figure by seven. Earlier than that and the last counter is still open."),
            (4, stamp(-10, 10, 5), 'A nightly job is easy. The work is getting the branch systems to agree on what "closing" means.'),
        ],
    ),
    dict(
        id=107,
        title="Digitise the Insurance Claim Intake Form",
        purpose="Paper intake adds four days to every claim before anyone even reads it.",
        # A private draft: not opened for discussion, so nobody has been told.
        dept="Insurance", tag="Risk", status="Draft",
        created=day(-1), created_at=stamp(-1, 18, 22), updated_at=stamp(-1, 18, 22),
        shared_with=[], implementation_date=None,
        description_type="paragraph",
        description_content=para(
            "Replace the paper claim intake form with a mobile form the branch officer fills in with the customer present, attaching photographs of documents directly instead of couriering them."
        ),
        revisions=[
            (1, stamp(-1, 18, 22), "Replace the paper claim intake form with a mobile form the branch officer fills in with the customer present, attaching photographs of documents directly instead of couriering them.", "paragraph"),
        ],
        comments=[],
    ),
]

# --------------------------------------------------------------------------
#  tasks — each task's department follows its owner, the way the API sets it
# --------------------------------------------------------------------------

TASKS = [
    (201, "Draft onboarding tutorial storyboard", "Six screens covering sign-in, ideas, tasks and the think log.", 4, 101, stamp(-2, 10, 0),  stamp(3, 10, 0),   day(3),   "In Progress", "High"),
    (202, "Weekend desk staffing rota",           "Draw up the eight-week rotation and circulate for objections.", 2, 102, stamp(-1, 9, 30),  stamp(1, 9, 30),   day(1),   "In Progress", "High"),
    (203, "Write the 15-day recovery script",     "First of four; run the wording past Legal before sending.",     7, 103, stamp(-4, 14, 0),  stamp(-1, 14, 0),  day(-1),  "In Progress", "High"),
    (204, "Referral reward cost model",           "What a fixed reward costs us per funded account at three volumes.", 5, 104, stamp(0, 11, 15), stamp(5, 11, 15), day(5),   "In Progress", "Medium"),
    (205, "Collect branch cash feeds",            "Confirm every branch can post a closing figure by 7pm.",        3, 106, stamp(-6, 16, 0),  stamp(-3, 16, 0),  day(-3),  "Completed",   "Medium"),
    (206, "Quarterly exchange venue hold",        "Hold the training room for the first Friday of each quarter.",  8, 105, stamp(-8, 13, 0),  stamp(-5, 13, 0),  day(-5),  "Completed",   "Low"),
    (207, "Claim form field audit",               "List every field on the paper form and mark what is actually used.", 6, 107, stamp(1, 10, 30), stamp(7, 10, 30), day(7),  "In Progress", "Medium"),
    (208, "Tutorial copy review",                 "Read the tutorial copy for tone and length.",                   5, 101, stamp(2, 15, 30),  stamp(9, 15, 30),  day(9),   "In Progress", "Low"),
    (209, "Recovery dashboard walkthrough",       "Show the recovery team the new reporting screen.",              7, None, stamp(-12, 11, 0), stamp(-9, 11, 0),  day(-9),  "Completed",   "Medium"),
    (210, "Re-check deposit slab pricing",        "Returned for a second pass on the six-month slab.",             2, None, stamp(-3, 9, 0),   stamp(2, 9, 0),    day(2),   "Re Assign",   "High"),
    (211, "Branch manager training slots",        "Two sessions per region, ninety minutes each.",                 3, 106, stamp(4, 14, 30),  stamp(12, 14, 30), day(12),  "In Progress", "Medium"),
    (212, "Review the concession list",           "Confirm what officers may offer without approval.",             8, 103, stamp(3, 12, 0),   stamp(6, 12, 0),   day(6),   "In Progress", "High"),
    (213, "Onboarding tutorial build — sprint 1", "Sign-in and ideas board walkthroughs.",                         4, 101, stamp(5, 10, 0),   stamp(14, 10, 0),  day(14),  "In Progress", "High"),
    (214, "Product spec for the mobile claim form", "Field list, validation rules and offline behaviour.",         6, 107, stamp(-5, 14, 0),  stamp(4, 14, 0),   day(4),   "In Progress", "Medium"),
]

# --------------------------------------------------------------------------
#  think logs — the chairman's own page. A note is one point, however many
#  lines it runs to.
# --------------------------------------------------------------------------

LOGS = [
    (301, day(0),   stamp(0, 8, 40),   "Onboarding drop-off is a first-week problem, not a product problem",
     "Onboarding drop-off is a first-week problem, not a product problem.\nAsk Ananya for the seven-day retention numbers by department.", ["idea"]),
    (302, day(-1),  stamp(-1, 8, 15),  "Saturday footfall at the Kondapur branch is double the weekday average",
     "Saturday footfall at the Kondapur branch is double the weekday average.\nRecovery officers each use different language on the same call.", ["idea"]),
    (303, day(-4),  stamp(-4, 9, 5),   "Referrals already bring in a third of new deposits with no incentive at all",
     "Referrals already bring in a third of new deposits with no incentive at all.\nDraft a note to Rohit about referral tracking in the app.", ["task"]),
    (304, day(-12), stamp(-12, 7, 50), "Departments are solving the same reporting problem three times over",
     "Departments are solving the same reporting problem three times over.\nAudit closes end of next month — nothing new before then.", []),
]

# --------------------------------------------------------------------------
#  notifications
#
#  Deliberately short. The newest idea went to everybody — that is the whole
#  point of the chairman opening a discussion. Everything else is work
#  addressed to one person.
# --------------------------------------------------------------------------

NOTIFS = [
    *[
        (u, "idea", "New idea: Referral Rewards for Existing Depositors", stamp(-1, 17, 8), True, False, "/ideas/104")
        for u in (2, 3, 4, 5, 6, 7, 8)
    ],
    (1, "warn",   "Task overdue: Write the 15-day recovery script",     stamp(0, 7, 0),    True,  True,  "/tasks"),
    (4, "task",   "New task: Onboarding tutorial build — sprint 1",     stamp(0, 9, 12),   True,  False, "/tasks"),
    (4, "snooze", "Due in 3 days: onboarding storyboard",               stamp(-1, 9, 0),   False, True,  "/tasks"),
    (4, "ok",     "Shared with you: Single Dashboard for Branch Cash…", stamp(-10, 11, 40), False, False, "/ideas/106"),
    (2, "ok",     "Shared with you: Weekend Loan Desk for Small Tra…",  stamp(-9, 15, 32),  True,  False, "/ideas/102"),
    (7, "ok",     "Shared with you: Recovery Call Scripts by Delinq…",  stamp(-4, 14, 45),  True,  False, "/ideas/103"),
]

# --------------------------------------------------------------------------
#  direct messages — one row per pair, stored sorted
# --------------------------------------------------------------------------

DMS = [
    ((1, 4), [
        (1, "Can you sit on the onboarding idea? You know the drop-off numbers.", stamp(-2, 9, 12)),
        (4, "Yes. I will pull the seven-day retention split by department first.", stamp(-2, 9, 20)),
    ]),
    ((4, 6), [
        (6, "Are we demoing the tutorials at the next review?", stamp(-1, 15, 2)),
    ]),
]


async def main(force: bool = False) -> None:
    # The tables are Alembic's job — run `alembic upgrade head` first. Creating
    # them here as well would leave the database without a revision stamp, and
    # the first real migration would then fail on tables that already exist.
    async with SessionLocal() as db:
        try:
            await db.execute(select(func.count()).select_from(User))
        except Exception:
            print("No tables yet. Run `alembic upgrade head` first, then seed.")
            return

    async with SessionLocal() as db:
        existing = (await db.execute(select(func.count()).select_from(User))).scalar_one()
        if existing and not force:
            print(
                f"There are already {existing} accounts in this database.\n"
                "Re-seeding would delete them. Run `python seed.py --force` if that is what you want."
            )
            return

        # TRUNCATE … CASCADE resets the sequences too, so the ids below land
        # where they are meant to and /ideas/104 still means what it meant.
        await db.execute(text(
            "TRUNCATE users, ideas, idea_shares, idea_revisions, idea_comments, "
            "idea_activity, tasks, think_logs, think_log_points, dm_threads, "
            "dm_messages, notifications RESTART IDENTITY CASCADE"
        ))

        for uid, username, password, name, title, role, dept, email, sex, variant in USERS:
            db.add(User(
                id=uid, username=username, password_hash=hash_password(password),
                name=name, title=title, role=role, dept=dept, email=email,
                avatar_sex=sex, avatar_variant=variant,
                last_seen_at=stamp(0, 8, 0) if uid == 1 else None,
            ))
        await db.flush()

        for spec in IDEAS:
            db.add(Idea(
                id=spec["id"], title=spec["title"], tagline=spec["title"],
                purpose=spec["purpose"], dept=spec["dept"], tag=spec["tag"],
                status=spec["status"], created=spec["created"],
                created_at=spec["created_at"], updated_at=spec["updated_at"],
                owner_id=1, implementation_date=spec["implementation_date"],
                sample=True, description_type=spec["description_type"],
                description_content=spec["description_content"],
            ))
            await db.flush()

            for uid in spec["shared_with"]:
                db.add(IdeaShare(idea_id=spec["id"], user_id=uid))

            for author_id, at, body, d_type in spec["revisions"]:
                # The newest version holds the idea's current description; the
                # older ones keep a text-and-type record of what they were.
                content = spec["description_content"] if d_type == spec["description_type"] else None
                db.add(IdeaRevision(
                    idea_id=spec["id"], author_id=author_id, created_at=at,
                    text=body, description_type=d_type,
                    description_content=content or para(body),
                ))

            for author_id, at, body in spec["comments"]:
                db.add(IdeaComment(idea_id=spec["id"], author_id=author_id, created_at=at, text=body))

            db.add(IdeaActivity(
                idea_id=spec["id"], actor_id=1,
                created_at=spec["created_at"], what="created this idea",
            ))

        await db.flush()

        owner_dept = {uid: dept for uid, _, _, _, _, _, dept, _, _, _ in USERS}
        for tid, title, desc, owner_id, idea_id, at, start, due, status_, priority in TASKS:
            db.add(Task(
                id=tid, title=title, description=desc, dept=owner_dept[owner_id],
                owner_id=owner_id, assigned_by_id=1, idea_id=idea_id,
                created_at=at, start_at=start, due=due, status=status_, priority=priority,
            ))

        for lid, d, at, title, body, states in LOGS:
            db.add(ThinkLog(id=lid, owner_id=1, date=d, created_at=at, title=title, sample=True))
            await db.flush()
            db.add(ThinkLogPoint(log_id=lid, position=0, text=body, states=states))

        for user_id, icon, title, at, unread, reminder, link in NOTIFS:
            db.add(Notification(
                user_id=user_id, icon=icon, title=title, created_at=at,
                unread=unread, reminder=reminder, link=link,
            ))

        for (a, b), msgs in DMS:
            lo, hi = sorted((a, b))
            thread = DmThread(user_a_id=lo, user_b_id=hi, created_at=msgs[0][2])
            db.add(thread)
            await db.flush()
            for from_id, body, at in msgs:
                db.add(DmMessage(thread_id=thread.id, from_id=from_id, text=body, created_at=at))

        await db.commit()

        # The ids above were written explicitly, so the sequences are still at
        # 1 and the next INSERT would collide. Walk them past the highest row.
        for table in ("users", "ideas", "tasks", "think_logs"):
            await db.execute(text(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {table}), 1))"
            ))
        await db.commit()

    print("Seeded. Sign in as `chairman` / `gk`, or any member (priya, meera, ananya…) / `tt123`.")


if __name__ == "__main__":
    asyncio.run(main(force="--force" in sys.argv))
