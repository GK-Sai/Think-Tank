# Adding logging to the Think Tank API — step by step

Everything below is already done in the files in `thinktank-logging.zip`. Read
a step, drop in the file it names, move to the next.

Working folder: `C:\Users\GK Sai\Downloads\Think Tank\Backend\thinktank-api`

---

## What you end up with

- One line per request in the console **and** in `logs/thinktank.log`:
  `POST /api/ideas -> 201 in 34.2ms user=3 ip=127.0.0.1`
- A short **request id** on every line and on every response
  (`X-Request-ID` header) — one id ties a click in the browser to its lines
  in the log file.
- The **full traceback** of anything that 500s, saved to the file — instead of
  scrolling away in a terminal you closed.
- The log file **rotates** at 5 MB, keeping 5 old files, so it can't fill the disk.
- Everything tunable from `.env`; nothing new to `pip install`.

---

## Step 1 — settings (`app/config.py`)

Logging should be configurable without editing code, so it goes in `Settings`
like everything else. Added at the bottom of the class:

```python
    # --- logging ----------------------------------------------------------
    log_level: str = "INFO"
    log_dir: str = "logs"
    log_to_file: bool = True
    log_file_max_bytes: int = 5 * 1024 * 1024   # 5 MB, then it rotates
    log_file_backups: int = 5                   # thinktank.log.1 … .5
    log_sql: bool = False
```

`pydantic-settings` maps these to `LOG_LEVEL`, `LOG_DIR`, `LOG_SQL` … in `.env`
automatically. The defaults are sensible, so **the app runs without touching
`.env` at all**.

## Step 2 — the logging setup (`app/logging_config.py`) — new file

This is the only place that decides *where lines go and what they look like*.
Three things happen in it:

1. **`request_id_var`** — a `ContextVar` holding the id of the request being
   handled right now. A ContextVar, not a global, because two requests can be
   in flight at once and a global would let them overwrite each other.
2. **`RequestIdFilter`** — a `logging.Filter` that stamps `request_id` onto
   every record. It always returns `True`; a filter is just the documented hook
   for *adding* a field. Without it, a log line from any library that knows
   nothing about request ids would crash the formatter.
3. **`setup_logging()`** — one `dictConfig` call defining:
   - format `time | LEVEL | logger | request-id | message`
   - handlers: console (stdout) + `RotatingFileHandler` on `logs/thinktank.log`
   - loggers: `app` (your code), `uvicorn`, `uvicorn.error`,
     `sqlalchemy.engine`, and a `root` catch-all at WARNING

Two deliberate choices in there:

- **`uvicorn.access` is turned down to WARNING.** Your middleware logs the same
  request with a duration, a status and a user attached. Leave both on and every
  request prints twice.
- **`disable_existing_loggers: False`.** uvicorn creates loggers before your
  code is imported; the default `True` would silence them.

## Step 3 — the request logger (`app/middleware.py`) — new file

`RequestLoggingMiddleware` wraps every request:

- takes `X-Request-ID` from the caller if there is one (so a proxy or the
  frontend can pass an id through), otherwise generates 8 hex characters
- puts it in the ContextVar **before** `call_next`, which is what makes it
  visible to every log line inside the request, and on `request.state`
- times the whole thing with `time.perf_counter()`
- picks the level from the status: **5xx → ERROR, 4xx → WARNING, rest → INFO**,
  so `logs` can be filtered by severity that actually means something
- catches anything that escapes a route, writes `log.exception(...)` — that's
  `error()` plus the traceback — then re-raises
- puts `X-Request-ID` on the response

`QUIET_PATHS = {"/health", "/favicon.ico"}` keeps health checks out of the log;
under a process manager they fire every few seconds and bury everything else.

## Step 4 — wiring it up (`app/main.py`)

Order matters here, in two places.

```python
from app.logging_config import setup_logging
setup_logging()          # before any other import that might log
```

That's why the rest of `main.py`'s imports carry `# noqa: E402` — the linter
wants imports at the top, and here the ordering is the point.

```python
app.add_middleware(CORSMiddleware, ...)
app.add_middleware(RequestLoggingMiddleware)   # added last = runs outermost
```

Starlette runs the **last-added middleware outermost**, so the logger wraps
CORS — a request rejected by CORS still gets a line.

Also added:

- **`@app.exception_handler(RequestValidationError)`** — logs 422s. "The save
  button does nothing" is nearly always a 422 and is otherwise invisible.
- **`@app.exception_handler(Exception)`** — decides what the *browser* sees for
  a 500: a short message plus the request id, never a stack trace. The traceback
  is already in the log; the user just reads you the id.
- a **`lifespan`** context manager logging start and shutdown (the modern
  replacement for `@app.on_event`, which is deprecated).

## Step 5 — who was calling (`app/security.py`)

For `user=3` to appear in the request line, something has to record the user.
One line in `current_user`, right after the user is loaded:

```python
    request.state.user_id = user.id
```

(`request: Request` is added as its first parameter — FastAPI injects it, no
caller changes.) The middleware reads `request.state` **after** the route has
run, which is exactly right: an anonymous or rejected request simply shows
`user=-`.

`require_chairman` also logs a warning when it blocks someone — a member
repeatedly hitting a chairman-only route usually means the frontend is showing
a button it should hide.

## Step 6 — login events (`app/routers/auth.py`)

```python
log = get_logger(__name__)
```

then a `log.warning` on each failure branch and a `log.info` on success.

**Note what is logged and what is not:** the username, because you need to know
whose sign-in failed — never the password, not even a wrong one. A log file is
not the place for anybody's typing. Same rule applies to tokens; don't log the
`Authorization` header.

## Step 7 — `.env.example` and `.gitignore`

New block in `.env.example` documenting the knobs, and `logs/`, `*.log`,
`*.log.*` added to `.gitignore` — log files must never end up in git.

---

## Run it

```bat
cd C:\Users\GK Sai\Downloads\Think Tank\Backend\thinktank-api
uvicorn app.main:app --reload --port 8000
```

You should see, immediately:

```
... | INFO | app.logging | - | Logging ready at INFO — writing to console + logs\thinktank.log
... | INFO | app.main    | - | Think Tank API starting — CORS allows [...]
```

Then hit it from Postman and watch:

| Do this | Expect in the log |
|---|---|
| `POST /api/auth/login` with the right password | `Signed in: <name> (id 1, chairman)` then `POST /api/auth/login -> 200 in …ms` |
| Login with a wrong password | `WARNING … Failed login — wrong password for …` |
| Any call with no token | `WARNING … GET /api/auth/me -> 401` |
| `POST` with a field missing | `WARNING … 422 on POST … Field required` |
| `GET /health` | *nothing* — it's in QUIET_PATHS |

`logs\thinktank.log` should now exist with the same lines.

## Using it in your own code

Top of any module:

```python
from app.logging_config import get_logger
log = get_logger(__name__)
```

Then:

```python
log.info("Idea %s shared with %s members", idea.id, len(member_ids))
log.warning("Task %s reassigned away from %s", task.id, old_owner_id)
try:
    ...
except SomeError:
    log.exception("Could not build the flowchart for idea %s", idea.id)
```

Three habits worth keeping:

1. **`log.info("… %s", value)`, not f-strings.** The formatting is skipped
   entirely if that level is switched off.
2. **`log.exception(...)` only inside an `except` block** — that's what attaches
   the traceback. Elsewhere use `log.error(...)`.
3. **Log the ids, not the objects.** `idea.id` is greppable; a whole model dumped
   into a log line is noise and may contain things that shouldn't be on disk.

Levels, in the order you'll reach for them: `debug` (while you're working),
`info` (something normal and worth knowing happened), `warning` (odd, but
handled), `error` (a request failed), `exception` (a request failed and here's
the stack).

## When you're chasing a bug

```bat
set LOG_LEVEL=DEBUG
set LOG_SQL=true
```

or edit `.env`, then restart. `LOG_SQL=true` prints every statement SQLAlchemy
runs — very loud, so turn it off again once you've found the query.

To find one request in the file:

```bat
findstr "9f3a1c2b" logs\thinktank.log
```

The id comes from the `X-Request-ID` response header — visible in Postman's
response headers, and in the browser's Network tab.

---

## Where this could go next

- **Errors in their own file.** A second handler at `level: ERROR` writing
  `logs/errors.log` — a short file where every line matters.
- **JSON lines** instead of the pipe format, if you ever ship these to a log
  service that wants to parse them.
- **A `TimedRotatingFileHandler`** (one file per day) instead of by size, if
  "what happened on the 8th" is the question you'll ask most.
- **Audit logging in the database** — a table of who did what, queryable and
  showable inside the app. That's a different job from this one: this is for
  you, that's for the chairman.
