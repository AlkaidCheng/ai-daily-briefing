import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from build_site import build_site, load_issues  # noqa: E402


def _write_issue(directory: Path, date: str, **fields) -> None:
    issue = {"date": date, "heading": date, "sections": [], **fields}
    (directory / f"{date}.json").write_text(json.dumps(issue), encoding="utf-8")


@pytest.fixture
def repo(tmp_path):
    issues = tmp_path / "issues"
    issues.mkdir()
    (issues / ".gitkeep").touch()
    _write_issue(issues, "2026-10-20")
    _write_issue(issues, "2026-10-21")
    static = tmp_path / "site"
    static.mkdir()
    (static / "index.html").write_text("<!doctype html>", encoding="utf-8")
    return tmp_path


def test_loads_newest_first_with_repo_paths(repo):
    issues = load_issues(repo / "issues")
    assert [i["date"] for i in issues] == ["2026-10-21", "2026-10-20"]
    assert issues[0]["path"] == "issues/2026-10-21.json"


def test_rejects_date_that_disagrees_with_file_name(repo):
    (repo / "issues" / "2026-10-22.json").write_text(
        json.dumps({"date": "2026-10-23"}), encoding="utf-8"
    )
    with pytest.raises(ValueError, match="2026-10-22.json"):
        load_issues(repo / "issues")


def test_rejects_invalid_json(repo):
    (repo / "issues" / "2026-10-22.json").write_text("{", encoding="utf-8")
    with pytest.raises(ValueError, match="invalid JSON"):
        load_issues(repo / "issues")


def test_build_writes_static_files_and_data(repo):
    out = repo / "_site"
    (out / "stale.txt").parent.mkdir()
    (out / "stale.txt").touch()
    assert build_site(repo / "issues", repo / "site", out) == 2
    assert (out / "index.html").exists()
    assert (out / ".nojekyll").exists()
    assert not (out / "stale.txt").exists()
    data = json.loads((out / "data" / "issues.json").read_text(encoding="utf-8"))
    assert [i["date"] for i in data] == ["2026-10-21", "2026-10-20"]
