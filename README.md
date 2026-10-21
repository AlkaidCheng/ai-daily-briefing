# AI Daily Briefing

A daily AI news briefing, written by a scheduled Claude Code cloud routine. Each
morning the routine gathers the past day's AI news, posts it at the top of the
"AI Daily Briefing" Google Doc, and commits the issue to this repository.

## Layout

| Path | Contents |
|---|---|
| `issues/YYYY-MM-DD.json` | One file per briefing; the archive and the routine's memory of what it already covered |
| `scripts/build_doc_requests.py` | Turns an issue file into Google Docs `batchUpdate` requests |
| `routine/prompt.md` | The routine's instructions |

## Reading the archive locally

```bash
git pull
```

## Building doc requests by hand

```bash
python3 scripts/build_doc_requests.py --issue issues/2026-10-21.json --insert-index 109 --out requests.json --images-out images.json
```

`--insert-index` is the `endIndex` of the doc's header paragraph. `requests.json` is
a JSON array to pass unchanged as the `requests` argument of the Google Docs
connector's `update_doc` tool. `images.json` lists one step per figure, to apply
afterwards in order: each step's `insert` request in its own `update_doc` call, and
its `on_failure` request instead if that image cannot be inserted.

## Changing the routine

The routine runs from a copy of `routine/prompt.md`. After editing the file, update
the routine's instructions at <https://claude.ai/code/routines> to match.

---

Developed with the assistance of Claude Code.
