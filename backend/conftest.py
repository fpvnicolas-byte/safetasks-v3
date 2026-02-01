import os
from urllib.parse import urlparse

import pytest


PROD_DB_URI = os.getenv("SQLALCHEMY_DATABASE_URI")
TEST_DB_URI = os.getenv("TEST_DATABASE_URI")

if TEST_DB_URI:
    # Ensure the app config points to the test database during pytest runs.
    os.environ["SQLALCHEMY_DATABASE_URI"] = TEST_DB_URI


def pytest_sessionstart(session):
    if not TEST_DB_URI:
        pytest.exit(
            "TEST_DATABASE_URI not set; skipping DB tests to avoid polluting the main database.",
            returncode=0,
        )

    if PROD_DB_URI and TEST_DB_URI == PROD_DB_URI:
        pytest.exit(
            "TEST_DATABASE_URI matches SQLALCHEMY_DATABASE_URI; refusing to run tests.",
            returncode=1,
        )

    db_name = urlparse(TEST_DB_URI).path.lstrip("/")
    if "test" not in db_name and os.getenv("ALLOW_NON_TEST_DB") != "1":
        pytest.exit(
            "TEST_DATABASE_URI does not look like a test database (name missing 'test'). "
            "Set ALLOW_NON_TEST_DB=1 to override.",
            returncode=1,
        )
