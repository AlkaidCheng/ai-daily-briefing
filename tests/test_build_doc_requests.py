import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from build_doc_requests import build_requests, main, utf16_length  # noqa: E402

LINK = "https://example.com/a"
ISSUE = {
    "date": "2026-10-21",
    "heading": "Mon",
    "topLine": "Top",
    "sections": [
        {
            "name": "S1",
            "items": [
                {
                    "headline": "H",
                    "summary": "x",
                    "sources": [{"name": "A", "url": LINK}],
                }
            ],
        },
        {"name": "Empty", "items": []},
        {"name": "S2", "items": [{"headline": "G", "summary": "y", "sources": []}]},
    ],
}


def _ranges(requests, kind):
    return [
        (r[kind]["range"]["startIndex"], r[kind]["range"]["endIndex"])
        for r in requests
        if kind in r
    ]


def test_inserts_text_at_index_and_skips_empty_sections():
    requests = build_requests(ISSUE, 109)
    insert = requests[0]["insertText"]
    assert insert["location"] == {"index": 109}
    assert insert["text"] == "Mon\nTop\nS1\nH — x (A)\nS2\nG — y\n\n"


def test_resets_whole_range_before_styling():
    requests = build_requests(ISSUE, 109)
    whole = {"startIndex": 109, "endIndex": 140}
    assert requests[1] == {"deleteParagraphBullets": {"range": whole}}
    assert requests[2]["updateParagraphStyle"]["range"] == whole
    assert requests[2]["updateParagraphStyle"]["paragraphStyle"] == {
        "namedStyleType": "NORMAL_TEXT"
    }
    assert requests[3]["updateTextStyle"]["range"] == whole
    assert requests[3]["updateTextStyle"]["textStyle"] == {}


def test_heading_text_and_bullet_ranges():
    requests = build_requests(ISSUE, 109)
    headings = [
        (
            r["updateParagraphStyle"]["range"]["startIndex"],
            r["updateParagraphStyle"]["range"]["endIndex"],
            r["updateParagraphStyle"]["paragraphStyle"]["namedStyleType"],
        )
        for r in requests[4:]
        if "updateParagraphStyle" in r
    ]
    assert headings == [
        (109, 113, "HEADING_2"),
        (117, 120, "HEADING_3"),
        (130, 133, "HEADING_3"),
    ]
    styled = [
        (
            r["updateTextStyle"]["range"]["startIndex"],
            r["updateTextStyle"]["range"]["endIndex"],
            r["updateTextStyle"]["fields"],
        )
        for r in requests[4:]
        if "updateTextStyle" in r
    ]
    assert styled == [
        (113, 116, "italic"),
        (120, 121, "bold"),
        (127, 128, "link,underline,foregroundColor"),
        (133, 134, "bold"),
    ]
    assert _ranges(requests, "createParagraphBullets") == [(120, 130), (133, 139)]
    assert len(requests) == 13


def test_link_style_carries_url():
    requests = build_requests(ISSUE, 109)
    link = next(
        r["updateTextStyle"]["textStyle"]
        for r in requests
        if r.get("updateTextStyle", {}).get("textStyle", {}).get("link")
    )
    assert link["link"] == {"url": LINK}
    assert link["underline"] is True


def test_indexes_count_utf16_code_units():
    issue = {"heading": "\U0001f680 Launch", "sections": []}
    assert utf16_length("\U0001f680") == 2
    requests = build_requests(issue, 1)
    assert _ranges(requests, "updateParagraphStyle")[-1] == (1, 11)
    assert requests[1]["deleteParagraphBullets"]["range"]["endIndex"] == 12


def test_rejects_index_below_one():
    with pytest.raises(ValueError):
        build_requests(ISSUE, 0)


def test_cli_writes_requests(tmp_path, capsys):
    issue_path = tmp_path / "issue.json"
    out_path = tmp_path / "requests.json"
    issue_path.write_text(json.dumps(ISSUE), encoding="utf-8")
    main(["--issue", str(issue_path), "--insert-index", "109", "--out", str(out_path)])
    assert json.loads(out_path.read_text(encoding="utf-8")) == build_requests(
        ISSUE, 109
    )
    assert (
        "Wrote 13 requests (31 chars inserted at index 109)" in capsys.readouterr().out
    )
