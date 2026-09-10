# Think Tank API

The backend for the Think Tank React app. FastAPI, PostgreSQL, SQLAlchemy 2.0
(async) and Alembic.

It implements the contract your frontend already describes in
`src/lib/httpApi.js` — same paths, same field names, same rules — so switching
over is two lines in the React project's `.env` and nothing else.

---

## Where it goes

Beside the React project, not inside it. Two applications, two dependency
managers, two deploy targets:

```
ThinkTank/
├─ thinktankreact_mobile_updated/   your React app
└─ thinktank-api/                   this
```

Keep them as separate git repositories. Putting a Python project inside a
Vite project means `npm run build` starts walking a `.venv` with thousands of
files in it, and every frontend deploy carries your database credentials
along for the ride.

## Run it — Windows

You need Python 3.11+ and Docker Desktop (or your own PostgreSQL 14+).

**Once:**

```
docker compose up -d
```

then double-click **`setup.bat`**. It builds the virtual environment,
installs everything, writes a `.env` with a real `SECRET_KEY`, creates the
tables and loads the demo data.

**Every time after that:** `docker compose up -d`, then double-click
**`run-api.bat`**.

Prefer typing it yourself, in PowerShell:

```powershell
docker compose up -d
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env          # then put a real SECRET_KEY in it
alembic upgrade head
python seed.py
uvicorn app.main:app --reload --port 8000
```

If `Activate.ps1` is blocked, either run `Set-ExecutionPolicy -Scope
CurrentUser RemoteSigned` once, or use Command Prompt where
`.venv\Scripts\activate.bat` works without ceremony.

## Run it — macOS / Linux

```bash
docker compose up -d
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env             # then put a real SECRET_KEY in it
alembic upgrade head
python seed.py
uvicorn app.main:app --reload --port 8000
```

Interactive docs either way: <http://localhost:8000/docs>

## Then wire up the React app

Three small changes, all of them in **`frontend-changes/`** with the
reasoning written out: a `vite.config.js` with a proxy block, two lines of
`.env`, and one line in `src/lib/httpApi.js`.

Copy them across, restart `npm run dev`, and the app is on Postgres.

### Sign in

Exactly the accounts the sign-in screen advertises.

| Username | Password | Who |
|---|---|---|
| `chairman` | `gk` | G. Krishna, the chairman |
| `priya`, `meera`, `ananya`, `rohit`, `sana`, `vikram`, `karthik` | `tt123` | team members |

---

## The cookie, and why the proxy is there

The session is a JWT in an **httpOnly cookie** — which is why `httpApi.js`
sends `credentials: 'include'` and stores no token anywhere. Nothing in
JavaScript can read it, so nothing in JavaScript can leak it.

The cost is that cookies care about the *site*. Page on `:5173`, API on
`:8000` and the browser calls that cross-site, with the failure mode that
login appears to work and then every call after it comes back 401. That is
what the Vite proxy in `frontend-changes/vite.config.js` removes: the browser
only ever talks to `:5173`, the cookie is first-party, and CORS is not
involved at all.

In **production**, put the app and the API on the same domain
(`example.com` and `example.com/api`) and this stays simple. On separate
domains you need `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true`, which
means HTTPS on both, and every front end named in `CORS_ORIGINS` — a
credentialed request may not use a wildcard origin.

---

## What's here

```
app/
  main.py          the FastAPI app, CORS, routers
  config.py        settings, read from .env
  db.py            async engine, one session per request
  models.py        the tables
  schemas.py       what goes out (and what is allowed in)
  security.py      passwords, the cookie, "who is calling"
  rules.py         the business rules, in one readable place
  routers/         auth · team · ideas · tasks · think_logs · messages · notifications
alembic/           migrations
seed.py            the demo data, ported from mockDb.js
verify_contract.py 86 checks that the API says what React reads
docker-compose.yml Postgres
```

`rules.py` is the one to read first. Everything about who may do what — who
can see a Draft, who may post on an idea, what earns a notification — lives
there rather than being scattered through the route handlers.

---

## The endpoints

Every one of these is called from `src/lib/httpApi.js`.

| | |
|---|---|
| `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/logout` | the session cookie |
| `GET/POST /api/team` · `PATCH/DELETE /api/team/{id}` | Team Members |
| `GET/POST /api/ideas` · `GET/PUT/PATCH/DELETE /api/ideas/{id}` | the board |
| `POST /api/ideas/{id}/revisions` | a new version of the description |
| `POST /api/ideas/{id}/comments` · `PATCH/DELETE …/{commentId}` | the discussion |
| `POST /api/ideas/{id}/share` | hand the project over |
| `GET /api/tasks` · `GET /api/tasks/stats` · `POST /api/tasks` · `PATCH/DELETE /api/tasks/{id}` | Tasks |
| `GET/POST /api/think-logs` · `PATCH /api/think-logs/points/{id}` · `DELETE /api/think-logs/{id}` | Think Log |
| `GET /api/messages` · `GET/POST /api/messages/{userId}` · `GET /api/messages/unread-count` | direct messages |
| `GET /api/notifications` · `/unread-count` · `POST /read-all` · `POST /{id}/read` | the bell |

Most idea endpoints return the **whole idea**, not just the bit that changed.
That is deliberate: posting a comment re-renders the page from one response,
so there is never a moment where the comment is on screen but the version
trail below it is stale.

---

## The rules it enforces

Lifted from the header comments in `mockApi.js`, which is what the screens
were built against.

**Seeing an idea.** Once an idea leaves Draft it is visible to the whole
organisation. A Draft belongs to its author alone.

**Posting and editing.** Everybody, chairman and team member alike, for as
long as the idea exists. It is one room, and the point of telling the whole
company about an idea is that the whole company can answer. Every edit is a
new signed version, which is what keeps that honest. You may edit or delete
only your own message; the chairman may delete anyone's.

**Chairman only.** Opening an idea, setting the implementation date, changing
the status, sharing the project, assigning tasks, and turning a think-log
point into an idea or a task. Scheduling an idea approves it at the same
moment — putting a date on it *is* the decision to do it.

**Tasks.** The chairman sees the whole board; everyone else sees their own
work and can move it. Assigning to three people writes three rows, so each
person owns their copy. A task's department follows its owner.

**Notifications.** Deliberately narrow — a new idea (everyone), a task
assigned to you, a project shared with you, a message. Nothing else. A bell
that pings on every edit and every comment is a bell people stop reading, and
then the one message that mattered goes past unnoticed. Everything else lives
on the page it happened on: the change history behind the clock icon, and the
discussion itself.

**Implementation dates** are not stored as tasks. They are worked out from the
idea each time the calendar is read and returned with a string id
(`impl-104`), so a date that moves cannot leave a stale copy behind on
somebody's calendar.

---

## Checking it still works

```bash
python verify_contract.py
```

86 assertions against a running API: every response shape the React adapters
read, every permission boundary, and the notification rules. Run it after any
change to `schemas.py` — a renamed field is the failure that otherwise shows
up one blank screen at a time, in the browser, a week later.

It writes to the database (posts a comment, assigns a task, sends a message)
and tidies up after itself, so point it at development, not anything real.

---

## Before this goes anywhere real

1. **`SECRET_KEY`** — generate one:
   `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
   The default in `.env.example` is a placeholder and the whole session
   scheme rests on it.
2. **The demo passwords.** `gk` and `tt123` are in `seed.py` because they are
   what the sign-in screen advertises. Change them, and change
   `DEFAULT_MEMBER_PASSWORD` with them.
3. **`COOKIE_SECURE=true`** once you are on HTTPS.
4. **`CORS_ORIGINS`** — your real front end, not localhost.
5. **Don't run `seed.py`** against it. It truncates.

## Things left for you

Deliberately not built, because the frontend does not call for them yet:

* **File upload.** `descriptionType: 'uploadFile'` currently stores the file
  *list* (names and sizes) in the description JSON, which is what the demo
  did. Real uploads need a `POST /api/ideas/{id}/files` and somewhere to put
  the bytes.
* **Password reset / change.** The sign-in screen has a "Forgot Password?"
  link that goes nowhere.
* **The overdue reminder.** The seed contains a "Task overdue" notification
  because the demo hard-coded one. Nothing generates them yet — that is a
  scheduled job that walks tasks past their due date once a day.
* **Rate limiting** on `/api/auth/login`.
