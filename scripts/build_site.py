"""Build the briefing website from the issue archive.

Copies the static site and writes ``data/issues.json``: every issue, newest first,
each with the repository path of its file so the site can link to GitHub's editor.

Example::

    python3 scripts/build_site.py --issues issues --static site --out _site
"""

import argparse
import json
import shutil
from pathlib import Path
from typing import Any

# Issue files are named by their date, e.g. 2026-10-21.json.
ISSUE_GLOB = "????-??-??.json"


def load_issues(issues_dir: Path) -> list[dict[str, Any]]:
    """Return every issue in ``issues_dir``, newest first.

    Parameters
    ----------
    issues_dir : Path
        Directory of ``YYYY-MM-DD.json`` issue files.

    Returns
    -------
    list of dict
        Parsed issues, each with ``path`` set to its file's repository path.

    Raises
    ------
    ValueError
        If a file is not valid JSON or its ``date`` does not match its name.
    """
    issues = []
    for path in sorted(issues_dir.glob(ISSUE_GLOB), reverse=True):
        try:
            issue = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError(f"{path}: invalid JSON ({error})") from error
        if issue.get("date") != path.stem:
            raise ValueError(f"{path}: date {issue.get('date')!r} != file name")
        issue["path"] = f"{issues_dir.name}/{path.name}"
        issues.append(issue)
    return issues


def build_site(issues_dir: Path, static_dir: Path, out_dir: Path) -> int:
    """Write the site to ``out_dir`` and return the number of issues in it."""
    issues = load_issues(issues_dir)
    if out_dir.exists():
        shutil.rmtree(out_dir)
    shutil.copytree(static_dir, out_dir)
    data_dir = out_dir / "data"
    data_dir.mkdir()
    (data_dir / "issues.json").write_text(
        json.dumps(issues, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    # Serve files as-is; without this, Pages runs Jekyll over the output.
    (out_dir / ".nojekyll").touch()
    return len(issues)


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--issues", type=Path, default=Path("issues"))
    parser.add_argument("--static", type=Path, default=Path("site"))
    parser.add_argument("--out", type=Path, default=Path("_site"))
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = _parse_args(argv)
    count = build_site(args.issues, args.static, args.out)
    print(f"Built {args.out} with {count} issues")


if __name__ == "__main__":
    main()
