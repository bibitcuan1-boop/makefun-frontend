// A make.fun frontend: the board, one bounty, its leaderboard and a public
// profile, on hash routes. window.__shotReady is false while a route loads
// and true once its data is on screen, so a screenshot script knows when to
// capture. Countdowns tick in place every 30 s; nothing is re-fetched for
// that. Lists page client-side (12 cards, 25 leaderboard rows) so a view
// renders from one API call.
//
//   #/                              the board
//   #/bounty/<slug>                 one bounty (+ top 5)
//   #/bounty/<slug>/leaderboard     its leaderboard (?view=overall|performance)
//   #/u/<handle>                    an account's public profile

import { getBounties, getBounty, getLeaderboard, getProfile, stats } from './api.js';
import { boardList, boardShell, bountyPage, errorPage, leaderboardPage, loadingPage, profilePage } from './views.js';
import { timeLeft } from './format.js';

// Start not-ready: a screenshot script must never catch a stale `true`
// from a previous page before the first route has rendered.
window.__shotReady = false;

const app = document.getElementById('app');
const net = document.getElementById('net');
const PER_BOARD = 12;
const PER_LB = 25;

const boardState = { items: [], q: '', sort: 'pot', filter: 'all', page: 1 };
let lbPage = 1;

function showNet() {
  net.textContent = `${stats.requests} API request${stats.requests === 1 ? '' : 's'} · ${stats.served304} revalidated (304) · ${stats.bytes.toLocaleString('en-US')} bytes downloaded`;
}

/** Refresh every countdown on screen without rebuilding anything. */
function tick() {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    el.textContent = timeLeft(el.dataset.deadline);
  });
}
setInterval(tick, 30_000);

function finish(title) {
  document.title = title;
  window.scrollTo(0, 0);
  showNet();
  window.__shotReady = true;
}

function fail(err, label) {
  const gone = err?.status === 404;
  app.innerHTML = errorPage(
    gone ? `No ${label} here` : `Could not load ${label}`,
    gone ? 'Check the link — that slug or handle does not exist on make.fun.'
      : `${err?.message ?? 'Network error'} — the API may be briefly unreachable.`,
  );
  finish('make.fun board');
}

/* ---------- board ---------- */

function filteredBoard() {
  const q = boardState.q.trim().toLowerCase();
  let items = boardState.items.filter((b) => {
    if (q && ![b.title, b.slug, b.category, ...(b.skills ?? [])].join(' ').toLowerCase().includes(q)) return false;
    const left = new Date(b.deadline).getTime() - Date.now();
    if (boardState.filter === 'soon') return left > 0 && left < 86400000;
    if (boardState.filter === 'ended') return left <= 0;
    return true;
  });
  const by = {
    pot: (a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount),
    soon: (a, b) => new Date(a.deadline) - new Date(b.deadline),
    entries: (a, b) => b.submissionCount - a.submissionCount,
    new: (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
  }[boardState.sort];
  return items.sort(by);
}

function renderBoardList() {
  const items = filteredBoard();
  const pages = Math.max(1, Math.ceil(items.length / PER_BOARD));
  if (boardState.page > pages) boardState.page = pages;
  document.getElementById('list').innerHTML = boardList(items, boardState.page, PER_BOARD);
  document.getElementById('count').textContent =
    `${items.length} ${items.length === 1 ? 'bounty' : 'bounties'} · page ${boardState.page} of ${pages}`;
}

async function renderBoard() {
  window.__shotReady = false;
  app.innerHTML = loadingPage('bounties');
  try {
    const data = await getBounties();
    boardState.items = data.items ?? [];
    boardState.page = 1;
    app.innerHTML = boardShell(boardState.items.length);
    renderBoardList();
    document.getElementById('q').addEventListener('input', (e) => {
      boardState.q = e.target.value;
      boardState.page = 1;
      renderBoardList();
    });
    document.getElementById('sort').addEventListener('change', (e) => {
      boardState.sort = e.target.value;
      boardState.page = 1;
      renderBoardList();
    });
    finish('make.fun board — live bounties');
  } catch (err) { fail(err, 'the board'); }
}

/* ---------- bounty + leaderboard + profile ---------- */

async function renderBounty(slug) {
  window.__shotReady = false;
  app.innerHTML = loadingPage('bounty');
  try {
    const [b, top] = await Promise.all([
      getBounty(slug),
      getLeaderboard(slug).catch(() => null),
    ]);
    app.innerHTML = bountyPage(b, top);
    finish(`${b.title} | make.fun board`);
  } catch (err) { fail(err, 'bounty'); }
}

async function renderLeaderboard(slug, view) {
  window.__shotReady = false;
  lbPage = 1;
  app.innerHTML = loadingPage('leaderboard');
  try {
    const lb = await getLeaderboard(slug, view);
    app.innerHTML = leaderboardPage(lb, slug, lbPage, PER_LB);
    finish(`Leaderboard — ${lb.competition?.title ?? slug} | make.fun board`);
  } catch (err) { fail(err, 'leaderboard'); }
}

async function renderProfile(handle) {
  window.__shotReady = false;
  app.innerHTML = loadingPage('profile');
  try {
    const p = await getProfile(handle);
    app.innerHTML = profilePage(p);
    finish(`@${p.handle} | make.fun board`);
  } catch (err) { fail(err, 'profile'); }
}

/* ---------- router ---------- */

function route() {
  const hash = location.hash || '#/';
  const [, path = '', query = ''] = hash.match(/^#([^?]*)(\?.*)?$/) ?? [];
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') {
    return renderLeaderboard(decodeURIComponent(parts[1]), params.get('view') || 'performance');
  }
  if (parts[0] === 'bounty' && parts[1]) return renderBounty(decodeURIComponent(parts[1]));
  if (parts[0] === 'u' && parts[1]) return renderProfile(decodeURIComponent(parts[1]));
  return renderBoard();
}

/** Pager buttons only re-render the list/table in place. */
app.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-page]');
  if (!btn || btn.disabled) return;
  const page = Number(btn.dataset.page);
  if (boardState.items.length && document.getElementById('list')) {
    boardState.page = page;
    renderBoardList();
    window.scrollTo(0, 0);
    return;
  }
  lbPage = page;
  const hash = location.hash;
  const slug = hash.match(/^#\/bounty\/([^/]+)\/leaderboard/)?.[1];
  if (slug) {
    const view = new URLSearchParams(hash.split('?')[1] ?? '').get('view') || 'performance';
    window.__shotReady = false;
    getLeaderboard(decodeURIComponent(slug), view).then((lb) => {
      app.innerHTML = leaderboardPage(lb, decodeURIComponent(slug), lbPage, PER_LB);
      window.scrollTo(0, 0);
      window.__shotReady = true;
    });
  }
});

/** Status filter chips on the board. */
app.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-filter]');
  if (!chip) return;
  boardState.filter = chip.dataset.filter;
  boardState.page = 1;
  document.querySelectorAll('[data-filter]').forEach((c) => {
    const on = c === chip;
    c.classList.toggle('on', on);
    c.setAttribute('aria-pressed', String(on));
  });
  renderBoardList();
});

window.addEventListener('hashchange', route);
route();
