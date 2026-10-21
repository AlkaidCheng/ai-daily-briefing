"use strict";

const REPO = "AlkaidCheng/ai-daily-briefing";
const SECTIONS = [
  "Company announcements",
  "AI solves open problems",
  "Models & open-source",
  "Research papers",
  "Policy & industry",
];
// Item tags the site can filter on, with their chip and badge labels.
const TAGS = {
  "model-release": { chip: "Model releases", badge: "Model release" },
};
const PAGE_SIZE = 7;
const TIME_ZONE = "America/Los_Angeles";

const ICONS = {
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg>',
};

const state = {
  issues: [],
  query: "",
  sections: new Set(),
  tags: new Set(),
  from: "",
  to: "",
  figuresOnly: false,
  today: false,
  shown: PAGE_SIZE,
};

const $ = (id) => document.getElementById(id);

// ---- Safe output -----------------------------------------------------------

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function safeUrl(url, { httpsOnly = false } = {}) {
  try {
    const parsed = new URL(url);
    const allowed = httpsOnly ? ["https:"] : ["https:", "http:"];
    return allowed.includes(parsed.protocol) ? parsed.href : null;
  } catch (_) {
    return null;
  }
}

function highlight(text, terms) {
  const html = escapeHtml(text);
  if (!terms.length) return html;
  const pattern = new RegExp(`(${terms.map((t) => escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  // Only replace in text, never inside an entity such as &amp;.
  return html.replace(/(&[a-z#0-9]+;)|([^&]+)/gi, (m, entity, plain) => entity || plain.replace(pattern, "<mark>$1</mark>"));
}

// ---- Data ------------------------------------------------------------------

function itemId(date, ordinal) {
  return `${date}-${ordinal}`;
}

function prepare(issues) {
  for (const issue of issues) {
    let ordinal = 0;
    for (const section of issue.sections || []) {
      for (const item of section.items || []) {
        ordinal += 1;
        item.id = itemId(issue.date, ordinal);
        item.section = section.name;
        item.tags = (item.tags || []).filter((tag) => Object.hasOwn(TAGS, tag));
        item.haystack = [
          item.headline,
          item.summary,
          ...(item.sources || []).map((s) => s.name),
          ...item.tags.map((tag) => TAGS[tag].badge),
        ]
          .join(" ")
          .toLowerCase();
      }
    }
  }
  return issues;
}

function searchTerms() {
  return state.query.toLowerCase().split(/\s+/).filter(Boolean);
}

function activeFilterCount() {
  return state.tags.size + state.sections.size + Boolean(state.from) + Boolean(state.to) + Number(state.figuresOnly);
}

function isFiltering() {
  return Boolean(state.query || state.today || activeFilterCount());
}

function resetFilters() {
  state.query = "";
  state.sections.clear();
  state.tags.clear();
  state.from = state.to = "";
  state.figuresOnly = false;
  state.today = false;
}

function todayInPacific() {
  // en-CA formats dates as YYYY-MM-DD, matching the issue file names.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

function itemMatches(item, terms) {
  if (state.sections.size && !state.sections.has(item.section)) return false;
  if (state.tags.size && !item.tags.some((tag) => state.tags.has(tag))) return false;
  if (state.figuresOnly && !safeUrl(item.image?.url, { httpsOnly: true })) return false;
  return terms.every((term) => item.haystack.includes(term));
}

function filteredIssues() {
  const terms = searchTerms();
  const latest = state.issues[0]?.date;
  const result = [];
  for (const issue of state.issues) {
    if (state.today && issue.date !== latest) continue;
    if (state.from && issue.date < state.from) continue;
    if (state.to && issue.date > state.to) continue;
    const sections = (issue.sections || [])
      .map((section) => ({ ...section, items: (section.items || []).filter((item) => itemMatches(item, terms)) }))
      .filter((section) => section.items.length);
    if (sections.length) result.push({ ...issue, sections });
  }
  return result;
}

// ---- URL state -------------------------------------------------------------

function readUrlState() {
  const params = new URLSearchParams(location.search);
  state.query = params.get("q") || "";
  state.sections = new Set((params.get("s") || "").split("|").filter((s) => SECTIONS.includes(s)));
  state.tags = new Set((params.get("tag") || "").split("|").filter((tag) => Object.hasOwn(TAGS, tag)));
  state.from = params.get("from") || "";
  state.to = params.get("to") || "";
  state.figuresOnly = params.get("fig") === "1";
  state.today = params.has("today");
}

function writeUrlState() {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.sections.size) params.set("s", [...state.sections].join("|"));
  if (state.tags.size) params.set("tag", [...state.tags].join("|"));
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  if (state.figuresOnly) params.set("fig", "1");
  if (state.today) params.set("today", "");
  const query = params.toString().replace(/today=(&|$)/, "today$1");
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}

function baseUrl() {
  return `${location.origin}${location.pathname}`;
}

// ---- Rendering -------------------------------------------------------------

function editUrl(issue) {
  return `https://github.com/${REPO}/edit/main/${issue.path}`;
}

function renderSources(sources) {
  return (sources || [])
    .map((source) => {
      const url = safeUrl(source.url);
      if (!url) return "";
      const name = String(source.name || new URL(url).hostname);
      const label = name.startsWith("X: ")
        ? `<span class="x-mark">𝕏</span>${escapeHtml(name.slice(3))}`
        : escapeHtml(name);
      return `<a class="source" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    })
    .join("");
}

function renderFigure(image) {
  const url = safeUrl(image?.url, { httpsOnly: true });
  if (!url) return "";
  const alt = escapeHtml(image.alt || "");
  return `<figure class="figure"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(url)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer"></a>${alt ? `<figcaption>${alt}</figcaption>` : ""}</figure>`;
}

function renderItem(item, issue, terms) {
  return `
    <li class="item" id="${item.id}">
      ${item.tags.length ? `<p class="tags">${item.tags.map((tag) => `<span class="tag">${escapeHtml(TAGS[tag].badge)}</span>`).join("")}</p>` : ""}
      <p class="item-headline">${highlight(item.headline, terms)}</p>
      <p class="item-summary">${highlight(item.summary, terms)}</p>
      ${renderFigure(item.image)}
      <div class="item-foot">
        <div class="sources">${renderSources(item.sources)}</div>
        <div class="actions">
          <button class="action" type="button" data-share="${item.id}" data-title="${escapeHtml(item.headline)}">${ICONS.share}Share</button>
          <a class="action" href="${editUrl(issue)}" target="_blank" rel="noopener">${ICONS.edit}Edit</a>
        </div>
      </div>
    </li>`;
}

function renderIssue(issue, terms) {
  const sections = issue.sections
    .map((section) => `
      <section class="section">
        <h3>${escapeHtml(section.name)}</h3>
        <ul class="items">${section.items.map((item) => renderItem(item, issue, terms)).join("")}</ul>
      </section>`)
    .join("");
  return `
    <article class="issue" id="${issue.date}">
      <div class="issue-head">
        <h2><a href="#${issue.date}">${escapeHtml(issue.heading || issue.date)}</a>${issue.archive ? ' <span class="archive-label" title="Added to the archive after the fact">Archive</span>' : ""}</h2>
        <div class="actions">
          <button class="action" type="button" data-share="${issue.date}" data-title="AI Daily Briefing — ${escapeHtml(issue.heading || issue.date)}">${ICONS.share}Share</button>
          <a class="action" href="${editUrl(issue)}" target="_blank" rel="noopener">${ICONS.edit}Edit</a>
        </div>
      </div>
      ${issue.topLine ? `<p class="top-line">${highlight(issue.topLine, terms)}</p>` : ""}
      ${sections}
    </article>`;
}

function render() {
  const issues = filteredIssues();
  const terms = searchTerms();
  const visible = issues.slice(0, state.shown);
  const feed = $("feed");

  const latest = state.issues[0];
  const notice = state.today && latest && latest.date !== todayInPacific()
    ? `<p class="notice">Today's briefing isn't out yet. Showing the latest, ${escapeHtml(latest.heading || latest.date)}.</p>`
    : "";
  feed.innerHTML = notice + (visible.length
    ? visible.map((issue) => renderIssue(issue, terms)).join("")
    : `<p class="empty">${state.issues.length ? "No stories match these filters." : "No briefings yet."}</p>`);
  feed.setAttribute("aria-busy", "false");

  $("load-more").hidden = issues.length <= state.shown;

  const stories = issues.reduce((n, issue) => n + issue.sections.reduce((m, s) => m + s.items.length, 0), 0);
  $("result-count").hidden = !isFiltering();
  $("result-text").textContent =
    `${stories} ${stories === 1 ? "story" : "stories"} in ${issues.length} ${issues.length === 1 ? "briefing" : "briefings"}`;

  const count = activeFilterCount();
  $("filter-badge").hidden = !count;
  $("filter-badge").textContent = String(count);
  $("today").setAttribute("aria-pressed", String(state.today));

  for (const chip of document.querySelectorAll("#section-chips .chip")) {
    chip.setAttribute("aria-pressed", String(state.sections.has(chip.dataset.section)));
  }
  for (const chip of document.querySelectorAll("#tag-chips .chip")) {
    chip.setAttribute("aria-pressed", String(state.tags.has(chip.dataset.tag)));
  }
}

function syncControls() {
  $("search").value = state.query;
  $("date-from").value = state.from;
  $("date-to").value = state.to;
  $("figures-only").checked = state.figuresOnly;
}

function update() {
  state.shown = PAGE_SIZE;
  writeUrlState();
  render();
}

// ---- Permalinks and sharing --------------------------------------------------

function revealHash() {
  const target = decodeURIComponent(location.hash.slice(1));
  if (!target) return;
  if (target === "today") {
    // Short link: #today opens today's briefing.
    resetFilters();
    state.today = true;
    syncControls();
    history.replaceState(null, "", location.pathname);
    update();
    return;
  }
  const date = target.slice(0, 10);
  const index = state.issues.findIndex((issue) => issue.date === date);
  if (index === -1) return;
  if (isFiltering()) {
    resetFilters();
    syncControls();
    writeUrlState();
  }
  state.shown = Math.max(state.shown, index + 1);
  render();
  const element = document.getElementById(target);
  if (!element) return;
  element.scrollIntoView({ block: "start" });
  if (element.classList.contains("item")) {
    element.classList.remove("flash");
    void element.offsetWidth;
    element.classList.add("flash");
  }
}

let toastTimer;
function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 1800);
}

async function share(anchor, title) {
  const url = `${baseUrl()}#${anchor}`;
  if (navigator.share && matchMedia("(hover: none)").matches) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch (_) {
    prompt("Copy this link", url);
  }
}

// ---- Theme -----------------------------------------------------------------

function currentTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function paintThemeButton() {
  $("theme-toggle").innerHTML = currentTheme() === "dark" ? ICONS.sun : ICONS.moon;
}

function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch (_) {}
  paintThemeButton();
}

// ---- Toolbar -----------------------------------------------------------------

function toggleToday() {
  state.today = !state.today;
  window.scrollTo({ top: 0 });
  update();
}

function toggleFilterPanel() {
  const panel = $("filter-panel");
  panel.hidden = !panel.hidden;
  $("filter-toggle").setAttribute("aria-expanded", String(!panel.hidden));
}

// ---- Wiring ----------------------------------------------------------------

function buildChips() {
  $("tag-chips").innerHTML = Object.entries(TAGS)
    .map(([tag, label]) => `<button class="chip chip-tag" type="button" data-tag="${tag}" aria-pressed="false">${escapeHtml(label.chip)}</button>`)
    .join("");
  $("section-chips").innerHTML = SECTIONS.map(
    (name) => `<button class="chip" type="button" data-section="${escapeHtml(name)}" aria-pressed="false">${escapeHtml(name)}</button>`,
  ).join("");
}

function wire() {
  let searchTimer;
  $("search").addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = event.target.value.trim();
      update();
    }, 120);
  });
  $("section-chips").addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    const name = chip.dataset.section;
    state.sections.has(name) ? state.sections.delete(name) : state.sections.add(name);
    update();
  });
  $("tag-chips").addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    const tag = chip.dataset.tag;
    state.tags.has(tag) ? state.tags.delete(tag) : state.tags.add(tag);
    update();
  });
  $("date-from").addEventListener("change", (event) => { state.from = event.target.value; update(); });
  $("date-to").addEventListener("change", (event) => { state.to = event.target.value; update(); });
  $("figures-only").addEventListener("change", (event) => { state.figuresOnly = event.target.checked; update(); });
  $("clear-filters").addEventListener("click", () => {
    resetFilters();
    syncControls();
    update();
  });
  $("today").addEventListener("click", toggleToday);
  $("filter-toggle").addEventListener("click", toggleFilterPanel);
  $("load-more").addEventListener("click", () => {
    state.shown += PAGE_SIZE;
    render();
  });
  $("feed").addEventListener("click", (event) => {
    const button = event.target.closest("[data-share]");
    if (button) share(button.dataset.share, button.dataset.title);
  });
  // Hide figures whose source no longer serves them.
  $("feed").addEventListener("error", (event) => {
    if (event.target.tagName === "IMG") event.target.closest(".figure")?.remove();
  }, true);
  $("theme-toggle").addEventListener("click", toggleTheme);
  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "/" && !typing) {
      event.preventDefault();
      $("search").focus();
    } else if (event.key.toLowerCase() === "t" && !typing) {
      toggleToday();
    } else if (event.key.toLowerCase() === "f" && !typing) {
      toggleFilterPanel();
    } else if (event.key.toLowerCase() === "m" && !typing) {
      state.tags.has("model-release") ? state.tags.delete("model-release") : state.tags.add("model-release");
      update();
    } else if (event.key === "Escape" && document.activeElement === $("search")) {
      $("search").blur();
    }
  });
  window.addEventListener("hashchange", revealHash);
}

async function main() {
  buildChips();
  paintThemeButton();
  readUrlState();
  syncControls();
  wire();
  try {
    const response = await fetch("data/issues.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.issues = prepare(await response.json());
  } catch (error) {
    $("feed").innerHTML = `<p class="empty">Couldn't load the briefings (${escapeHtml(error.message)}).</p>`;
    return;
  }
  const latest = state.issues[0];
  if (latest) $("tagline").textContent = `A daily digest of AI news · latest: ${latest.heading || latest.date}`;
  render();
  revealHash();
}

main();
