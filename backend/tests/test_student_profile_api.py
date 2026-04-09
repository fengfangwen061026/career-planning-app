from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api.students import batch_get_student_profiles, get_student_profile_current
from app.schemas.student import StudentProfileBatchRequest


def _student_stub(**overrides):
    return SimpleNamespace(
        id=overrides.get("id", uuid4()),
        name=overrides.get("name", "Test Student"),
        email=overrides.get("email", "student@example.com"),
        phone=overrides.get("phone", "13800138000"),
        location=overrides.get("location", "Wuhan"),
        job_intention=overrides.get("job_intention", "Backend Engineer"),
    )


def _profile_stub(student_id, profile_json, completeness_score=0.7, evidence_json=None):
    return SimpleNamespace(
        id=uuid4(),
        student_id=student_id,
        profile_json=profile_json,
        completeness_score=completeness_score,
        evidence_json=evidence_json or {},
        version="1.0",
        created_at=None,
        updated_at=None,
    )


class _FakeScalarResult:
    def __init__(self, values):
        self._values = list(values)

    def first(self):
        return self._values[0] if self._values else None

    def all(self):
        return list(self._values)


class _FakeExecuteResult:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        return _FakeScalarResult(self._values)


class _FakeDB:
    def __init__(self, students, execute_results):
        self._students = students
        self._execute_results = iter(execute_results)
        self.flush_called = False

    async def get(self, _model, key):
        return self._students.get(key)

    async def execute(self, _stmt):
        return next(self._execute_results)

    async def flush(self):
        self.flush_called = True


@pytest.mark.asyncio
async def test_get_student_profile_current_returns_saved_profile():
    student = _student_stub()
    profile = _profile_stub(
        student.id,
        {
            "major": "Computer Science",
            "education_level": "Bachelor",
            "skills": [{"name": "Python"}],
        },
        completeness_score=0.7,
    )
    db = _FakeDB(
        students={student.id: student},
        execute_results=[_FakeExecuteResult([profile])],
    )

    response = await get_student_profile_current(student.id, db)

    assert response.student_id == student.id
    assert response.profile_json["basic_info"]["name"] == "Test Student"
    assert response.profile_json["basic_info"]["major"] == "Computer Science"
    assert response.completeness_score > 1
    assert db.flush_called is True


@pytest.mark.asyncio
async def test_batch_get_student_profiles_returns_existing_profiles():
    student_with_profile = _student_stub(name="With Profile")
    student_without_profile = _student_stub(name="Without Profile")
    profile = _profile_stub(
        student_with_profile.id,
        {
            "major": "Software Engineering",
            "education_level": "Bachelor",
            "skills": [{"name": "TypeScript"}],
        },
        completeness_score=0.6,
    )
    db = _FakeDB(
        students={
            student_with_profile.id: student_with_profile,
            student_without_profile.id: student_without_profile,
        },
        execute_results=[
            _FakeExecuteResult([profile]),
            _FakeExecuteResult([student_with_profile, student_without_profile]),
        ],
    )

    result = await batch_get_student_profiles(
        StudentProfileBatchRequest(
            student_ids=[student_with_profile.id, student_without_profile.id]
        ),
        db,
    )

    profiles = result["profiles"]
    assert profiles[0] is not None
    assert profiles[0].student_id == student_with_profile.id
    assert profiles[0].profile_json["basic_info"]["name"] == "With Profile"
    assert profiles[1] is None
    assert db.flush_called is True
