"""
Logging for the API: one place that decides where log lines go and what they
look like.

Two destinations, always the same lines in both:

  * the console you started uvicorn in — colourless, short, for watching live
  * logs/thinktank.log — rotated at 5 MB, five old files kept, so the folder
    never grows without limit and yesterday's run is still there tomorrow

Every line carries a request id, so when somebody says "it broke when I opened
the idea page" you can grep one id and see that request and nothing else.

Call `setup_logging()` once, before the app starts serving. `app.main` does it
at import time.
"""

from __future__ import annotations

import logging
import logging.config
from contextvars import ContextVar
from pathlib import Path

from app.config import settings

# The id of the request being handled right now. The middleware sets it; this
# is a ContextVar rather than a global so two requests in flight at once do not
# overwrite each other's value.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    """Puts `request_id` on every record so the formatter can print it.

    A filter that always returns True is the documented way to *add* a field
    rather than to drop records — without this, any log line from a library
    that knows nothing about request ids would blow up the formatter.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


# The log folder has to exist before RotatingFileHandler opens the file.
LOG_DIR = Path(settings.log_dir)
if settings.log_to_file:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "thinktank.log"

# 2026-09-08 10:12:33 | INFO     | app.routers.ideas | 9f3a1c2b | Idea 12 shared
LINE = "%(asctime)s | %(levelname)-8s | %(name)s | %(request_id)s | %(message)s"


def _config() -> dict:
    handlers: dict[str, dict] = {
        "console": {
            "class": "logging.StreamHandler",
            "level": settings.log_level,
            "formatter": "line",
            "filters": ["request_id"],
            "stream": "ext://sys.stdout",
        }
    }

    if settings.log_to_file:
        handlers["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "level": settings.log_level,
            "formatter": "line",
            "filters": ["request_id"],
            "filename": str(LOG_FILE),
            "maxBytes": settings.log_file_max_bytes,
            "backupCount": settings.log_file_backups,
            "encoding": "utf-8",
        }

    active = list(handlers)

    return {
        "version": 1,
        # Loggers created before this runs (uvicorn makes some very early)
        # keep working instead of going silent.
        "disable_existing_loggers": False,
        "filters": {"request_id": {"()": RequestIdFilter}},
        "formatters": {"line": {"format": LINE, "datefmt": "%Y-%m-%d %H:%M:%S"}},
        "handlers": handlers,
        "loggers": {
            # Our own code. Everything under app.* inherits this.
            "app": {"level": settings.log_level, "handlers": active, "propagate": False},
            # uvicorn's startup/shutdown notices and its tracebacks.
            "uvicorn": {"level": "INFO", "handlers": active, "propagate": False},
            "uvicorn.error": {"level": "INFO", "handlers": active, "propagate": False},
            # uvicorn.access is switched off on purpose: our middleware logs
            # the same request with a duration, a status and a user attached.
            # Leaving both on prints every request twice.
            "uvicorn.access": {"level": "WARNING", "handlers": active, "propagate": False},
            # SQLAlchemy talks a lot. LOG_SQL=true in .env turns the queries on
            # when you are chasing something; off, only its warnings show.
            "sqlalchemy.engine": {
                "level": "INFO" if settings.log_sql else "WARNING",
                "handlers": active,
                "propagate": False,
            },
        },
        # Anything else (alembic, asyncpg, third-party libraries) lands here.
        "root": {"level": "WARNING", "handlers": active},
    }


def setup_logging() -> None:
    logging.config.dictConfig(_config())
    log = logging.getLogger("app.logging")
    where = f"console + {LOG_FILE}" if settings.log_to_file else "console only"
    log.info("Logging ready at %s — writing to %s", settings.log_level, where)


def get_logger(name: str) -> logging.Logger:
    """`log = get_logger(__name__)` at the top of any module.

    Names are forced under `app.` so a module that gets imported oddly still
    picks up the configuration above instead of falling through to root.
    """
    return logging.getLogger(name if name.startswith("app") else f"app.{name}")
