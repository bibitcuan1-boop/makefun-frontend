// Rendering for the four surfaces: board, bounty page, leaderboard, profile.
// Every function returns an HTML string. All API text goes through esc()
// first; the only markup we build ourselves is structure and links.
// Images the API points at get crossorigin="anonymous" before src, because
// those images are served with a same-origin resource policy.

import {
  usd, usdWhole, usdOr, formatDate, formatDateTime, timeLeft, isPast,
  acceptsEntries, entryStatus, winRate, compact, plural, esc,
} from "./format.js";

export const BOARD_PAGE_SIZE = 12;
export const LEADERBOARD_PAGE_SIZE = 25;
export const SOLUTIONS_PAGE_SIZE = 10;

const SITE = "https://make.fun";

function absUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return SITE + (url.startsWith("/") ? url : "/" + url);
}

// <img> with crossorigin set before src in the tag, as the API's images need.
export function apiImg(url, alt, cls) {
  const src = absUrl(url);
  if (!src) return "";
  return `<img crossorigin="anonymous" src="${esc(src)}" alt="${esc(alt)}" class="${esc(cls)}" loading="lazy" referrerpolicy="no-referrer">`;
}

function initials(name) {
  const clean = String(name || "?").replace(/^@/, "").trim();
  const letters = clean.split(/[^A-Za-z0-9]+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join("");
  return letters || "?";
}

export function avatarFor(handle, image, size) {
  const cls = size === "lg" ? "avatar lg" : size === "sm" ? "avatar sm" : "avatar";
  if (image) return apiImg(image, `${handle}'s avatar`, cls);
  return `<span class="${cls} avatar-fallback" aria-hidden="true">${esc(initials(handle))}</span>`;
}

function statusChip(comp) {
  const st = entryStatus(comp);
  return `<span class="chip ${st.kind}">${esc(st.label)}</span>`;
}

function feeChip(comp) {
  const fee = usd(comp.entryFeeUsd);
  if (!fee) return `<span class="chip fee">Free to enter</span>`;
  return `<span class="chip fee">Entry fee ${esc(fee)}</span>`;
}

// ---------- tiny markdown ----------
// The bounty description is markdown-ish plain text. Escape it first,
// then allow headings, bold, code, links and dash lists. Anything else
// stays literal text, so a stray "<script>" in a description is inert.

export function markdown(text) {
  const lines = String(text || "").split("\n");
  let html = "";
  let inList = false;
  let inCode = false;
  const inline = (s) => {
    let out = esc(s);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_m, label, href) =>
      `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`);
    return out;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim().startsWith("```")) {
      if (inCode) { html += "</code></pre>"; inCode = false; }
      else { html += "<pre><code>"; inCode = true; }
      continue;
    }
    if (inCode) { html += esc(line) + "\n"; continue; }
    if (line.startsWith("### ")) { if (inList) { html += "</ul>"; inList = false; } html += `<h3>${inline(line.slice(4))}</h3>`; continue; }
    if (line.startsWith("## ")) { if (inList) { html += "</ul>"; inList = false; } html += `<h2>${inline(line.slice(3))}</h2>`; continue; }
    if (line.startsWith("# ")) { if (inList) { html += "</ul>"; inList = false; } html += `<h2>${inline(line.slice(2))}</h2>`; continue; }
    if (/^[-*] /.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(line.slice(2))}</li>`;
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    if (line.trim() === "") continue;
    html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += "</ul>";
  if (inCode) html += "</code></pre>";
  return html;
}

// ---------- board ----------

export function boardStats(items) {
  const now = Date.now();
  const open = items.filter((c) => acceptsEntries(c, now)).length;
  const pot = items.reduce((sum, c) => sum + (Number(c.potUsd) || 0), 0);
  const entries = items.reduce((sum, c) => sum + (Number(c.submissionCount) || 0), 0);
  return { total: items.length, open, pot, entries };
}

export function bountyCard(c) {
  const left = timeLeft(c.deadline);
  const pot = usd(c.potUsd);
  const reward = usd(c.rewardAmount);
  const closed = isPast(c.deadline);
  return `<article class="card">
    <h3><a href="#/bounty/${esc(c.slug)}">${esc(c.title)}</a></h3>
    <div class="row">${statusChip(c)}<span class="chip cat">${esc(c.category || "Bounty")}</span>${feeChip(c)}</div>
    <p class="desc">${esc(c.summary || (c.description || "").split("\n")[0] || "")}</p>
    <div class="moneyline">
      <div class="m"><b>${esc(pot || reward || "—")}</b><span>Live pot</span></div>
      <div class="m"><b>${esc(reward || "—")}</b><span>Base reward</span></div>
      <div class="m"><b class="timeleft${closed ? " done" : ""}" data-deadline="${esc(c.deadline || "")}">${esc(left ? left + " left" : "Ended " + formatDate(c.deadline))}</b><span>Time left</span></div>
      <div class="m"><b>${compact(c.submissionCount)}</b><span>${plural(c.submissionCount, "Entry", "Entries")}</span></div>
    </div>
  </article>`;
}

export function boardShell(stats, categories) {
  return `<h1>Live bounties</h1>
  <p class="lede">Every open bounty on make.fun, with its live pot, entry fee and time
  left — read straight from the public API, no sign-in needed.</p>
  <div class="stat-strip" role="group" aria-label="Board totals">
    <div class="stat"><b>${compact(stats.total)}</b><span>Bounties listed</span></div>
    <div class="stat"><b>${compact(stats.open)}</b><span>Open for entries</span></div>
    <div class="stat"><b>${esc(usdWhole(stats.pot) || "—")}</b><span>Total live pots</span></div>
    <div class="stat"><b>${compact(stats.entries)}</b><span>Entries so far</span></div>
  </div>
  <div class="toolbar">
    <input type="search" id="board-search" placeholder="Search bounties…" aria-label="Search bounties" autocomplete="off">
    <select id="board-category" aria-label="Filter by category">
      <option value="">All categories</option>
      ${categories.map((cat) => `<option value="${esc(cat)}">${esc(cat)}</option>`).join("")}
    </select>
    <select id="board-status" aria-label="Filter by entry status">
      <option value="">All statuses</option>
      <option value="open">Open for entries</option>
      <option value="soon">Closing within 24h</option>
      <option value="closed">Entries closed</option>
    </select>
    <select id="board-sort" aria-label="Sort bounties">
      <option value="deadline">Deadline: soonest</option>
      <option value="pot">Biggest live pot</option>
      <option value="entries">Most entries</option>
      <option value="newest">Newest first</option>
    </select>
    <span class="count" id="board-count"></span>
  </div>
  <div id="board-list"></div>`;
}

export function boardListHtml(items, page) {
  if (!items.length) {
    return `<div class="empty"><p>No bounties match these filters.</p>
      <p class="small">Try clearing the search or choosing another category.</p></div>`;
  }
  const pages = Math.max(1, Math.ceil(items.length / BOARD_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pages);
  const slice = items.slice((safePage - 1) * BOARD_PAGE_SIZE, safePage * BOARD_PAGE_SIZE);
  return `<div class="grid">${slice.map(bountyCard).join("")}</div>
  <div class="pager">
    <button type="button" data-page="prev" ${safePage <= 1 ? "disabled" : ""}>← Newer</button>
    <span>Page ${safePage} of ${pages} · ${compact(items.length)} ${plural(items.length, "bounty", "bounties")}</span>
    <button type="button" data-page="next" ${safePage >= pages ? "disabled" : ""}>Older →</button>
  </div>`;
}

// ---------- bounty page ----------

function rewardsTable(comp) {
  const rows = comp.rewardsNow || [];
  if (rows.length) {
    return `<table class="rewards">
      <thead><tr><th>Place</th><th>Base</th><th>Fee share</th><th>Total now</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td>${esc(r.place)}</td>
        <td>${esc(usdOr(r.baseUsd, "—"))}</td>
        <td>${esc(usdOr(r.feeShareUsd, "—"))}</td>
        <td><b>${esc(usdOr(r.amountUsd, "—"))}</b></td>
      </tr>`).join("")}</tbody>
    </table>`;
  }
  const map = comp.rewards || {};
  const places = Object.keys(map).sort((a, b) => Number(a) - Number(b));
  if (!places.length) return `<p class="muted">No rewards table published for this bounty yet.</p>`;
  return `<table class="rewards">
    <thead><tr><th>Place</th><th>Reward</th></tr></thead>
    <tbody>${places.map((p) => `<tr><td>${esc(p)}</td><td><b>${esc(usd(map[p]) || "—")}</b></td></tr>`).join("")}</tbody>
  </table>`;
}

function entryRow(e, slug) {
  const handle = e.handle || e.hunter || "unknown";
  const score = e.score && (e.score.display || e.score.value);
  const when = e.created_at || e.createdAt || e.received_at;
  return `<li class="entry-item">
    ${avatarFor(handle, e.image, "sm")}
    <div class="body">
      <div class="title">${e.title ? esc(e.title) : `<a href="#/u/${esc(handle)}">@${esc(handle)}</a>`}</div>
      <div class="sub"><a href="#/u/${esc(handle)}">@${esc(handle)}</a>
        ${e.status ? ` · ${esc(e.status)}` : ""}${when ? ` · ${esc(formatDate(when))}` : ""}</div>
    </div>
    <div class="side">${score ? `<b>${esc(String(score))}</b><span>Score</span>` : `<b>—</b><span>No score yet</span>`}</div>
  </li>`;
}

export function bountyView(comp, entries) {
  const left = timeLeft(comp.deadline);
  const st = entryStatus(comp);
  const rules = comp.rules || comp.rulesNote || "";
  const resolution = comp.resolution && (comp.resolution.summary || comp.resolution.method);
  const shownEntries = (entries || comp.submissions || []).slice(0, 60);
  return `<a class="backlink" href="#/">← All bounties</a>
  <h1>${esc(comp.title)}</h1>
  <div class="meta-row">${statusChip(comp)}
    <span class="chip cat">${esc(comp.category || "Bounty")}</span>
    ${feeChip(comp)}
    ${comp.sponsor && comp.sponsor.name ? `<span class="chip">by ${esc(comp.sponsor.name)}</span>` : ""}
    ${(comp.skills || []).slice(0, 4).map((s) => `<span class="chip">${esc(s)}</span>`).join("")}
  </div>
  ${comp.summary ? `<p class="lede">${esc(comp.summary)}</p>` : ""}
  <div class="facts">
    <div class="fact"><b>${esc(usd(comp.potUsd) || usd(comp.rewardAmount) || "—")}</b><span>Live pot</span></div>
    <div class="fact"><b>${esc(usd(comp.rewardAmount) || "—")}</b><span>Base reward</span></div>
    <div class="fact"><b class="timeleft" data-deadline="${esc(comp.deadline || "")}">${esc(left ? left + " left" : "Ended " + formatDate(comp.deadline))}</b><span>${st.kind === "closed" ? "Deadline passed" : "Time left"}</span></div>
    <div class="fact"><b>${compact(comp.submissionCount)}</b><span>${plural(comp.submissionCount, "Entry", "Entries")}</span></div>
    <div class="fact"><b>${esc(formatDate(comp.publishedAt))}</b><span>Published</span></div>
    <div class="fact"><b>${esc(formatDateTime(comp.deadline))}</b><span>Deadline</span></div>
  </div>
  <p><a href="#/bounty/${esc(comp.slug)}/leaderboard">View the leaderboard →</a>
    &nbsp;·&nbsp; <a href="https://make.fun/bounty/${esc(comp.slug)}" target="_blank" rel="noopener">Open on make.fun ↗</a></p>
  <h2>What to build</h2>
  <div class="prose">${markdown(comp.description || comp.summary || "")}</div>
  ${rules ? `<h2>Rules</h2><div class="prose">${markdown(rules)}</div>` : ""}
  ${resolution ? `<h2>How it is judged</h2><div class="prose">${markdown(resolution)}</div>` : ""}
  <h2>Rewards <span class="muted small">— live pot ${esc(usd(comp.potUsd) || "—")}</span></h2>
  ${rewardsTable(comp)}
  <h2>Entries <span class="muted small">— ${compact(comp.submissionCount)} in all</span></h2>
  ${shownEntries.length
    ? `<ul class="entry-list">${shownEntries.map((e) => entryRow(e, comp.slug)).join("")}</ul>
       ${comp.submissionCount > shownEntries.length ? `<p class="small muted">Showing the ${shownEntries.length} most recent entries.</p>` : ""}`
    : `<div class="empty"><p>No entries listed yet for this bounty.</p></div>`}`;
}

// ---------- leaderboard ----------

export function leaderboardShell(comp, data) {
  const phase = data.phase || {};
  const columns = (data.columns || []).map((c) => c.title).filter(Boolean);
  return `<a class="backlink" href="#/bounty/${esc(comp.slug)}">← ${esc(comp.title)}</a>
  <h1>Leaderboard</h1>
  <p class="lede">${esc(comp.title)} — ranked entries${phase.title ? ` · ${esc(phase.title)} phase` : ""}${data.title ? ` · ${esc(data.title)}` : ""}.</p>
  <div class="meta-row">${statusChip(comp)}${feeChip(comp)}
    <span class="chip">Live pot ${esc(usd(comp.potUsd) || "—")}</span>
    <span class="chip">${compact((data.entries || []).length)} ranked</span></div>
  ${columns.length ? `<p class="small muted">Ranked by: ${esc(columns.join(" · "))}</p>` : ""}
  <div id="leaderboard-list"></div>`;
}

export function leaderboardPageHtml(entries, page) {
  if (!entries.length) {
    return `<div class="empty"><p>No ranked entries yet.</p>
      <p class="small">Results appear here once judging has run for this bounty.</p></div>`;
  }
  const pages = Math.max(1, Math.ceil(entries.length / LEADERBOARD_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pages);
  const slice = entries.slice((safePage - 1) * LEADERBOARD_PAGE_SIZE, safePage * LEADERBOARD_PAGE_SIZE);
  const rows = slice.map((e) => {
    const rate = winRate(e.values && e.values.judge) || winRate(e.score && e.score.value);
    const judge = e.judge || {};
    const record = judge.matches
      ? `${judge.wins || 0}W · ${judge.draws || 0}D · ${judge.losses || 0}L`
      : null;
    const prize = e.prize_rank ? `Prize #${e.prize_rank}` : null;
    return `<li class="entry-item">
      <span class="rank${e.rank <= 3 ? " top" : ""}">${esc(e.rank ?? "—")}</span>
      ${avatarFor(e.handle, e.image, "sm")}
      <div class="body">
        <div class="title">${e.title ? esc(e.title) : "Untitled entry"}</div>
        <div class="sub"><a href="#/u/${esc(e.handle)}">@${esc(e.handle)}</a>
          ${record ? ` · ${esc(record)}` : ""}${e.prize_eligible === false ? " · not prize-eligible" : ""}</div>
      </div>
      <div class="side"><b>${esc(rate || (e.display && e.display.judge) || "—")}</b><span>${prize || "Judge score"}</span></div>
    </li>`;
  }).join("");
  return `<ul class="entry-list">${rows}</ul>
  <div class="pager">
    <button type="button" data-page="prev" ${safePage <= 1 ? "disabled" : ""}>← Previous</button>
    <span>Page ${safePage} of ${pages} · ${compact(entries.length)} ranked</span>
    <button type="button" data-page="next" ${safePage >= pages ? "disabled" : ""}>Next →</button>
  </div>`;
}

// ---------- profile ----------

export function profileView(p) {
  const record = p.record || {};
  const solutions = p.solutions || [];
  const payouts = p.payouts || [];
  const links = [];
  if (p.github_login) links.push(`<a href="https://github.com/${esc(p.github_login)}" target="_blank" rel="noopener">GitHub: ${esc(p.github_login)}</a>`);
  if (p.x && p.x.url) links.push(`<a href="${esc(p.x.url)}" target="_blank" rel="noopener">X: @${esc(p.x.username || p.x.name || "")}</a>`);
  if (p.discord && p.discord.url) links.push(`<a href="${esc(p.discord.url)}" target="_blank" rel="noopener">Discord: ${esc(p.discord.global_name || p.discord.username || "")}</a>`);
  if (p.wallet && p.wallet.explorer_url) links.push(`<a href="${esc(p.wallet.explorer_url)}" target="_blank" rel="noopener">Wallet ↗</a>`);
  if (p.profile_url) links.push(`<a href="https://make.fun${esc(p.profile_url)}" target="_blank" rel="noopener">Profile on make.fun ↗</a>`);
  return `<a class="backlink" href="#/">← All bounties</a>
  <div class="profile-head">
    ${avatarFor(p.handle, p.image || p.avatar, "lg")}
    <div>
      <h1>${esc(p.display_name || p.handle)}</h1>
      <p class="muted" style="margin:0">@${esc(p.handle)} · joined ${esc(formatDate(p.joined_at))}</p>
      ${p.bio ? `<p style="margin:8px 0 0;max-width:60ch">${esc(p.bio)}</p>` : ""}
      ${links.length ? `<div class="profile-links">${links.join("")}</div>` : ""}
    </div>
  </div>
  <div class="stat-strip" role="group" aria-label="Account record">
    <div class="stat"><b>${compact(record.competitions_entered)}</b><span>Bounties entered</span></div>
    <div class="stat"><b>${compact(record.competitions_won)}</b><span>Won</span></div>
    <div class="stat"><b>${compact(record.competitions_placed)}</b><span>Placed</span></div>
    <div class="stat"><b>${esc(usd(record.prize_usd) || "$0.00")}</b><span>Prize money paid</span></div>
  </div>
  ${payouts.length ? `<h2>Payouts</h2>
  <ul class="entry-list">${payouts.slice(0, 10).map((pay) => `<li class="entry-item">
    <div class="body"><div class="title">${esc(usd(pay.amount_usd || pay.amount) || "—")}</div>
    <div class="sub">${esc(pay.competition_title || pay.competition_slug || pay.status || "")}</div></div>
  </li>`).join("")}</ul>` : ""}
  <h2>Entries <span class="muted small">— ${compact(solutions.length)} shown</span></h2>
  <div id="profile-solutions"></div>`;
}

export function profileSolutionsHtml(solutions, page) {
  if (!solutions.length) {
    return `<div class="empty"><p>This account has no public entries yet.</p></div>`;
  }
  const pages = Math.max(1, Math.ceil(solutions.length / SOLUTIONS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pages);
  const slice = solutions.slice((safePage - 1) * SOLUTIONS_PAGE_SIZE, safePage * SOLUTIONS_PAGE_SIZE);
  const rows = slice.map((s) => {
    const comp = s.competition || {};
    const score = s.score && (s.score.display || s.score.value);
    const rate = s.score && s.score.column && s.score.column.key === "judge" ? winRate(s.score.value) : null;
    return `<li class="entry-item">
      <div class="body">
        <div class="title">${esc(s.title || "Untitled entry")}</div>
        <div class="sub"><a href="#/bounty/${esc(comp.slug)}">${esc(comp.title || comp.slug || "")}</a>
          ${comp.deadline ? ` · deadline ${esc(formatDate(comp.deadline))}` : ""}
          ${s.entered_at ? ` · entered ${esc(formatDate(s.entered_at))}` : ""}</div>
      </div>
      <div class="side">${s.placement ? `<b>#${esc(s.placement)}</b><span>Placed</span>`
        : rate ? `<b>${esc(rate)}</b><span>Judge win rate</span>`
        : score ? `<b>${esc(String(score))}</b><span>Score</span>`
        : `<b>—</b><span>Not ranked yet</span>`}
        ${s.prize_usd ? `<span>Prize ${esc(usd(s.prize_usd))}</span>` : ""}</div>
    </li>`;
  }).join("");
  return `<ul class="entry-list">${rows}</ul>
  ${pages > 1 ? `<div class="pager">
    <button type="button" data-page="prev" ${safePage <= 1 ? "disabled" : ""}>← Previous</button>
    <span>Page ${safePage} of ${pages}</span>
    <button type="button" data-page="next" ${safePage >= pages ? "disabled" : ""}>Next →</button>
  </div>` : ""}`;
}

// ---------- shared ----------

export function errorView(err, what) {
  const status = err && err.status;
  const hint = status === 404
    ? "That bounty or account does not exist on make.fun (or it was removed)."
    : status === 503 || status === 429
      ? "make.fun is busy right now. Wait a moment and try again."
      : "Check your connection and try again.";
  return `<div class="error" role="alert">
    <h2>Couldn’t load ${esc(what || "this page")}</h2>
    <p>${esc(hint)}</p>
    <p class="small muted">${esc(err && err.message ? err.message : "Unknown error")}</p>
    <p><a href="#/">← Back to the board</a></p>
  </div>`;
}
