from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.student_portal import _resolve_existing_student


def test_resolve_existing_student_rejects_conflicting_matches() -> None:
    email_student = SimpleNamespace(id=uuid4())
    phone_student = SimpleNamespace(id=uuid4())

    with pytest.raises(ValueError, match="different student records"):
        _resolve_existing_student(email_student, phone_student)


def test_resolve_existing_student_returns_single_match() -> None:
    email_student = SimpleNamespace(id=uuid4())

    assert _resolve_existing_student(email_student, None) is email_student
    assert _resolve_existing_student(None, email_student) is email_student
    assert _resolve_existing_student(email_student, email_student) is email_student
