// Router and startup. Hash routes, one per surface:
//
//   #/                              the bounty board
//   #/bounty/<slug>                 one bounty's page
//   #/bounty/<slug>/leaderboard     that bounty's leaderboard
//   #/u/<handle>                    an account's public profile
//
// window.__shotReady is false while a route is loading and true once its
// data has rendered (or its error has), so a screenshot knows when the
// page is ready. Paging and filtering update only the list region, never
// the whole page. A 30 second tick refreshes the time-left labels in
// place, and a 60 second revalidate refetches the current route.

import {
  listCompetitions, getCompetition, getLeaderboard, listSubmissions, getProfile,
} from "./api.js";
import {
  formatDate, timeLeft, isPast, acceptsEntries, esc,
} from "./format.js";
import {
  BOARD_PAGE_SIZE, LEADERBOARD_PAGE_SIZE, SOLUTIONS_PAGE_SIZE,
  boardStats, boardShell, boardListHtml,
  bountyView, leaderboardShell, leaderboardPageHtml,
  profileView, profileSolutionsHtml, errorView,
} from "./views.js";

const view = document.getElementById("view");
const boardLink = document.querySelector('[data-nav="board"]');

const boardState = { q: "", category: "", status: "", sort: "deadline", page: 1 };
let boardItems = [];
let lbEntries = [];
let lbPage = 1;
let profSolutions = [];
let profPage = 1;
let currentRoute = "";

function setReady(ready) {
  window.__shotReady = ready;
}

function setNav(route) {
  if (!boardLink) return;
  if (route === "board") boardLink.setAttribute("aria-current", "page");
  else boardLink.removeAttribute("aria-current");
}

function parseHash() {
  const raw = (location.hash || "#/").slice(1) || "/";
  const parts = raw.split("/").filter((p) => p !== "");
  if (parts.length === 0) return { route: "board" };
  if (parts[0] === "bounty" && parts[1]) {
    const slug = decodeURIComponent(parts[1]);
    if (parts[2] === "leaderboard") return { route: "leaderboard", slug };
    return { route: "bounty", slug };
  }
  if (parts[0] === "u" && parts[1]) {
    return { route: "profile", handle: decodeURIComponent(parts[1]) };
  }
  return { route: "unknown", raw };
}

// ---------- board ----------

function filteredBoard() {
  const now = Date.now();
  const q = boardState.q.trim().toLowerCase();
  let items = boardItems.filter((c) => {
    if (boardState.category && c.category !== boardState.category) return false;
    if (boardState.status === "open" && !acceptsEntries(c, now)) return false;
    if (boardState.status === "closed" && acceptsEntries(c, now)) return false;
    if (boardState.status === "soon") {
      if (!acceptsEntries(c, now)) return false;
      if (!c.deadline || new Date(c.deadline).getTime() - now > 24 * 3600 * 1000) return false;
    }
    if (q) {
      const hay = [c.title, c.summary, c.category, (c.skills || []).join(" ")]
        .join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sort = boardState.sort;
  items = [...items].sort((a, b) => {
    if (sort === "pot") return (Number(b.potUsd) || 0) - (Number(a.potUsd) || 0);
    if (sort === "entries") return (Number(b.submissionCount) || 0) - (Number(a.submissionCount) || 0);
    if (sort === "newest") return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
    const da = new Date(a.deadline || "9999").getTime();
    const db = new Date(b.deadline || "9999").getTime();
    return da - db;
  });
  return items;
}

function renderBoardList() {
  const list = document.getElementById("board-list");
  const count = document.getElementById("board-count");
  if (!list) return;
  const items = filteredBoard();
  const pages = Math.max(1, Math.ceil(items.length / BOARD_PAGE_SIZE));
  boardState.page = Math.min(Math.max(1, boardState.page), pages);
  list.innerHTML = boardListHtml(items, boardState.page);
  if (count) count.textContent = `${items.length} of ${boardItems.length} bounties`;
}

async function renderBoard(force) {
  boardItems = await listCompetitions({ force });
  const categories = [...new Set(boardItems.map((c) => c.category).filter(Boolean))].sort();
  view.innerHTML = boardShell(boardStats(boardItems), categories);
  const search = document.getElementById("board-search");
  const cat = document.getElementById("board-category");
  const status = document.getElementById("board-status");
  const sort = document.getElementById("board-sort");
  if (search) {
    search.value = boardState.q;
    search.addEventListener("input", () => { boardState.q = search.value; boardState.page = 1; renderBoardList(); });
  }
  if (cat) {
    cat.value = boardState.category;
    cat.addEventListener("change", () => { boardState.category = cat.value; boardState.page = 1; renderBoardList(); });
  }
  if (status) {
    status.value = boardState.status;
    status.addEventListener("change", () => { boardState.status = status.value; boardState.page = 1; renderBoardList(); });
  }
  if (sort) {
    sort.value = boardState.sort;
    sort.addEventListener("change", () => { boardState.sort = sort.value; boardState.page = 1; renderBoardList(); });
  }
  renderBoardList();
}

// ---------- bounty ----------

async function renderBounty(slug, force) {
  const comp = await getCompetition(slug, { force });
  let entries = comp.submissions || [];
  if (!entries.length && comp.submissionCount > 0) {
    entries = await listSubmissions(slug, { force });
  }
  view.innerHTML = bountyView(comp, entries);
}

// ---------- leaderboard ----------

function renderLbList() {
  const list = document.getElementById("leaderboard-list");
  if (!list) return;
  const pages = Math.max(1, Math.ceil(lbEntries.length / LEADERBOARD_PAGE_SIZE));
  lbPage = Math.min(Math.max(1, lbPage), pages);
  list.innerHTML = leaderboardPageHtml(lbEntries, lbPage);
}

async function renderLeaderboard(slug, force) {
  const [comp, data] = await Promise.all([
    getCompetition(slug, { force }),
    getLeaderboard(slug, { rows: "all", force }),
  ]);
  lbEntries = data.entries || [];
  lbPage = 1;
  view.innerHTML = leaderboardShell(comp, data);
  renderLbList();
}

// ---------- profile ----------

function renderProfList() {
  const list = document.getElementById("profile-solutions");
  if (!list) return;
  const pages = Math.max(1, Math.ceil(profSolutions.length / SOLUTIONS_PAGE_SIZE));
  profPage = Math.min(Math.max(1, profPage), pages);
  list.innerHTML = profileSolutionsHtml(profSolutions, profPage);
}

async function renderProfile(handle, force) {
  const p = await getProfile(handle, { force });
  profSolutions = p.solutions || [];
  profPage = 1;
  view.innerHTML = profileView(p);
  renderProfList();
}

// ---------- routing ----------

async function route(force = false) {
  const parsed = parseHash();
  currentRoute = parsed.route;
  setNav(parsed.route);
  setReady(false);
  try {
    if (parsed.route === "board") await renderBoard(force);
    else if (parsed.route === "bounty") await renderBounty(parsed.slug, force);
    else if (parsed.route === "leaderboard") await renderLeaderboard(parsed.slug, force);
    else if (parsed.route === "profile") await renderProfile(parsed.handle, force);
    else {
      view.innerHTML = errorView({ message: `No page matches “${parsed.raw}”.` }, "this page");
    }
  } catch (err) {
    const what = parsed.route === "bounty" || parsed.route === "leaderboard"
      ? `bounty “${parsed.slug}”`
      : parsed.route === "profile" ? `account “${parsed.handle}”` : "the bounty board";
    view.innerHTML = errorView(err, what);
  } finally {
    setReady(true);
    window.scrollTo(0, 0);
  }
}

// Pager clicks: update only the list region, keep the rest of the page.
view.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-page]");
  if (!btn || btn.disabled) return;
  const dir = btn.dataset.page === "next" ? 1 : -1;
  if (currentRoute === "board") { boardState.page += dir; renderBoardList(); }
  else if (currentRoute === "leaderboard") { lbPage += dir; renderLbList(); }
  else if (currentRoute === "profile") { profPage += dir; renderProfList(); }
});

// Time-left labels tick in place every 30 seconds, without refetching.
setInterval(() => {
  const now = Date.now();
  document.querySelectorAll("[data-deadline]").forEach((el) => {
    const deadline = el.getAttribute("data-deadline");
    if (!deadline) return;
    const left = timeLeft(deadline, now);
    if (left) el.textContent = left + " left";
    else {
      el.textContent = "Ended " + formatDate(deadline);
      el.classList.add("done");
    }
  });
}, 30_000);

// Revalidate the current route every 60 seconds, keeping filters and pages.
setInterval(() => {
  if (document.hidden) return;
  route(true).catch(() => {});
}, 60_000);

window.addEventListener("hashchange", () => route(false));
route(false);
