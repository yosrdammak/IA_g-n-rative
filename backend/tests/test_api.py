from datetime import datetime, timedelta, timezone
import json

import httpx
from jose import jwt
from app.database import SessionLocal
from app.models import User, Program, Profile
from app.security import hash_password, token
from app.seed import seed_demo


def apply(client, headers, index=0):
    program = client.get("/api/programs").json()[index]
    response = client.post(
        "/api/applications",
        headers=headers,
        json={"program_id": program["id"], "phone": "+216 20000000", "consent": True},
    )
    assert response.status_code == 201, response.text
    return response.json()


def other_candidate(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "other@example.tn",
            "full_name": "Other User",
            "password": "OtherSecret123!",
        },
    )
    assert response.status_code == 201
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def test_health_and_openapi(client):
    assert client.get("/health").json()["status"] == "ok"
    routes = client.get("/openapi.json").json()["paths"]
    for path in (
        "/api/auth/login",
        "/api/profile",
        "/api/chat",
        "/api/applications",
        "/api/dashboard",
    ):
        assert path in routes


def test_registration_login_profile_and_duplicate(client):
    payload = {
        "email": "NEW@example.tn",
        "full_name": "New User",
        "password": "new-secret123!",
    }
    session = client.post("/api/auth/register", json=payload)
    assert session.status_code == 201
    data = session.json()
    assert data["user"]["email"] == "new@example.tn"
    assert data["user"]["role"] == "candidate"
    assert "password_hash" not in data["user"]
    headers = {"Authorization": "Bearer " + data["access_token"]}
    assert client.get("/api/profile", headers=headers).json()["interests"] == ""
    assert client.get("/api/auth/me", headers=headers).json()["full_name"] == "New User"
    assert (
        client.post(
            "/api/auth/login",
            json={"email": payload["email"], "password": payload["password"]},
        ).status_code
        == 200
    )
    assert client.post("/api/auth/register", json=payload).status_code == 409
    with SessionLocal() as db:
        assert (
            db.query(User).filter_by(email="new@example.tn").one().password_hash
            != payload["password"]
        )


def test_auth_validation_and_no_role_escalation(client):
    payload = {"email": "test@example.tn", "full_name": "Test User", "password": "weak"}
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert "weak" not in response.text
    payload["password"] = "strong-secret"
    payload["role"] = "admin"
    assert client.post("/api/auth/register", json=payload).status_code == 422
    payload.pop("role")
    payload["email"] = "not-an-email"
    assert client.post("/api/auth/register", json=payload).status_code == 422
    payload["email"] = "x@example.tn"
    payload["full_name"] = "  "
    assert client.post("/api/auth/register", json=payload).status_code == 422
    assert (
        client.post(
            "/api/auth/login", json={"email": "candidat@demo.tn", "password": "wrong"}
        ).status_code
        == 401
    )


def test_protected_routes_and_bad_token(client, candidate):
    for path in (
        "/api/profile",
        "/api/applications",
        "/api/conversations",
        "/api/recommendations",
        "/api/dashboard",
    ):
        assert client.get(path).status_code == 401
        assert (
            client.get(path, headers={"Authorization": "Bearer invalid"}).status_code
            == 401
        )
    expired = jwt.encode(
        {"sub": "1", "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
        "isolated-test-secret-not-used-outside-tests",
        algorithm="HS256",
    )
    assert (
        client.get(
            "/api/profile", headers={"Authorization": "Bearer " + expired}
        ).status_code
        == 401
    )
    assert client.get("/api/dashboard", headers=candidate).status_code == 403


def test_profile_recommendations_and_invalid_language(client, candidate):
    payload = {
        "academic_level": "Bac",
        "interests": "intelligence artificielle informatique",
        "goals": "développement logiciel",
        "preferred_language": "tn",
    }
    assert (
        client.put("/api/profile", headers=candidate, json=payload).status_code == 200
    )
    assert client.get("/api/profile", headers=candidate).json() == payload
    ranked = client.get("/api/recommendations", headers=candidate).json()[
        "recommendations"
    ]
    assert "logiciel" in ranked[0]["program"]["name"]
    assert ranked[0]["score"] > 0
    assert ranked[0]["matching_keywords"]
    payload["preferred_language"] = "unsupported"
    assert (
        client.put("/api/profile", headers=candidate, json=payload).status_code == 422
    )


def test_application_validation_duplicate_and_isolation(client, candidate):
    program = client.get("/api/programs").json()[0]["id"]
    data = {"program_id": program, "phone": "+216 20000000", "consent": False}
    assert (
        client.post("/api/applications", headers=candidate, json=data).status_code
        == 422
    )
    data.update(consent=True, program_id=999999)
    assert (
        client.post("/api/applications", headers=candidate, json=data).status_code
        == 404
    )
    data["program_id"] = program
    response = client.post("/api/applications", headers=candidate, json=data)
    assert response.status_code == 201
    assert response.json()["status"] == "submitted"
    assert (
        client.post("/api/applications", headers=candidate, json=data).status_code
        == 409
    )
    assert len(client.get("/api/applications", headers=candidate).json()) == 1
    assert client.get("/api/applications", headers=other_candidate(client)).json() == []


def test_chat_history_and_ownership(client, candidate):
    result = client.post(
        "/api/chat",
        headers=candidate,
        json={"message": "Quelle formation en informatique ?"},
    ).json()
    assert result["mode"] == "catalogue"
    assert "[Démo]" in result["reply"]
    conversation_id = result["conversation_id"]
    response = client.post(
        "/api/chat",
        headers=candidate,
        json={"message": "Comment candidater ?", "conversation_id": conversation_id},
    )
    assert response.status_code == 200
    assert response.json()["conversation_id"] == conversation_id
    history = client.get("/api/conversations", headers=candidate).json()
    assert len(history) == 1
    assert len(history[0]["messages"]) == 4
    stranger = other_candidate(client)
    assert client.get("/api/conversations", headers=stranger).json() == []
    assert (
        client.post(
            "/api/chat",
            headers=stranger,
            json={"message": "Bonjour", "conversation_id": conversation_id},
        ).status_code
        == 404
    )
    assert (
        client.post("/api/chat", headers=candidate, json={"message": "   "}).status_code
        == 422
    )


def test_chat_ollama_protocol_and_history(client, candidate, monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "ollama")
    requests = []

    def handler(request):
        requests.append((str(request.url), json.loads(request.content)))
        return httpx.Response(200, json={"message": {"content": "Réponse IA de test"}})

    original_client = httpx.Client
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: original_client(
            transport=httpx.MockTransport(handler), **kwargs
        ),
    )
    first = client.post(
        "/api/chat", headers=candidate, json={"message": "Formation informatique ?"}
    )
    assert first.json()["mode"] == "ollama"
    second = client.post(
        "/api/chat",
        headers=candidate,
        json={
            "message": "Et les prérequis ?",
            "conversation_id": first.json()["conversation_id"],
        },
    )
    assert second.json()["reply"] == "Réponse IA de test"
    assert requests[1][0].endswith("/api/chat")
    assert requests[1][1]["stream"] is False
    assert [m["role"] for m in requests[1][1]["messages"]] == [
        "system",
        "user",
        "assistant",
        "user",
    ]
    assert "[Démo]" in requests[1][1]["messages"][0]["content"]


def test_ollama_failure_falls_back(client, candidate, monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "ollama")

    def unavailable(*args, **kwargs):
        raise httpx.ConnectError("Service unavailable")

    original_client = httpx.Client
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: original_client(
            transport=httpx.MockTransport(unavailable), **kwargs
        ),
    )
    result = client.post(
        "/api/chat", headers=candidate, json={"message": "Bonjour"}
    ).json()
    assert result["mode"] == "catalogue_fallback"
    assert "indisponible" in result["reply"]


def test_quiz_submission_ownership_and_appointment(client, candidate):
    application = apply(client, candidate)
    path = f"/api/applications/{application['id']}"
    quiz = client.post(path + "/quiz", headers=candidate).json()
    assert all("answer" not in question for question in quiz["questions"])
    submit = f"/api/quizzes/{quiz['id']}/submit"
    stranger = other_candidate(client)
    assert (
        client.post(submit, headers=stranger, json={"answers": [0, 1, 0]}).status_code
        == 404
    )
    assert (
        client.post(submit, headers=candidate, json={"answers": [99, 1, 0]}).status_code
        == 422
    )
    assert (
        client.post(submit, headers=candidate, json={"answers": [0, 1, 0]}).json()[
            "score"
        ]
        == 3
    )
    assert (
        client.post(submit, headers=candidate, json={"answers": [0, 1, 0]}).status_code
        == 409
    )
    assert (
        client.post(
            path + "/appointment",
            headers=candidate,
            json={"scheduled_at": "2020-01-01T12:00:00Z"},
        ).status_code
        == 422
    )
    future = datetime.now(timezone.utc) + timedelta(days=7)
    assert (
        client.post(
            path + "/appointment",
            headers=candidate,
            json={"scheduled_at": future.replace(tzinfo=None).isoformat()},
        ).status_code
        == 422
    )
    assert (
        client.post(
            path + "/appointment",
            headers=stranger,
            json={"scheduled_at": future.isoformat()},
        ).status_code
        == 404
    )
    assert (
        client.post(
            path + "/appointment",
            headers=candidate,
            json={"scheduled_at": future.isoformat()},
        ).json()["status"]
        == "requested"
    )
    assert (
        client.post(
            path + "/appointment",
            headers=candidate,
            json={"scheduled_at": future.isoformat()},
        ).status_code
        == 409
    )


def test_admin_program_publication_and_dashboard(client, candidate, admin):
    program = {
        "name": "Nouvelle formation",
        "institution": "ISB",
        "category": "Licence",
        "published": False,
    }
    assert (
        client.post("/api/admin/programs", headers=candidate, json=program).status_code
        == 403
    )
    created = client.post("/api/admin/programs", headers=admin, json=program)
    assert created.status_code == 201
    program_id = created.json()["id"]
    assert program_id not in [p["id"] for p in client.get("/api/programs").json()]
    assert (
        client.post(
            "/api/applications",
            headers=candidate,
            json={"program_id": program_id, "phone": "20000000", "consent": True},
        ).status_code
        == 404
    )
    program["published"] = True
    assert (
        client.put(
            f"/api/admin/programs/{program_id}", headers=admin, json=program
        ).status_code
        == 200
    )
    assert program_id in [p["id"] for p in client.get("/api/programs").json()]
    apply(client, candidate)
    dashboard = client.get("/api/dashboard", headers=admin).json()
    assert dashboard["total_applications"] == 1
    assert dashboard["status_counts"] == {"submitted": 1}


def test_academic_role_is_scoped(client, candidate):
    for index in range(4):
        apply(client, candidate, index)
    with SessionLocal() as db:
        academic = User(
            email="academic@iit.tn",
            full_name="IIT Staff",
            role="academic_iit",
            password_hash=hash_password("testpassword"),
        )
        db.add(academic)
        db.commit()
        headers = {"Authorization": "Bearer " + token(academic)}
    assert (
        client.get("/api/dashboard", headers=headers).json()["total_applications"] == 2
    )
    assert all(
        p["institution"] == "IIT"
        for p in client.get("/api/admin/programs", headers=headers).json()
    )
    assert (
        client.post(
            "/api/admin/programs",
            headers=headers,
            json={"name": "Outside scope", "institution": "ISB", "category": "Licence"},
        ).status_code
        == 403
    )


def test_demo_seed_is_idempotent(client):
    with SessionLocal() as db:
        before = db.query(User).filter_by(email="candidat@demo.tn").one().password_hash
        seed_demo(db)
        assert db.query(User).count() == 2
        assert db.query(Profile).count() == 2
        assert db.query(Program).count() == 4
        assert (
            db.query(User).filter_by(email="candidat@demo.tn").one().password_hash
            == before
        )


def test_cors_frontend(client):
    response = client.options(
        "/api/profile",
        headers={
            "Origin": "http://localhost:5174",
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5174"
