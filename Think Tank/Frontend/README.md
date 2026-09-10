# Think Tank — React

A complete React front end (Vite + JavaScript, no TypeScript) for the Think Tank
idea and task dashboard. It runs **on its own** — no backend needed — and is
wired so a real API can be dropped in later without touching a single component.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
```

Node 18 or newer. Nothing else to start.

## Sign-in

| Username   | Password | Role        | Name                                |
|------------|----------|-------------|-------------------------------------|
| `chairman` | `gk`     | Chairman    | G. Krishna                          |
| `priya`    | `tt123`  | Team member | Priya Iyer — Head of Finance        |
| `meera`    | `tt123`  | Team member | Meera Nair — Operations Lead        |
| `ananya`   | `tt123`  | Team member | Ananya Rao — Engineering Manager    |
| `rohit`    | `tt123`  | Team member | Rohit Sharma — Marketing Lead       |
| `sana`     | `tt123`  | Team member | Sana Fatima — Product Manager       |
| `vikram`   | `tt123`  | Team member | Vikram Shetty — Operations Manager  |
| `karthik`  | `tt123`  | Team member | Karthik Menon — HR Business Partner |

Emails work in place of the username too (`chairman@thinktank.co` and so on).
The password is checked against the account, so a wrong one is refused —
`src/lib/mockApi.js` compares it in plain text because it is a demo; the real
backend hashes it and that check disappears with the switch to `httpApi.js`.

Sign in as `chairman` to create ideas, schedule them and share projects, and as
any team member to join a discussion, post, and edit the idea. Only the chairman
can create a new idea — see **How an idea actually works** below.

**The chairman is never shown by name.** The account belongs to G. Krishna, but
anywhere a name would appear — the header, a comment, *Created By* /
*Edited By*, the team table, an assigned-to column — the app prints
**Chairman**. Team members are shown by their real names. This is one helper,
`displayName(name, role)` in `src/lib/format.js`, and one constant beside it:

```js
export const CHAIR_LABEL = 'Chairman';
```

Change that string and the word changes everywhere. The substitution happens at
render time, so the database — and your backend — can hold the real name.

## Where the data comes from

`src/lib/api.js` is a switch between two modules that expose the **same**
functions with the **same** return shapes:

| File                | What it does                                              |
|---------------------|-----------------------------------------------------------|
| `src/lib/mockApi.js`| Reads and writes `src/lib/mockDb.js`, persisted to `localStorage`. Default. |
| `src/lib/httpApi.js`| `fetch` calls to a REST backend with a session cookie.     |

No component imports either one directly — they all import `{ api }` from
`src/lib/api.js`. So when the backend is ready:

```bash
# .env
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:8000
```

That is the whole migration. `src/lib/httpApi.js` already lists every endpoint
the app expects, including the idea-detail ones:

```
POST   /api/auth/login              GET  /api/ideas
GET    /api/auth/me                 GET  /api/ideas/:id
POST   /api/auth/logout             POST /api/ideas
GET    /api/team                    PUT  /api/ideas/:id
POST   /api/team                    PATCH /api/ideas/:id      (status, implementation_date)
PATCH  /api/team/:id                DELETE /api/ideas/:id
DELETE /api/team/:id                POST /api/ideas/:id/revisions
GET    /api/tasks                   POST /api/ideas/:id/comments
POST   /api/tasks                   DELETE /api/ideas/:id/comments/:commentId
PATCH  /api/tasks/:id               PATCH /api/ideas/:id/comments/:commentId
GET    /api/notifications           POST /api/ideas/:id/share
POST   /api/notifications/read-all  PATCH /api/ideas/:id/department
GET    /api/think-logs              POST /api/ideas/:id/reopen
POST   /api/think-logs              PATCH /api/think-logs/points/:id
```

`POST /api/ideas` carries no department — there is none to send. The department
arrives later through `PATCH /api/ideas/:id/department`, which is also what sets
`discussion_closed`.

The demo data reseeds itself if you leave a browser tab open past midnight, so
"Today" on the calendar always means today. Anything you create during a
session survives a refresh.

## How an idea actually works

**1. The chairman creates it.** `Create New Idea` asks for a description — in a
flowchart, bullets, a paragraph or an uploaded file — then a **tagline**, a
**purpose** and a **department**, in that order. Only the chairman can do this:
the button is not rendered for a team member, and `/ideas/new` redirects them
away (`ChairOnly` in `src/App.jsx`). Saving drops him straight onto the idea's
discussion page, which is where everyone else is about to arrive.

**2. Everyone is notified and joins in.** A pop-up card slides in at the
top-right of whatever they are doing — "New idea: …" — with a button that opens
the discussion. On that page anyone can post, anyone can edit their own message,
and anyone can edit **the idea itself**. The discussion stays open for as long
as the idea exists.

Editing opens the editor the idea was written in — a flowchart opens the
flowchart canvas (in a wide dialog, because a canvas squeezed into a form
column is unusable), bullets open the bullet list — and saves the description
in that shape, not a text summary of it. A member who moves a box or adds a
step is editing the drawing everyone sees.

**Every version is on the page, oldest first**: what the chairman created, then
each edit below it, each signed with a name and a time. Reading down the page
is reading the idea as it developed.

**Every one of them is drawn in the shape it was written**, not only the newest.
Each revision stores its own `description_type` and `description_content`, so
the chairman's original flowchart is still a flowchart after a member edits it,
rather than collapsing to "Start → Step 2 → Step 3". The newest version is
shown with the idea's own description, and `addRevision` freezes that
description onto it before a newer version arrives — otherwise the original
would turn into plain text the moment somebody edited after it, which is
exactly how the chairman's first flowchart used to stop being a flowchart.

**3. The chairman schedules and shares it.** Two things are his alone:

| | |
|---|---|
| **Set Implementation Date** | The date the work is due. It lands on the calendar of everyone he has shared the project with — see *Implementation dates on the calendar* below. Team members see the date but cannot change it. |
| **Share** | Names the team members carrying the project. They are notified and listed on the idea under *Shared with*. Once it has been shared the button simply reads **Shared** — it carries no number, because a count there read as an unread badge that came back on every visit, and the names are on the page and inside the dialog already. |

`canCommentOnIdea()` and `canEditIdea()` at the top of `src/lib/mockApi.js` are
the only place those rules live, and the API returns `can_comment` /
`can_edit_idea` on every idea so no screen has to guess.

## Drawing a flowchart

The canvas has three shape buttons — Process, Decision, Start / End — and **two
arrow buttons of its own**:

| | |
|---|---|
| **→ Arrow** | Click the shape the arrow starts from, then the shape it points to. This is the flow reading forward. |
| **↩ Return Arrow** | Same two clicks, but for going back — End straight back to Start. |

A return arrow is not drawn straight. Drawn straight it would cut through every
step in between, which is the one thing a loop-back must not look like: it reads
as stepping back through the whole chart instead of returning to the beginning.
So it is routed around the outside, taking whichever way is clear — a lane
underneath the boxes when the steps run left to right, a channel down the right
of the chart when they are stacked one above the other. `linkPaths()` in
`src/lib/flowchart.js` measures the rendered boxes, tries the route underneath
first, and checks it against every other box before using it. Return arrows are
drawn in amber so a loop-back is distinguishable from the forward flow at a
glance.

**The canvas scrolls; it never cuts the drawing off.** The shapes sit on a
stage that grows to fit them, and the canvas scrolls over it. A chart drawn in
the full-page editor is wider than the Edit dialog on the discussion page, and
a fixed canvas simply clipped the far shapes: a team member opening Edit could
not see, move or connect them, and a return arrow routed round the outside
vanished over the edge. Now every member opening Edit gets the whole chart,
whatever it was drawn in and whatever they are reading it on.

**Clicking an arrow removes it.** A wrong connection used to mean clearing the
whole drawing; now only that arrow goes. Each arrow is drawn twice — the visible
line, and a wide transparent copy underneath it that takes the click, because a
2px line is not something anyone can hit.

The geometry lives in `src/lib/flowchart.js` and nowhere else, so the editor and
the read-only view on the discussion page cannot drift apart: what someone draws
is exactly what everyone else sees.

## The discussion page

The description is shown **in the shape it was written** — a flowchart renders
as the flowchart (`FlowchartView`), bullet points as a list, an upload as its
files, a paragraph as prose. `DescriptionView` picks. Nothing is folded away:
every version is on the page, oldest first.

The change history is behind the clock icon at the top right rather than in a
panel under the conversation.

**Messaging, under the discussion — the LinkedIn shape.** The column reads top
to bottom: the discussion, big, taking whatever height is going, and one
*Messaging* bar under it with your own picture on it. The arrow opens the bar
into the conversation list — a search box, **Focused** (the people you are
already talking to, newest first) and **Other** (the rest of the team), and
every row showing the last thing said, `You: …` when it was yours, and when.
Picking a row opens that conversation **in the same panel**, with a back arrow
to the list.

There is deliberately only one place on the page to write to somebody. The
older layout had two — a team list under the discussion and a chat window that
floated on top of it — and scrolling ran the two together. Nothing floats now:
the column is pinned and never grows past the window, so the discussion and the
Messaging bar are always both in view and neither can cover the other. On a
phone the column simply stacks, discussion first.

The chat is one-to-one and separate from the group thread: the discussion is
the record of how a decision was made and belongs to everybody; this is the
quiet word beside it. It exists only on this page.

Presence has no socket behind it. `lastSeenAt` is stamped on every
authenticated call and anyone active in the last three minutes counts as
online; `AppContext` re-reads the team list every thirty seconds to keep the
dots and the unread counts honest.

## Implementation dates on the calendar

A date the chairman sets is the company's deadline, so it lands on **every**
team member's My Tasks calendar, whether or not the project was shared with
them. Rather than copying a task record per person — two things to keep in
step, one of them wrong the moment the date moves — the entries are derived
from the idea each time the calendar is read (`milestonesFor()` in
`src/lib/mockApi.js`). They carry a string id (`impl-42`) so nothing mistakes
one for an editable task, and show in purple against the blue of ordinary
work.

The same applies to a date set in the think log's *Share Idea*: it is the same
implementation date, reaching the same calendars the same way.

## The think log

**A note is one point.** However many lines you write, the note is a single
actionable thing with one *Add to Idea* and one *Add to Task*. Shift+Enter is
for writing a second line of the same thought, not for splitting it in two.

**Actionable Points lists every point, not just today's.** The note in the box
right now, plus every point from a note already saved, each with the date it
came from. Before this, a thought you had on Monday stopped being actionable
the moment you cleared the box. Actioning a saved point is remembered
(`PATCH /api/think-logs/points/:id`), so it reads *In Ideas* / *In Tasks* when
you come back.

**Who sees what.**

* **Chairman**: composer, Actionable Points, *Add to Idea* and *Add to Task*.
* **Team member**: composer, *Jump to Today*, and the list — which includes
  **the chairman's notes**, read-only with a View button, because that is the
  reasoning behind the ideas they are about to be asked about. Their own notes
  stay theirs. No Actionable Points panel: turning a point into an idea or a
  task is the chairman's to do.

*Add to Idea* and *Add to Task* are the same shape — a title, a description, a
date and the people it goes to. Neither has a department picker; the idea
carries the chairman's own department, and a task follows the person it is
given to.

### Sample data

The demo ships with example ideas, notes, comments and tasks so the screens are
not empty on a first run. Anything seeded carries a `sample` flag and is shown
with a small grey **sample** tag, so it is never mistaken for something a
colleague actually wrote. Deleting `seedIdeas()` / `seedLogs()` and friends in
`src/lib/mockDb.js` starts the app empty.

## Dates and times

Nothing is stored as a bare hour. Every record that represents something
*happening* carries an ISO timestamp in UTC and is rendered in the reader's own
timezone by the helpers in `src/lib/date.js` (`fmtTime`, `fmtWhen`,
`fmtDateTime`), so an idea created at 10:00 reads as 10:00 on every screen in
the office.

## Notifications

A bell that pings on every edit, every comment and every status change is a
bell people stop reading — and then the one message that mattered goes past
unnoticed. So the rule is narrow: **a notification is for something a person
has to know about and would not otherwise see.**

| Sent | To |
|---|---|
| The chairman has created a new idea | everyone |
| A task has been assigned to you | the assignee |
| A project has been shared with you | the person named |
| Somebody has sent you a message | the recipient |

Nothing else. Edits, comments, status changes and implementation dates are
recorded in the idea's own change history (behind the clock icon) and are
visible on the page they happened on — they do not ring a bell. `announce()`
in `src/lib/mockApi.js` writes to that history and deliberately sends nothing;
the four lines above are the only `notify()` calls in the file.

Lines are short — `clip()` caps a title at 42 characters:

```
New idea: Automate Branch Reconciliation
New task: Onboarding tutorial build — sprint 1
Shared with you: Weekend Loan Desk for Small Tra…
Message from Chairman
```

The pop-up itself is `src/components/layout/NotificationPopups.jsx`. It only
pops entries that appear **after the screen has loaded** — not the unread pile
that was already waiting when you signed in, which the bell handles.

### The database is written once and then kept

`load()` in `src/lib/mockDb.js` seeds on the very first visit and keeps whatever
is in storage after that.

An earlier version re-seeded whenever the date changed, so the demo's relative
dates stayed fresh. That was the wrong trade: it also threw away every idea,
message and read notification from the day before — so you could mark
everything as read, come back the next morning, and find the whole list unread
again with your own work gone. Slightly stale sample dates are a far smaller
problem than losing what somebody actually did.

Bumping `KEY` is what discards an old database, and that is deliberate: it only
happens when the seed's shape changes.

### One honest limitation of the demo

The demo database is a single `localStorage` bucket per browser profile holding
one `sessionUserId`, so two people cannot be signed in at once in the same
profile. Notifications and messages travel between **tabs of the same profile**:
`AppContext` listens for the `storage` event and for the window regaining focus.
Genuine multi-user delivery is the backend's job, and that listener is exactly
where a socket or a poll goes.

## Mobile

It is a web app people will open on a phone, so the narrow layout is part of
the work rather than an afterthought:

* Every page is checked for horizontal overflow at 390px.
* The calendar opens on **Month** — where the work sits across the weeks is
  the first thing you want; Day and Week are the zoom-ins. On a phone the month
  grid drops the task titles and shows a coloured dot per task under each date,
  so all seven days fit rather than four of them and a horizontal scrollbar.
* The Week grid scrolls sideways on a phone with the hour rail pinned to the
  left and the day header locked to its own columns.
* The right-hand column stops being pinned and stacks under the idea:
  discussion first, messaging under it.
* The left menu is a drawer opened from the hamburger, so its open/close
  button — which is for the desktop menu — is not shown.
* Action buttons that fade in on hover (edit, delete a message) are always
  visible on a coarse pointer, since there is no hover to fade them in with.

## The left menu

The menu closes down to a strip of icons and opens again — the button at the
top of it does both, and the page takes the width back as it goes. Closed,
every row still works: its label becomes its tooltip, and the notification
count moves to the corner of the bell rather than disappearing with the label.

Whether it is open is a preference, not a per-page state: it is kept in
`localStorage` (through `safeLocal`, so private-mode browsers degrade instead
of throwing) and is still the way you left it next time. On a phone the
sidebar is a drawer opened from the hamburger, so the button is hidden there.

## Back navigation and filters

Every page above the dashboard carries a back control
(`src/components/layout/BackLink.jsx`). It steps through history when there is
history and falls back to a sensible parent route when the page was opened from
a pasted link.

| Page | Filters |
|------|---------|
| Ideas | search, department, status, category, date created, sort, clear-all. The header reads *Showing 1–6 of 8* when the list is paginated, so the count always matches the rows on screen. |
| Idea detail | — (status control for the chairman) |
| Tasks — chairman | search, date range, status, team member, department, priority, plus the four stat cards |
| Tasks — member | search, status, priority (applied before the calendar is built) |
| Tasks — calendar | Month (the default) / Week / Day. Day and Week are real time grids: an hour rail down the left, tasks drawn at the hour they start, overlapping tasks side by side, and a red line at the current time. Implementation dates appear in purple. Month stays the compact chip grid. |
| Team | search, department, role, sort, pagination |
| Think Log | search, date range, what became of the points |
| Notifications | All / Unread / Reminders tabs, search, type, when |
| Dashboard | date range picker |

Every filter bar shows a **Clear N filters** button once something is active,
and changing a filter always returns you to page one.

## Project layout

```
src/
  components/
    dashboard/   date range picker, weekly progress chart
    ideas/       IdeaForm (4 description editors), IdeaComments, TeamRail,
                 DescriptionView, FlowchartView, EditIdeaModal,
                 ImplementationDateModal, ShareIdeaModal, HistoryModal,
                 IdeaViewModal
    messaging/   MessagingHub — the Messaging bar and conversation list;
                 MessagingDock — one conversation inside it. Discussion page only
    layout/      AppBar, Sidebar, DashboardLayout, PageHead, BackLink,
                 NotificationPopups
    tasks/       AdminTaskOverview, MyTasksCalendar, TaskViewModal
    team/        InviteMemberModal, EditRoleModal
    thinklog/    IdeaSanctuaryModal, CreateTaskModal, LogViewModal
    ui/          Modal, ConfirmDialog, Pager, DueTag, CandidatePicker
  data/          department lists, description-type constants, blank idea
  lib/           api switch, mockApi, mockDb, httpApi, dates, icons, avatars,
                 flowchart (arrow routing, shared by the editor and the view)
  pages/         Dashboard, Ideas, IdeaDetail, Tasks, Team, ThinkLog,
                 Notifications, Login
  store/         AuthContext, AppContext, ToastContext
  styles/        global.css, app.css, login.css
```

## Notes for the backend

* `AppContext` calls the server first and only then updates local state, so the
  screen never shows something the database refused.
* Role rules the mock enforces, which the API should enforce too: only the
  chairman creates an idea, shares it, sets its implementation date, assigns
  tasks, changes its status, or uses the think log's Add to Idea / Add to Task.
  **Any** signed-in user may post on an idea and edit its text. A Draft is
  visible only to its author and the chairman; everything else is visible to
  the whole organisation.
* Presence: stamp `last_seen_at` on every authenticated request and return
  `online` on the member shape. Three minutes is the window the UI assumes.
* A revision is a snapshot, not a diff: store `description_type` and
  `description_content` alongside the text on every version, so each one can be
  rendered in the editor it was written in. Freeze that snapshot onto the
  newest version *before* appending a new one — the newest is drawn with the
  idea's live description, so a version left without its own copy turns into
  plain text as soon as somebody edits after it. `POST /ideas/:id/revisions`
  takes `description_type` and `description_content`, not a line of text.
* The **Total Ideas** figure counts exactly what that person can open — the
  same number the Ideas page prints above its list, so the two screens can
  never disagree. Every team member sees the same total, because they all see
  the same published ideas; the chairman's number also includes his own drafts,
  and the card says how many of them are drafts.
* The chairman's name is never rendered. If the API returns one, the UI still
  prints `Chairman` — see `displayName` in `src/lib/format.js`. Both API layers
  carry `ownerRole` / `authorRole` alongside every name so the substitution can
  be made without a second lookup.
* `publicUser()` in the mock deliberately builds its result field by field
  rather than spreading the record, so the password can never reach the
  browser. Whatever replaces it should be just as careful.
* Avatars are inline SVG (`src/lib/avatars.jsx`) — no image uploads to support.
  A member record carries `av: [sex, variantIndex]`. There are twelve variants
  per sex now, and a variant picks a whole look — skin, hair colour, hairstyle,
  glasses, beard, shirt — rather than only recolouring one face. They blink,
  in CSS, staggered per variant, and hold still for anyone who has asked for
  reduced motion.
