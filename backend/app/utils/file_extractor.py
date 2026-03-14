"""File text extractor - extracts text from PDF and DOCX files."""

import io
from typing import Optional

import docx
import pdfplumber


class FileExtractor:
    """Extract text from various file formats."""

    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    MIN_TEXT_LENGTH = 100  # Minimum text length

    @staticmethod
    def extract_text(file_content: bytes, filename: str) -> str:
        """Extract text from file based on file extension.

        Args:
            file_content: Raw file bytes
            filename: File name to determine type

        Returns:
            Extracted text content

        Raises:
            ValueError: If file is too large or text is too short
        """
        # Check file size
        if len(file_content) > FileExtractor.MAX_FILE_SIZE:
            raise ValueError(f"File size exceeds {FileExtractor.MAX_FILE_SIZE / 1024 / 1024}MB limit")

        # Determine file type
        suffix = filename.lower().split('.')[-1]

        if suffix == 'pdf':
            text = FileExtractor._extract_from_pdf(file_content)
        elif suffix in ('docx', 'doc'):
            text = FileExtractor._extract_from_docx(file_content)
        else:
            raise ValueError(f"Unsupported file type: .{suffix}")

        # Check minimum text length
        if len(text.strip()) < FileExtractor.MIN_TEXT_LENGTH:
            raise ValueError(
                f"Extracted text is too short ({len(text)} chars). "
                f"Minimum required: {FileExtractor.MIN_TEXT_LENGTH} chars"
            )

        return text.strip()

    @staticmethod
    def _extract_from_pdf(file_content: bytes) -> str:
        """Extract text from PDF using pdfplumber.

        Args:
            file_content: PDF file bytes

        Returns:
            Extracted text
        """
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            pages: list[str] = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
        return "\n".join(pages)

    @staticmethod
    def _extract_from_docx(file_content: bytes) -> str:
        """Extract text from DOCX using python-docx.

        Args:
            file_content: DOCX file bytes

        Returns:
            Extracted text
        """
        doc = docx.Document(io.BytesIO(file_content))
        paragraphs: list[str] = []

        # Extract paragraphs
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                paragraphs.append(text)

        # Also extract table content
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cells:
                    paragraphs.append(" | ".join(cells))

        return "\n".join(paragraphs)


def extract_text(file_content: bytes, filename: str) -> str:
    """Convenience function for text extraction.

    Args:
        file_content: Raw file bytes
        filename: File name to determine type

    Returns:
        Extracted text content
    """
    return FileExtractor.extract_text(file_content, filename)
