"""Read dated plain-text notes from a directory."""

from __future__ import annotations

from datetime import date
from pathlib import Path
import re


FILE_NAME = re.compile(r"^(\d{4}-\d{2}-\d{2})\.txt$")


def note_files(directory: Path) -> list[tuple[date, Path]]:
    """Find regular files named with valid ISO calendar dates."""
    if not directory.is_dir():
        return []

    found: list[tuple[date, Path]] = []
    for path in directory.iterdir():
        if not path.is_file() or path.is_symlink():
            continue
        match = FILE_NAME.fullmatch(path.name)
        if match is None:
            continue
        try:
            day = date.fromisoformat(match.group(1))
        except ValueError:
            continue
        found.append((day, path))
    return sorted(found, key=lambda item: item[0], reverse=True)


def serialize_note(day: date, path: Path) -> dict[str, str]:
    return {"date": day.isoformat(), "content": path.read_text(encoding="utf-8")}


def current_note(directory: Path, today: date) -> dict[str, str] | None:
    """Return the latest note no later than today."""
    for day, path in note_files(directory):
        if day <= today:
            return serialize_note(day, path)
    return None


def monthly_notes(directory: Path, year: int, month: int) -> list[dict[str, str]]:
    """Return every note in a month, newest first."""
    return [
        serialize_note(day, path)
        for day, path in note_files(directory)
        if day.year == year and day.month == month
    ]
