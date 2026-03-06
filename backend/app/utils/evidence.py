"""Evidence chain utilities - tracks evidence for AI conclusions."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4


@dataclass
class Evidence:
    """Evidence for an AI conclusion."""
    id: UUID = field(default_factory=uuid4)
    source: str = ""  # e.g., "resume", "job_description", "ai_analysis"
    content: str = ""
    confidence: float = 1.0  # 0-1
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class EvidenceChain:
    """Chain of evidence supporting a conclusion."""
    id: UUID = field(default_factory=uuid4)
    conclusion: str = ""
    evidence: list[Evidence] = field(default_factory=list)
    overall_confidence: float = 0.0
    created_at: datetime = field(default_factory=datetime.utcnow)

    def add_evidence(
        self,
        source: str,
        content: str,
        confidence: float = 1.0,
        metadata: dict[str, Any] | None = None,
    ) -> Evidence:
        """Add evidence to the chain.

        Args:
            source: Source of evidence
            content: Evidence content
            confidence: Confidence level 0-1
            metadata: Additional metadata

        Returns:
            Created evidence
        """
        evidence = Evidence(
            source=source,
            content=content,
            confidence=confidence,
            metadata=metadata or {},
        )
        self.evidence.append(evidence)
        self._recalculate_confidence()
        return evidence

    def _recalculate_confidence(self) -> None:
        """Recalculate overall confidence based on evidence."""
        if not self.evidence:
            self.overall_confidence = 0.0
            return

        # Simple average weighted by evidence confidence
        total = sum(e.confidence for e in self.evidence)
        self.overall_confidence = total / len(self.evidence)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary.

        Returns:
            Dictionary representation
        """
        return {
            "id": str(self.id),
            "conclusion": self.conclusion,
            "evidence": [
                {
                    "id": str(e.id),
                    "source": e.source,
                    "content": e.content,
                    "confidence": e.confidence,
                    "metadata": e.metadata,
                    "created_at": e.created_at.isoformat(),
                }
                for e in self.evidence
            ],
            "overall_confidence": self.overall_confidence,
            "created_at": self.created_at.isoformat(),
        }
