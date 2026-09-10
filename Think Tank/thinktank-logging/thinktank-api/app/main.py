"""
The Think Tank API.

Run it with:   uvicorn app.main:app --reload --port 8000
Docs at:       http://localhost:8000/docs
Logs at:       the console, and Backend/thinktank-api/logs/thinktank.log

The React app talks to this the moment you set VITE_USE_MOCK=false in its
.env — nothing else in the frontend changes.
"""

# setup_logging() runs before anything else is imported that might log, so the
# very first line uvicorn prints is already formatted and already in the file.
from app.logging_config import setup_logging

setup_logging()

from contextlib import asynccontextmanager                 # noqa: E402

from fastapi import FastAPI, Request                       # noqa: E402
from fastapi.exceptions import RequestValidationError      # noqa: E402
from fastapi.middleware.cors import CORSMiddleware         # noqa: E402
from fastapi.responses import JSONResponse                 # noqa: E402

from app.config import settings                            # noqa: E402
from app.logging_config import get_logger                  # noqa: E402
from app.middleware import RequestLoggingMiddleware        # noqa: E402
from app.routers import (                                  # noqa: E402
    auth,
    ideas,
    messages,
    notifications,
    tasks,
    team,
    think_logs,
)

log = get_logger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Everything before the yield runs once at startup, everything after it
    once at shutdown — so the log always shows a clean start and stop."""
    log.info("Think Tank API starting — CORS allows %s", settings.cors_origin_list)
    yield
    log.info("Think Tank API shutting down")


app = FastAPI(
    title="Think Tank API",
    version="1.0.0",
    description="The backend behind the Think Tank board, discussion, tasks and think log.",
    lifespan=lifespan,
)

# Middleware runs outermost-first, and the last one added is the outermost. The
# logger is added after CORS so it wraps it — a request rejected by CORS still
# gets a log line.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],   # includes Authorization
)
app.add_middleware(RequestLoggingMiddleware)


# --- what happens when something goes wrong ------------------------------


@app.exception_handler(RequestValidationError)
async def on_validation_error(request: Request, exc: RequestValidationError):
    """A 422 means the frontend sent a body the schema refused. FastAPI's own
    reply is fine; we just want it in the log, because "the save button does
    nothing" is nearly always this and nearly always invisible otherwise."""
    log.warning("422 on %s %s — %s", request.method, request.url.path, exc.errors())
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def on_unhandled(request: Request, exc: Exception):
    """Anything a route raised and nobody caught.

    The traceback is already in the log — the middleware wrote it on the way
    out. This only decides what the browser sees: a short message and the
    request id, never a stack trace, so you can ask the user for the id and
    look it up yourself.
    """
    request_id = getattr(request.state, "request_id", "-")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Something went wrong on the server.",
            "request_id": request_id,
        },
    )


# --- routes --------------------------------------------------------------

app.include_router(auth.router)
app.include_router(team.router)
app.include_router(ideas.router)
app.include_router(tasks.router)
app.include_router(think_logs.router)
app.include_router(messages.router)
app.include_router(notifications.router)


@app.get("/health", tags=["meta"])
async def health():
    return {"ok": True}
