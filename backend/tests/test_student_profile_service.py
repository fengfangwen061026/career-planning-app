from types import SimpleNamespace
from uuid import uuid4

from app.services.student_profile import (
    normalize_student_profile_json,
    repair_student_profile_record,
    serialize_student_profile,
)


def _student_stub():
    return SimpleNamespace(
        id=uuid4(),
        name="Test Student",
        email="student@example.com",
        phone="13800138000",
        location="Wuhan",
        job_intention="Backend Engineer",
    )


def _profile_stub(profile_json, completeness_score=0.7, evidence_json=None):
    return SimpleNamespace(
        id=uuid4(),
        student_id=uuid4(),
        profile_json=profile_json,
        completeness_score=completeness_score,
        evidence_json=evidence_json or {},
        version="1.0",
        created_at=None,
        updated_at=None,
    )


def test_normalize_student_profile_json_handles_legacy_shape():
    student = _student_stub()
    legacy = {
        "major": "Computer Science",
        "education_level": "Bachelor",
        "graduation_year": 2026,
        "skills": [{"name": "Python", "category": "Programming", "proficiency": "熟练"}],
        "soft_skills": {"communication": 85},
        "certificate_names": ["CET-6"],
        "self_evaluation": "Fast learner",
    }

    normalized = normalize_student_profile_json(legacy, student)

    assert normalized["basic_info"]["name"] == "Test Student"
    assert normalized["basic_info"]["major"] == "Computer Science"
    assert normalized["basic_info"]["degree"] == "Bachelor"
    assert normalized["education"][0]["end_year"] == 2026
    assert normalized["dimensions"]["professional_skills"][0]["skill_name"] == "Python"
    assert normalized["dimensions"]["soft_competencies"]["communication"] == 0.85
    assert normalized["certificate_names"] == ["CET-6"]


def test_repair_student_profile_record_normalizes_data_and_missing_suggestions():
    student = _student_stub()
    profile = _profile_stub(
        {
            "major": "Computer Science",
            "education_level": "Bachelor",
            "skills": [{"name": "Python"}],
        },
        completeness_score=0.7,
        evidence_json={},
    )

    changed = repair_student_profile_record(profile, student)

    assert changed is True
    assert profile.profile_json["basic_info"]["email"] == "student@example.com"
    assert profile.profile_json["education"][0]["major"] == "Computer Science"
    assert profile.completeness_score > 1
    assert profile.evidence_json["missing_suggestions"]


def test_serialize_student_profile_returns_normalized_payload():
    student = _student_stub()
    profile = _profile_stub(
        {
            "major": "Computer Science",
            "education_level": "Bachelor",
            "skills": [{"name": "Python"}],
            "missing_suggestions": ["Add projects"],
        },
        completeness_score=0.5,
    )

    serialized = serialize_student_profile(profile, student)

    assert serialized["profile_json"]["basic_info"]["name"] == "Test Student"
    assert serialized["profile_json"]["basic_info"]["major"] == "Computer Science"
    assert serialized["completeness_score"] > 1
    assert serialized["missing_suggestions"] == ["Add projects"]


def test_serialize_student_profile_recomputes_unreadable_missing_suggestions():
    student = _student_stub()
    profile = _profile_stub(
        {
            "major": "Computer Science",
            "education_level": "Bachelor",
            "skills": [{"name": "Python"}],
        },
        completeness_score=0.5,
        evidence_json={"missing_suggestions": ["寤鸿\ue185娣诲姞瀹炰範缁忓巻"]},
    )

    serialized = serialize_student_profile(profile, student)

    assert "建议添加实习经历" in serialized["missing_suggestions"]
    assert all("�" not in item for item in serialized["missing_suggestions"])
