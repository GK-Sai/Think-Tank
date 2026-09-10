"""
Proof that the API says what the React app reads.

Every key asserted below is one that an adapter in src/lib/httpApi.js reaches
for. If this passes, switching VITE_USE_MOCK to false cannot blank a screen
because of a renamed field — which is the failure mode that would otherwise
show up one page at a time, in the browser, a week later.

    python verify_contract.py                 # against http://localhost:8000
    python verify_contract.py http://host:port

It writes to the database (posts a comment, assigns a task, sends a message),
so point it at the seeded development database, not anything real.
"""

from __future__ import annotations

import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"

passed, failed = 0, []


def check(label: str, condition: bool, detail: str = "") -> None:
    global passed
    if condition:
        passed += 1
        print(f"  ok   {label}")
    else:
        failed.append(f"{label} — {detail}")
        print(f"  FAIL {label} {('— ' + detail) if detail else ''}")


def keys(label: str, obj: dict, required: set[str]) -> None:
    missing = required - set(obj)
    check(label, not missing, f"missing {sorted(missing)}")


def sign_in(client: httpx.Client, username: str, password: str) -> dict:
    """Sign in and leave the Bearer token on the client.

    This is what the React client does: keep the token and attach it to every
    later request. Returns the whole { access_token, token_type, user } payload.
    """
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    r.raise_for_status()
    data = r.json()
    client.headers["Authorization"] = f"Bearer {data['access_token']}"
    return data


def main() -> int:
    chair = httpx.Client(base_url=BASE, timeout=20)
    member = httpx.Client(base_url=BASE, timeout=20)

    print("\nauth")
    login = sign_in(chair, "chairman", "gk")
    keys("login returns a token and the user", login, {"access_token", "token_type", "user"})
    check("the token is a bearer token", login["token_type"] == "bearer", login["token_type"])
    me = login["user"]
    keys("login returns the session user", me, {"id", "name", "title", "role", "dept", "email", "av"})
    check("the chairman is a chairman", me["role"] == "chairman", me["role"])
    check("the password never leaves the server", "password_hash" not in me and "password" not in me)
    check("/me works off the token alone", chair.get("/api/auth/me").status_code == 200)
    check("a bad password is a 401",
          httpx.post(f"{BASE}/api/auth/login", json={"username": "chairman", "password": "no"}).status_code == 401)
    check("an anonymous call is a 401", httpx.get(f"{BASE}/api/auth/me").status_code == 401)

    ananya = sign_in(member, "ananya", "tt123")["user"]
    check("a member is a member", ananya["role"] == "member")

    print("\nteam")
    team = chair.get("/api/team").json()
    check("every seeded account is listed", len(team) == 8, f"got {len(team)}")
    keys("toMember", team[0], {"id", "name", "dept", "title", "role", "email", "av", "online", "last_seen_at"})
    check("av is [sex, variant]", isinstance(team[0]["av"], list) and len(team[0]["av"]) == 2)
    check("a member cannot add members", member.post("/api/team", json={
        "name": "X Y", "email": "x@y.co", "dept": "HR", "role": "Analyst",
        "avatar_sex": "male", "avatar_variant": 0}).status_code == 403)

    print("\nideas")
    ideas = chair.get("/api/ideas").json()
    check("the chairman sees all seven", len(ideas) == 7, f"got {len(ideas)}")
    keys("toIdea", ideas[0], {
        "id", "title", "tagline", "purpose", "tag", "status", "created", "owner",
        "created_at", "updated_at", "shared_with", "implementation_date", "from_log",
        "dept", "can_comment", "can_edit_idea", "description_type", "description_content",
        "activity", "assignments", "revisions", "comments",
    })

    member_ideas = member.get("/api/ideas").json()
    check("a member does not see the chairman's draft",
          all(i["status"] != "Draft" for i in member_ideas), "a Draft leaked")
    check("a member sees the other six", len(member_ideas) == 6, f"got {len(member_ideas)}")

    detail = chair.get("/api/ideas/106").json()
    keys("owner is nested", detail["owner"], {"id", "name", "role", "av"})
    check("the flowchart survived the round trip",
          len(detail["description_content"]["flowchart"]["shapes"]) == 3)
    check("shared_with carries whole people", all("id" in u for u in detail["shared_with"]))
    check("assignments are the idea's tasks", len(detail["assignments"]) == 2, str(len(detail["assignments"])))
    if detail["revisions"]:
        keys("revision", detail["revisions"][0], {"id", "author", "created_at", "text", "description_type", "description_content"})
    if detail["comments"]:
        keys("comment", detail["comments"][0], {"id", "author", "created_at", "text"})
    if detail["activity"]:
        keys("activity", detail["activity"][0], {"id", "actor", "created_at", "what"})

    print("\nthe discussion is open to everyone")
    posted = member.post("/api/ideas/104/comments", json={"text": "Checking the discussion is open."}).json()
    check("a member may post", posted["comments"][-1]["text"] == "Checking the discussion is open.")
    check("the whole idea comes back", "revisions" in posted and "assignments" in posted)
    comment_id = posted["comments"][-1]["id"]
    edited = member.patch(f"/api/ideas/104/comments/{comment_id}", json={"text": "Edited."}).json()
    check("editing stamps edited_at", edited["comments"][-1]["edited_at"] is not None)
    check("you cannot edit somebody else's message",
          chair.patch(f"/api/ideas/104/comments/{comment_id}", json={"text": "no"}).status_code == 403)
    check("the chairman can remove any comment",
          chair.delete(f"/api/ideas/104/comments/{comment_id}").status_code == 200)

    revised = member.post("/api/ideas/104/revisions", json={
        "description_type": "bulletPoints",
        "description_content": {"flowchart": {"shapes": [], "links": []},
                                "bulletPoints": ["A tighter version.", "Second line."],
                                "paragraph": "", "uploadFile": []},
    }).json()
    check("a member may sharpen the wording", revised["description_type"] == "bulletPoints")
    check("the new version is on the trail", revised["revisions"][-1]["text"].startswith("A tighter version"))
    check("the previous version kept its own description",
          revised["revisions"][-2]["description_type"] is not None)

    print("\nthe chairman's decisions")
    check("a member cannot open an idea", member.post("/api/ideas", json={
        "tagline": "Nope", "purpose": "", "dept": "HR", "description_type": "paragraph",
        "description_content": {"paragraph": "x"}}).status_code == 403)
    check("a member cannot set a status",
          member.patch("/api/ideas/104", json={"status": "Approved"}).status_code == 403)
    check("a member cannot share a project",
          member.post("/api/ideas/104/share", json={"member_ids": [5]}).status_code == 403)

    dated = chair.patch("/api/ideas/104", json={"implementation_date": "2026-12-01"}).json()
    check("scheduling an idea approves it", dated["status"] == "Approved", dated["status"])
    check("the date is a plain YYYY-MM-DD", dated["implementation_date"] == "2026-12-01")

    shared = chair.post("/api/ideas/104/share", json={"member_ids": [5, 6]}).json()
    check("sharing names the people", {u["id"] for u in shared["shared_with"]} == {5, 6})
    check("sharing is written to the history",
          any("shared this project" in a["what"] for a in shared["activity"]))

    created = chair.post("/api/ideas", json={
        "tagline": "A contract-test idea", "purpose": "Written by verify_contract.py.",
        "dept": "Marketing", "status": "Under Review",
        "description_type": "paragraph",
        "description_content": {"flowchart": {"shapes": [], "links": []}, "bulletPoints": [""],
                                "paragraph": "The body of it.", "uploadFile": []},
        "shared_with": [],
    }).json()
    check("a new idea is tagged from its department", created["tag"] == "Marketing", created["tag"])
    check("it opens with one version", len(created["revisions"]) == 1)
    new_idea_id = created["id"]

    print("\ntasks")
    stats = chair.get("/api/tasks/stats").json()
    keys("stats", stats, {"total", "completed", "overdue", "pending"})
    check("overdue is counted from the due date", stats["overdue"] >= 1, str(stats))

    all_tasks = chair.get("/api/tasks").json()
    real = [t for t in all_tasks if not str(t["id"]).startswith("impl-")]
    milestones = [t for t in all_tasks if str(t["id"]).startswith("impl-")]
    keys("toTask", real[0], {
        "id", "title", "description", "dept", "owner", "assigned_by", "idea_id",
        "log_id", "log_title", "start_at", "created_at", "time", "due", "status", "priority",
    })
    check("start_at begins with its own calendar day",
          real[0]["start_at"][:10] == real[0]["start_at"][:10] and len(real[0]["start_at"]) > 10)
    check("time is a clock label", real[0]["time"][2] == ":" and real[0]["time"][-2:] in ("AM", "PM"),
          real[0]["time"])
    check("implementation dates appear as milestones", len(milestones) >= 3, str(len(milestones)))
    keys("milestone", milestones[0], {"id", "title", "due", "start_at", "time", "status", "priority", "milestone"})

    mine = member.get("/api/tasks").json()
    mine_real = [t for t in mine if not str(t["id"]).startswith("impl-")]
    check("a member sees only their own work",
          all(t["owner"]["id"] == ananya["id"] for t in mine_real), "somebody else's task leaked")

    assigned = chair.post("/api/tasks", json={
        "title": "Contract test assignment", "description": "One per person.",
        "due": "2026-12-31", "priority": "High", "member_ids": [4, 5], "dept_names": [],
        "idea_id": new_idea_id, "log_id": None, "log_title": "", "start_at": None,
    }).json()
    check("one row per person", len(assigned) == 2, str(len(assigned)))
    check("a task's department follows its owner",
          {t["dept"] for t in assigned} == {"I.T Department", "Marketing"}, str([t["dept"] for t in assigned]))
    check("a member cannot assign work", member.post("/api/tasks", json={
        "title": "no", "member_ids": [2], "due": "2026-12-31"}).status_code == 403)

    moved = member.patch(f"/api/tasks/{assigned[0]['id']}", json={"status": "Completed"}).json()
    check("you may complete your own task", moved["status"] == "Completed")
    check("a milestone cannot be edited here",
          chair.patch("/api/tasks/impl-102", json={"status": "Completed"}).status_code == 400)

    print("\nthink log")
    logs = chair.get("/api/think-logs").json()
    check("the chairman's four notes are there", len(logs) == 4, str(len(logs)))
    # `owner` and `sample` are here because toLog reads them: the past-logs
    # list and the log dialog both print who wrote the note beside its date.
    keys("toLog", logs[0], {"id", "date", "created_at", "title", "points", "owner", "sample"})
    keys("log owner", logs[0]["owner"], {"id", "name", "role"})
    keys("point", logs[0]["points"][0], {"id", "text", "states"})
    check("states is a list", isinstance(logs[0]["points"][0]["states"], list))
    check("a member reads the chairman's log too", len(member.get("/api/think-logs").json()) == 4)
    check("search narrows it", len(chair.get("/api/think-logs", params={"q": "referrals"}).json()) == 1)

    point_id = next(p["id"] for l in logs for p in l["points"] if not p["states"])
    marked = chair.patch(f"/api/think-logs/points/{point_id}", params={"state": "idea"}).json()
    states = next(p["states"] for p in marked["points"] if p["id"] == point_id)
    check("a point becomes an idea", states == ["idea"], str(states))
    marked = chair.patch(f"/api/think-logs/points/{point_id}", params={"state": "task"}).json()
    states = next(p["states"] for p in marked["points"] if p["id"] == point_id)
    check("and a task as well, without losing the first", set(states) == {"idea", "task"}, str(states))
    check("a member cannot action a point",
          member.patch(f"/api/think-logs/points/{point_id}", params={"state": "idea"}).status_code == 403)

    own = member.post("/api/think-logs", json={
        "points": [{"text": "My own note.\nSecond line.", "states": []}], "title": None}).json()
    check("the title is the first line of the first point", own["title"] == "My own note.")
    renamed = member.patch(f"/api/think-logs/points/{own['points'][0]['id']}",
                           json={"text": "Reworded note.\nStill here."}).json()
    check("rewording the first point renames the log", renamed["title"] == "Reworded note.")
    check("you cannot edit somebody else's log",
          chair.patch(f"/api/think-logs/points/{own['points'][0]['id']}",
                      json={"text": "no"}).status_code == 403)

    print("\nmessages")
    threads = chair.get("/api/messages").json()
    keys("toThread", threads[0], {"with", "last_text", "last_mine", "last_at", "unread", "messages"})
    keys("the person on the other side", threads[0]["with"], {"id", "name", "role", "av", "online", "last_seen_at"})

    sent = chair.post("/api/messages/4", json={"text": "Contract test message."}).json()
    check("the thread comes back with the message", sent["messages"][-1]["text"] == "Contract test message.")
    check("mine is worked out per reader", sent["messages"][-1]["mine"] is True)
    check("you cannot message yourself",
          chair.post("/api/messages/1", json={"text": "hello me"}).status_code == 400)

    unread_before = member.get("/api/messages/unread-count").json()
    keys("unread-count", unread_before, {"count"})
    check("the message is unread for the recipient", unread_before["count"] >= 1, str(unread_before))
    opened = member.get("/api/messages/1").json()
    check("mine flips for the other reader", opened["messages"][-1]["mine"] is False)
    check("opening a thread marks it read",
          member.get("/api/messages/unread-count").json()["count"] < unread_before["count"])

    print("\nnotifications")
    notifs = member.get("/api/notifications").json()
    keys("toNotif", notifs[0], {"id", "icon", "title", "created_at", "link", "unread", "reminder"})
    check("assigning work notifies the assignee",
          any("Contract test assignment" in n["title"] for n in notifs))
    check("a message notifies the recipient", any(n["icon"] == "team" for n in notifs))
    check("editing an idea notifies nobody",
          not any("updated the idea" in n["title"] for n in notifs))
    check("the unread tab filters",
          all(n["unread"] for n in member.get("/api/notifications", params={"tab": "unread"}).json()))
    check("the reminders tab filters",
          all(n["reminder"] for n in member.get("/api/notifications", params={"tab": "reminders"}).json()))
    check("search filters",
          len(member.get("/api/notifications", params={"q": "Contract test"}).json()) >= 1)

    one = member.post(f"/api/notifications/{notifs[0]['id']}/read").json()
    check("marking one read returns it", one["unread"] is False)
    check("you cannot read somebody else's notification",
          chair.post(f"/api/notifications/{notifs[0]['id']}/read").status_code == 404)
    member.post("/api/notifications/read-all")
    check("read-all clears the badge", member.get("/api/notifications/unread-count").json()["count"] == 0)

    print("\ncleaning up after myself")
    for t in assigned:
        chair.delete(f"/api/tasks/{t['id']}")
    chair.delete(f"/api/ideas/{new_idea_id}")
    member.delete(f"/api/think-logs/{own['id']}")
    check("the test idea is gone", chair.get(f"/api/ideas/{new_idea_id}").status_code == 404)

    check("logging out is accepted", chair.post("/api/auth/logout").status_code == 200)
    # Nothing is revoked server-side — discarding the token is the sign-out,
    # which is exactly what httpApi.js does in its `finally`.
    chair.headers.pop("Authorization", None)
    check("and without the token the session is gone", chair.get("/api/auth/me").status_code == 401)

    print(f"\n{passed} passed, {len(failed)} failed")
    for f in failed:
        print(f"  · {f}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
