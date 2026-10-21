# AI Daily Briefing

A daily AI news briefing, written by a scheduled Claude Code cloud routine. Each
morning the routine gathers the past day's AI news and commits it to this
repository as an issue file, which publishes it to the website.

**Read it at <https://alkaidcheng.github.io/ai-daily-briefing/>** — search every
briefing, filter by section, date or figures, and share a link to any briefing or
story (filtered views keep their filters in the link).
<https://alkaidcheng.github.io/ai-daily-briefing/#today> opens just today's briefing,
and <https://alkaidcheng.github.io/ai-daily-briefing/?tag=model-release> lists every
model release.

Keyboard: <kbd>/</kbd> search, <kbd>T</kbd> today's briefing, <kbd>M</kbd> model
releases, <kbd>F</kbd> filters.

Briefings marked **Archive** were added after the fact to cover major model releases
since January 2025, from OpenAI, Anthropic, Google, Meta, xAI, Mistral, DeepSeek,
Alibaba (Qwen), Moonshot AI (Kimi), Zhipu AI (GLM) and MiniMax.

## Layout

| Path | Contents |
|---|---|
| `issues/YYYY-MM-DD.json` | One file per briefing; the archive and the routine's memory of what it already covered |
| `scripts/build_site.py` | Builds the website from `site/` and the issue archive |
| `site/` | The website's page, styles and script |
| `routine/prompt.md` | The routine's instructions |

## Reading the archive locally

```bash
git pull
```

## Editing a briefing

Every briefing and story on the website has an **Edit** button that opens its issue
file in GitHub's editor. Committing the change to `main` republishes the site within
a couple of minutes.

## Previewing the website

```bash
python3 scripts/build_site.py && python3 -m http.server --directory _site
```

## Changing the routine

The routine runs from a copy of `routine/prompt.md`. After editing the file, update
the routine's instructions at <https://claude.ai/code/routines> to match.

---

Developed with the assistance of Claude Code.
