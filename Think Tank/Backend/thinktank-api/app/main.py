"""
The Think Tank API.

Run it with:   uvicorn app.main:app --reload --port 8000
Docs at:       http://localhost:8000/docs

The React app talks to this the moment you set VITE_USE_MOCK=false in its
.env — nothing else in the frontend changes.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, ideas, messages, notifications, tasks, team, think_logs

app = FastAPI(
    title="Think Tank API",
    version="1.0.0",
    description="The backend behind the Think Tank board, discussion, tasks and think log.",
)

# The session is a Bearer token in the Authorization header, not a cookie, so
# these are ordinary uncredentialed requests — no allow_credentials needed, and
# a wildcard origin would be legal. Every front end is named anyway, so a page
# on some other origin cannot call this at all.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],   # includes Authorization
)

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