"""
The middleware that logs one line per request.

It sits outside every route, so it sees the request before FastAPI has parsed
anything and the response after the route has finished — which is how it can
time the whole thing and still know the status code.

What it writes:

    POST /api/ideas -> 201 in 34.2ms user=3 ip=127.0.0.1

and, when a route raises something nobody caught, the same line at ERROR with
the full traceback under it.

It also puts an `X-Request-ID` header on every response. Copy that id out of
the browser's network tab, grep it in logs/thinktank.log, and you have exactly
the lines for that one click.
"""

from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.logging_config import get_logger, request_id_var

log = get_logger("app.request")

# Health checks fire every few seconds under a process manager and would bury
# everything else. Add any other noise here.
QUIET_PATHS = {"/health", "/favicon.ico"}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Honour an id the caller already generated (a reverse proxy or the
        # frontend may set one) so a single id follows the request across
        # everything; otherwise make one. Eight characters is plenty to grep.
        incoming = request.headers.get("X-Request-ID")
        request_id = (incoming or uuid.uuid4().hex)[:8]

        # Set on the ContextVar so every log line from inside this request
        # carries the id without anyone having to pass it around, and on
        # request.state so route code can read it too.
        token = request_id_var.set(request_id)
        request.state.request_id = request_id

        started = time.perf_counter()
        quiet = request.url.path in QUIET_PATHS

        try:
            response = await call_next(request)
        except Exception as exc:
            took = (time.perf_counter() - started) * 1000
            # Starlette re-raises our exception from inside its own
            # `except EndOfStream:` block, so Python would print that plumbing
            # above the real traceback. This hides it; the actual error and its
            # own `raise ... from ...` chain are untouched.
            exc.__suppress_context__ = True
            # .exception() is .error() plus the traceback of whatever is being
            # handled right now — the one place the stack actually gets saved.
            log.exception(
                "%s %s -> 500 in %.1fms %s — unhandled exception",
                request.method,
                request.url.path,
                took,
                _who(request),
            )
            request_id_var.reset(token)
            raise

        took = (time.perf_counter() - started) * 1000
        response.headers["X-Request-ID"] = request_id

        if not quiet:
            # 5xx is our fault, 4xx is usually the caller's, everything else is
            # routine — the level makes them filterable.
            level = (
                log.error
                if response.status_code >= 500
                else log.warning
                if response.status_code >= 400
                else log.info
            )
            level(
                "%s %s -> %d in %.1fms %s",
                request.method,
                request.url.path,
                response.status_code,
                took,
                _who(request),
            )

        request_id_var.reset(token)
        return response


def _who(request: Request) -> str:
    """user=… ip=… — the user id is only there once `current_user` has run,
    which is exactly right: an anonymous or rejected request has no user."""
    user_id = getattr(request.state, "user_id", None)
    client = request.client.host if request.client else "?"
    return f"user={user_id or '-'} ip={client}"
