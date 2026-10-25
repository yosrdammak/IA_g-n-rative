import os
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from alembic import command
from alembic.config import Config

# Never touch the user's configured development database.
_test_dir = TemporaryDirectory(prefix="smartcampus-tests-")
os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(_test_dir.name) / "test.db")
os.environ["JWT_SECRET"] = "isolated-test-secret-not-used-outside-tests"
os.environ["SEED_DEMO"] = "false"
os.environ["CHAT_PROVIDER"] = "catalogue"
os.environ["DEMO_PASSWORD"] = "DemoCampus2026!"

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.seed import seed_demo


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option(
        "script_location", str(Path(__file__).resolve().parents[1] / "alembic")
    )
    command.upgrade(config, "head")
    yield
    engine.dispose()
    _test_dir.cleanup()


@pytest.fixture()
def client(migrated_database):
    with engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())
    with SessionLocal() as db:
        seed_demo(db)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def candidate(client):
    return login(client, "candidat@demo.tn")


@pytest.fixture()
def admin(client):
    return login(client, "admin@demo.tn")


def login(client, email):
    response = client.post(
        "/api/auth/login", json={"email": email, "password": "DemoCampus2026!"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}
