"""Post-processing: fill evidence fields from raw_text using keyword search."""

CONTEXT_BEFORE = 10
CONTEXT_AFTER = 60


def fill_evidence(raw_text: str, keyword: str) -> str:
    """从 raw_text 中定位 keyword，截取上下文作为 evidence。"""
    if not keyword or not raw_text:
        return ""
    idx = raw_text.find(keyword)
    if idx == -1:
        short = keyword[:4]
        if len(short) >= 2:
            idx = raw_text.find(short)
    if idx == -1:
        return ""
    start = max(0, idx - CONTEXT_BEFORE)
    end = min(len(raw_text), idx + CONTEXT_AFTER)
    return raw_text[start:end].strip()


def fill_parse_result_evidence(parsed: dict, raw_text: str) -> dict:
    """遍历解析结果，对所有 evidence 为空的字段做后处理补填。

    只补填空值，不覆盖 LLM 已生成的非空 evidence。
    """
    if not raw_text:
        return parsed

    for edu in parsed.get("education", []):
        if not edu.get("evidence"):
            edu["evidence"] = fill_evidence(raw_text, edu.get("school", ""))

    for exp in parsed.get("experience", []):
        if not exp.get("evidence"):
            kw = exp.get("company") or exp.get("role") or ""
            exp["evidence"] = fill_evidence(raw_text, kw)

    for proj in parsed.get("projects", []):
        if not proj.get("evidence"):
            proj["evidence"] = fill_evidence(raw_text, proj.get("name", ""))

    for skill in parsed.get("skills", []):
        if not skill.get("evidence"):
            skill["evidence"] = fill_evidence(raw_text, skill.get("name", ""))

    for cert in parsed.get("certificates", []):
        if not cert.get("evidence"):
            cert["evidence"] = fill_evidence(raw_text, cert.get("name", ""))

    for award in parsed.get("awards", []):
        if not award.get("evidence"):
            award["evidence"] = fill_evidence(raw_text, award.get("name", ""))

    return parsed
