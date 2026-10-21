"""Build the Google Docs batchUpdate requests that insert one briefing issue.

Reads an issue JSON file and writes a JSON array of requests for the Google Docs
connector's ``update_doc`` tool. The issue is inserted at ``--insert-index`` (the
``endIndex`` of the doc's header paragraph), so the newest issue sits on top.

Issue schema::

    {
      "date": "YYYY-MM-DD",
      "heading": "Tuesday, October 21, 2026",
      "topLine": "One sentence on the day's biggest story",
      "sections": [
        {"name": "Section name",
         "items": [{"headline": "...", "summary": "...",
                    "sources": [{"name": "...", "url": "https://..."}]}]}
      ]
    }

Example::

    python3 scripts/build_doc_requests.py --issue issues/2026-10-21.json \\
        --insert-index 109 --out /tmp/requests.json
"""

import argparse
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Paragraph styles and list preset applied by the Docs API.
NORMAL_TEXT = "NORMAL_TEXT"
ISSUE_HEADING = "HEADING_2"
SECTION_HEADING = "HEADING_3"
BULLET_PRESET = "BULLET_DISC_CIRCLE_SQUARE"

# Text styles for the inserted runs.
LINK_COLOR = {"color": {"rgbColor": {"red": 0.07, "green": 0.33, "blue": 0.8}}}
RESET_TEXT_FIELDS = "bold,italic,underline,link,foregroundColor,fontSize"
EM_DASH = "—"


def utf16_length(text: str) -> int:
    """Return the length of ``text`` in UTF-16 code units, as Docs indexes count."""
    return len(text.encode("utf-16-le")) // 2


@dataclass
class _Paragraph:
    start: int
    end: int
    style: str
    is_bullet: bool


@dataclass
class _TextStyle:
    start: int
    end: int
    style: dict[str, Any]
    fields: str


@dataclass
class _IssueLayout:
    """Text of one issue plus the paragraph and text styles to apply to it."""

    insert_index: int
    text: str = ""
    paragraphs: list[_Paragraph] = field(default_factory=list)
    text_styles: list[_TextStyle] = field(default_factory=list)

    @property
    def position(self) -> int:
        return self.insert_index + utf16_length(self.text)

    def add_run(
        self, text: str, style: dict[str, Any] | None = None, fields: str = ""
    ) -> None:
        start = self.position
        self.text += text
        if style:
            self.text_styles.append(_TextStyle(start, self.position, style, fields))

    def complete_paragraph(
        self, start: int, style: str, is_bullet: bool = False
    ) -> None:
        self.text += "\n"
        self.paragraphs.append(_Paragraph(start, self.position, style, is_bullet))


def _lay_out_issue(issue: dict[str, Any], insert_index: int) -> _IssueLayout:
    layout = _IssueLayout(insert_index)

    start = layout.position
    layout.add_run(issue.get("heading") or "")
    layout.complete_paragraph(start, ISSUE_HEADING)

    if issue.get("topLine"):
        start = layout.position
        layout.add_run(issue["topLine"], {"italic": True}, "italic")
        layout.complete_paragraph(start, NORMAL_TEXT)

    for section in issue.get("sections") or []:
        items = section.get("items") or []
        if not items:
            continue
        start = layout.position
        layout.add_run(section.get("name") or "")
        layout.complete_paragraph(start, SECTION_HEADING)

        for item in items:
            start = layout.position
            layout.add_run(item.get("headline") or "", {"bold": True}, "bold")
            layout.add_run(f" {EM_DASH} {item.get('summary') or ''}")
            sources = item.get("sources") or []
            if sources:
                layout.add_run(" (")
                for index, source in enumerate(sources):
                    if index > 0:
                        layout.add_run(", ")
                    layout.add_run(
                        source["name"],
                        {
                            "link": {"url": source["url"]},
                            "underline": True,
                            "foregroundColor": LINK_COLOR,
                        },
                        "link,underline,foregroundColor",
                    )
                layout.add_run(")")
            layout.complete_paragraph(start, NORMAL_TEXT, is_bullet=True)

    # Blank line separating this issue from the previous one.
    start = layout.position
    layout.complete_paragraph(start, NORMAL_TEXT)
    return layout


def _bullet_ranges(paragraphs: list[_Paragraph]) -> list[tuple[int, int]]:
    """Group consecutive bullet paragraphs (one section's items) into ranges."""
    ranges: list[tuple[int, int]] = []
    run_start: int | None = None
    run_end = 0
    for paragraph in paragraphs:
        if paragraph.is_bullet:
            if run_start is None:
                run_start = paragraph.start
            run_end = paragraph.end
        elif run_start is not None:
            ranges.append((run_start, run_end))
            run_start = None
    if run_start is not None:
        ranges.append((run_start, run_end))
    return ranges


def build_requests(issue: dict[str, Any], insert_index: int) -> list[dict[str, Any]]:
    """Return the ``update_doc`` requests that insert ``issue`` at ``insert_index``.

    Parameters
    ----------
    issue : dict
        Parsed issue JSON (see the module docstring for the schema).
    insert_index : int
        Document index to insert at; must be at least 1.

    Returns
    -------
    list of dict
        Docs API batchUpdate requests, in the order they must be applied.
    """
    if insert_index < 1:
        raise ValueError(f"insert_index must be >= 1, got {insert_index}")
    layout = _lay_out_issue(issue, insert_index)
    whole = {"startIndex": insert_index, "endIndex": layout.position}

    requests: list[dict[str, Any]] = [
        {"insertText": {"location": {"index": insert_index}, "text": layout.text}},
        # New paragraphs inherit the style of the paragraph they land in (often
        # the previous issue's heading), so reset everything first.
        {"deleteParagraphBullets": {"range": whole}},
        {
            "updateParagraphStyle": {
                "range": whole,
                "paragraphStyle": {"namedStyleType": NORMAL_TEXT},
                "fields": "namedStyleType",
            }
        },
        {
            "updateTextStyle": {
                "range": whole,
                "textStyle": {},
                "fields": RESET_TEXT_FIELDS,
            }
        },
    ]
    for paragraph in layout.paragraphs:
        if paragraph.style == NORMAL_TEXT:
            continue
        requests.append(
            {
                "updateParagraphStyle": {
                    "range": {"startIndex": paragraph.start, "endIndex": paragraph.end},
                    "paragraphStyle": {"namedStyleType": paragraph.style},
                    "fields": "namedStyleType",
                }
            }
        )
    for text_style in layout.text_styles:
        requests.append(
            {
                "updateTextStyle": {
                    "range": {
                        "startIndex": text_style.start,
                        "endIndex": text_style.end,
                    },
                    "textStyle": text_style.style,
                    "fields": text_style.fields,
                }
            }
        )
    for start, end in _bullet_ranges(layout.paragraphs):
        requests.append(
            {
                "createParagraphBullets": {
                    "range": {"startIndex": start, "endIndex": end},
                    "bulletPreset": BULLET_PRESET,
                }
            }
        )
    return requests


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--issue", type=Path, required=True, help="issue JSON file")
    parser.add_argument(
        "--insert-index",
        type=int,
        required=True,
        help="endIndex of the doc's header paragraph",
    )
    parser.add_argument("--out", type=Path, required=True, help="requests JSON file")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = _parse_args(argv)
    issue = json.loads(args.issue.read_text(encoding="utf-8"))
    requests = build_requests(issue, args.insert_index)
    args.out.write_text(
        json.dumps(requests, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    inserted = requests[0]["insertText"]["text"]
    print(
        f"Wrote {len(requests)} requests ({utf16_length(inserted)} chars inserted "
        f"at index {args.insert_index}) to {args.out}"
    )


if __name__ == "__main__":
    main()
