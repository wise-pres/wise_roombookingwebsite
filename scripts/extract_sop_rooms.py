"""Extract the WISE SOP PDF into a normalized room catalogue JSON file.

Usage:
  python scripts/extract_sop_rooms.py /path/to/SOP.pdf src/data/sop-rooms.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader


ROOM_LINE = re.compile(
    r"(?m)^\s*(?P<code>[A-Z]{1,4}\s?\d{1,5}[A-Z]?)\s*(?P<details>.*)$"
)
CAPACITY_AND_TYPE = re.compile(
    r"\n\s*(?P<capacity>\d+)\s+(?P<room_type>Classroom|Other|Meeting\s+Room|Multipurpose\s+Room)"
)
PAGE_FOOTER = re.compile(
    r"(?:\n8/14/24, 12:22 PM PrintSavedList|\nhttps://campusroom[^\n]*|\n\d+/23)"
)
HEADERS = {
    "You are logged on as janaeska for Women in Science & Engineering (WISE) U of T Student Chapter",
    "Labels",
    "All Labels: All",
    "My Favourites - Print View",
    "Building Room CapacityType",
    "Campus Events",
}

SPECIAL_ROOMS = [
    ("MY317", "Myhal Centre for Engineering Innovation and Entrepreneurship", 36, "Classroom", "engsoc"),
    ("MY320", "Myhal Centre for Engineering Innovation and Entrepreneurship", 36, "Classroom", "engsoc"),
    ("MY537", "Myhal Centre for Engineering Innovation and Entrepreneurship", 6, "Meeting Room", "engsoc"),
    ("MY539", "Myhal Centre for Engineering Innovation and Entrepreneurship", 6, "Meeting Room", "engsoc"),
    ("MY661", "Myhal Centre for Engineering Innovation and Entrepreneurship", 6, "Meeting Room", "engsoc"),
    ("MY663", "Myhal Centre for Engineering Innovation and Entrepreneurship", 6, "Meeting Room", "engsoc"),
    ("MY665", "Myhal Centre for Engineering Innovation and Entrepreneurship", 6, "Meeting Room", "engsoc"),
    ("MY667", "Myhal Centre for Engineering Innovation and Entrepreneurship", 6, "Meeting Room", "engsoc"),
    ("MY763", "Myhal Centre for Engineering Innovation and Entrepreneurship", 12, "Meeting Room", "engsoc"),
    ("MY765", "Myhal Centre for Engineering Innovation and Entrepreneurship", 6, "Meeting Room", "engsoc"),
    ("MY767", "Myhal Centre for Engineering Innovation and Entrepreneurship", 6, "Meeting Room", "engsoc"),
    ("MY815", "Myhal Centre for Engineering Innovation and Entrepreneurship", 5, "Meeting Room", "engsoc"),
    ("MY817", "Myhal Centre for Engineering Innovation and Entrepreneurship", 5, "Meeting Room", "engsoc"),
    ("MY857", "Myhal Centre for Engineering Innovation and Entrepreneurship", 12, "Meeting Room", "engsoc"),
    ("GB202", "Galbraith Building", None, "Special event room", "wise"),
    ("UTSU-5F-LOUNGE", "UTSU Student Commons", None, "Lounge", "utsu"),
]


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("&amp;", "&")).strip()


def photo_url_for(code: str) -> str | None:
    compact = re.sub(r"\s+", "", code)
    match = re.match(r"([A-Z]+)\d", compact)
    if not match:
        return None
    building_code = match.group(1)
    return (
        "https://lsm.utoronto.ca/images/Photos/Website/RoomViews/"
        f"{building_code}/{compact}/{compact}_View1.JPG"
    )


def room_record(code: str, building: str, capacity: int | None, room_type: str, source: str, details: str = "") -> dict:
    return {
        "code": normalize(code),
        "building": normalize(building),
        "displayName": normalize(f"{code} {details}"),
        "capacity": capacity,
        "roomType": normalize(room_type),
        "bookingSource": source,
        "detailsUrl": "https://lsm.utoronto.ca/webapp/f?p=210:1::::::",
        "sourcePhotoUrl": photo_url_for(code),
        "isActive": True,
    }


def extract_rooms(pdf_path: Path) -> list[dict]:
    reader = PdfReader(str(pdf_path))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    rooms: list[dict] = []
    previous_end = 0

    for capacity_match in CAPACITY_AND_TYPE.finditer(text):
        record_chunk = PAGE_FOOTER.sub("", text[previous_end : capacity_match.start()])
        previous_end = capacity_match.end()
        room_matches = list(ROOM_LINE.finditer(record_chunk))
        if not room_matches:
            continue

        room_match = room_matches[-1]
        code = normalize(room_match.group("code"))
        details = normalize(room_match.group("details"))
        raw_building = record_chunk[: room_match.start()]
        building_lines = [normalize(line) for line in raw_building.splitlines()]
        building = normalize(" ".join(line for line in building_lines if line and line not in HEADERS))
        if not building or code.startswith("SC") and "Legend" in building:
            continue

        rooms.append(
            room_record(
                code,
                building,
                int(capacity_match.group("capacity")),
                capacity_match.group("room_type"),
                "sop",
                details,
            )
        )

    by_code = {room["code"]: room for room in rooms}
    for code, building, capacity, room_type, source in SPECIAL_ROOMS:
        by_code[code] = room_record(code, building, capacity, room_type, source)

    return sorted(by_code.values(), key=lambda room: (room["building"], room["code"]))


def main() -> None:
    default_pdf = Path.home() / "Downloads" / "SOP Accessible Rooms - August 2024.pdf"
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_pdf
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("src/data/sop-rooms.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rooms = extract_rooms(pdf_path)
    output_path.write_text(json.dumps(rooms, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(rooms)} rooms to {output_path}")


if __name__ == "__main__":
    main()
