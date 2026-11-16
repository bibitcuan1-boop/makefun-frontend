// The four surfaces, each a function from API data to HTML. All values are
// escaped in format.js; links are the hash routes main.js reads. External
// links open in a new tab with rel="noopener" so they cannot reach back
// into this page.

import { bytes, date, esc, imgUrl, money, num, pct, shortAddr, takesEntries, timeLeft } from './format.js';

/** The reward as it stands now: the prize plus entry fees paid into it. */
const pot = (b) => money(b.potUsd ?? b.rewardAmount);

const statusPill = (b) =>
  takesEntries(b)
    ? `<span class="pill open">● Open — <span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span></span>`
    : `<span class="pill closed">Closed to entries</span>`;

const avatarImg = (url, name, cls = 'ava') =>
  url ? `<img class="${cls}" crossorigin="anonymous" src="${esc(imgUrl(url))}" alt="" loading="lazy">` : `<span class="${cls} blank" aria-hidden="true">${esc((name ?? '?')[0].toUpperCase())}</span>`;

/* ---------- board ---------- */

export function boardShell(total) {
  return `
  <section class="hero">
    <h1>Live bounties</h1>
    <p class="lede">${num(total)} open right now. Pot is live — every entry fee paid joins it. A bounty past its deadline is closed to entries even while its status still reads open.</p>
  </section>
  <section class="controls" aria-label="Filter and sort bounties">
    <label class="search">Search <input id="q" type="search" placeholder="title, slug or skill…" autocomplete="off"></label>
    <label>Sort
      <select id="sort">
        <option value="pot">Biggest pot</option>
        <option value="soon">Closing soonest</option>
        <option value="entries">Most entries</option>
        <option value="new">Newest</option>
      </select>
    </label>
    <div class="chips" role="group" aria-label="Status">
      <button type="button" data-filter="all" class="chip-btn on" aria-pressed="true">All</button>
      <button type="button" data-filter="soon" class="chip-btn" aria-pressed="false">Closing &lt; 24h</button>
      <button type="button" data-filter="ended" class="chip-btn" aria-pressed="false">Deadline passed</button>
    </div>
  </section>
  <p id="count" class="count" aria-live="polite"></p>
  <div id="list"></div>`;
}

export function boardList(items, page, perPage) {
  if (!items.length) return '<p class="empty">Nothing matches — try a different search or filter.</p>';
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const slice = items.slice((page - 1) * perPage, page * perPage);
  const cards = slice.map((b) => `
    <article class="card">
      <div class="card-top">${statusPill(b)}<span class="cat">${esc(b.category ?? '')}</span></div>
      <h2><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h2>
      <p class="sum">${esc(b.summary ?? '')}</p>
      <p class="pot"><span class="pot-num">${pot(b)}</span><span class="pot-label">live pot</span></p>
      <dl class="meta">
        <div><dt>Entry fee</dt><dd>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</dd></div>
        <div><dt>Deadline</dt><dd>${date(b.deadline)}</dd></div>
        <div><dt>Entries</dt><dd>${num(b.submissionCount)}</dd></div>
      </dl>
      <p class="card-foot"><a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}">View bounty →</a>
      <a class="btn ghost" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard</a></p>
    </article>`).join('');
  return `<div class="grid">${cards}</div>` + pager(page, pages);
}

export function pager(page, pages) {
  if (pages <= 1) return '';
  return `<nav class="pager" aria-label="Pages">
    <button type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
    <span>Page ${page} of ${pages}</span>
    <button type="button" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next →</button>
  </nav>`;
}

/* ---------- bounty page ---------- */

/** The description is plain text with Markdown headings and lists; render it safely. */
function md(text) {
  const lines = esc(text ?? '').split('\n');
  let html = '', inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const line of lines) {
    if (line.startsWith('## ')) { closeList(); html += `<h3>${line.slice(3)}</h3>`; }
    else if (line.startsWith('# ')) { closeList(); html += `<h2>${line.slice(2)}</h2>`; }
    else if (line.startsWith('- ')) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${line.slice(2)}</li>`; }
    else if (line.trim() === '') { closeList(); }
    else { closeList(); html += `<p>${line}</p>`; }
  }
  closeList();
  return html;
}

function rewardsTable(b) {
  const rows = b.rewardsNow ?? [];
  if (rows.length) {
    return `<table class="tbl"><thead><tr><th scope="col">Place</th><th scope="col">Base</th><th scope="col">From entry fees</th><th scope="col">Pays now</th></tr></thead><tbody>${
      rows.map((r) => `<tr><td>#${num(r.place)}</td><td>${money(r.baseUsd)}</td><td>${money(r.feeShareUsd)}</td><td><strong>${money(r.amountUsd)}</strong></td></tr>`).join('')
    }</tbody></table>`;
  }
  const base = b.rewards ?? {};
  const places = Object.keys(base).sort((a, c) => a - c);
  if (!places.length) return '<p>No reward table published yet.</p>';
  return `<table class="tbl"><thead><tr><th scope="col">Place</th><th scope="col">Pays</th></tr></thead><tbody>${
    places.map((p) => `<tr><td>#${esc(p)}</td><td><strong>${money(base[p])}</strong></td></tr>`).join('')
  }</tbody></table>`;
}

export function bountyPage(b, top) {
  const open = takesEntries(b);
  return `
  <p class="crumb"><a href="#/">← All bounties</a></p>
  <section class="hero bounty-hero">
    <div>
      <p class="kicker">${esc(b.category ?? 'Bounty')} · ${esc(b.sponsor?.name ?? '')}</p>
      <h1>${esc(b.title)}</h1>
      <p class="lede">${esc(b.summary ?? '')}</p>
      ${open
        ? `<p class="banner ok">Taking entries — closes <span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span> (${date(b.deadline)}).</p>`
        : `<p class="banner warn">Deadline passed (${date(b.deadline)}) — no longer taking entries, even though its status still reads “${esc(b.status ?? 'open')}”. Results publish after grading.</p>`}
    </div>
    <aside class="pot-box" aria-label="Reward">
      <p class="pot-num big">${pot(b)}</p>
      <p class="pot-label">live pot${b.entryFeeUsd ? ` · ${money(b.entryFeeUsd)} entry fee` : ' · free to enter'}</p>
      <p class="pot-sub">${num(b.submissionCount)} entries · ${num(b.submissionsPassed ?? b.submissionCount)} passed checks</p>
      <p><a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a></p>
    </aside>
  </section>
  <section class="cols">
    <div>
      <h2>Rewards</h2>
      ${rewardsTable(b)}
      <h2>Description &amp; rules</h2>
      <div class="desc">${md(b.description)}</div>
    </div>
    <aside>
      <h2>Top entries</h2>
      ${top?.entries?.length
        ? `<ol class="top5">${top.entries.slice(0, 5).map((e) => `<li>${avatarImg(e.image, e.handle)}<a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a><span class="t">${esc(e.title)}</span><strong>${pct(e.values?.judge)}</strong></li>`).join('')}</ol>
          <p><a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Full leaderboard →</a></p>`
        : '<p>No ranked entries yet — placements show once grading runs.</p>'}
      <h2>Dates</h2>
      <dl class="meta col">
        <div><dt>Published</dt><dd>${date(b.publishedAt)}</dd></div>
        <div><dt>Deadline</dt><dd>${date(b.deadline)}</dd></div>
        <div><dt>Status</dt><dd>${esc(b.status ?? '—')}</dd></div>
      </dl>
      ${(b.skills?.length) ? `<h2>Skills</h2><p>${b.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join(' ')}</p>` : ''}
      <p><a href="https://make.fun/bounty/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">Open on make.fun ↗</a></p>
    </aside>
  </section>`;
}

/* ---------- leaderboard ---------- */

export function leaderboardPage(lb, slug, page, perPage) {
  const cols = (lb.columns ?? []).filter((c) => !c.hidden);
  const entries = lb.entries ?? [];
  const pages = Math.max(1, Math.ceil(entries.length / perPage));
  const slice = entries.slice((page - 1) * perPage, page * perPage);
  const cell = (e, c) => {
    const v = e.values?.[c.key];
    if (c.key === 'judge') return pct(v);
    if (c.key === 'bytes') return bytes(v);
    if (c.key === 'valid') return v ? '✓' : '—';
    return esc(e.display?.[c.key] ?? v ?? '—');
  };
  const views = (lb.views ?? []).map((v) =>
    `<a class="chip-btn ${lb.view === v ? 'on' : ''}" href="#/bounty/${encodeURIComponent(slug)}/leaderboard?view=${v}">${esc(v)}</a>`).join(' ');
  return `
  <p class="crumb"><a href="#/bounty/${encodeURIComponent(slug)}">← ${esc(lb.competition?.title ?? slug)}</a></p>
  <h1>Leaderboard — ${esc(lb.competition?.title ?? slug)}</h1>
  <p class="lede">${esc(lb.title ?? 'Results')} · ranked by ${esc(lb.rank_key ?? 'judge')}${lb.phase?.scores_visible === false ? ' · scores hidden until results publish' : ''}</p>
  ${views ? `<p class="views" role="group" aria-label="Leaderboard view">${views}</p>` : ''}
  ${!entries.length
    ? '<p class="empty">No ranked entries yet. Placements are held until the bounty is finalised — check back after the deadline.</p>'
    : `<div class="tbl-wrap"><table class="tbl lb"><thead><tr><th scope="col">#</th><th scope="col">Entrant</th><th scope="col">Entry</th>${cols.map((c) => `<th scope="col">${esc(c.title)}</th>`).join('')}</tr></thead><tbody>${
      slice.map((e) => `<tr><td>${num(e.rank)}</td><td>${avatarImg(e.image, e.handle)}<a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a>${e.prize_rank ? ` <span class="chip">pays #${num(e.prize_rank)}</span>` : ''}</td><td>${esc(e.title)}</td>${cols.map((c) => `<td>${cell(e, c)}</td>`).join('')}</tr>`).join('')
    }</tbody></table></div>${pager(page, pages)}`}
  <p class="count">${num(entries.length)} ranked entries · tie-break: ${esc(lb.tie_break?.title ?? '—')} (${esc(lb.tie_break?.better ?? '')} is better)</p>`;
}

/* ---------- profile ---------- */

export function profilePage(p) {
  const rec = p.record ?? {};
  const links = [];
  if (p.github_login) links.push(`<a href="https://github.com/${encodeURIComponent(p.github_login)}" target="_blank" rel="noopener">GitHub @${esc(p.github_login)}</a>`);
  if (p.x?.url) links.push(`<a href="${esc(p.x.url)}" target="_blank" rel="noopener">X @${esc(p.x.username ?? '')}</a>`);
  if (p.discord?.url) links.push(`<a href="${esc(p.discord.url)}" target="_blank" rel="noopener">Discord ${esc(p.discord.global_name ?? p.discord.username ?? '')}</a>`);
  if (p.wallet?.address) links.push(`<a href="${esc(p.wallet.explorer_url ?? '')}" target="_blank" rel="noopener">Wallet ${shortAddr(p.wallet.address)}</a>`);
  const sols = p.solutions ?? [];
  return `
  <section class="hero prof">
    ${avatarImg(p.avatar?.url ?? p.image, p.handle, 'ava big')}
    <div>
      <h1>${esc(p.display_name ?? p.handle)}</h1>
      <p class="handle">@${esc(p.handle)} · joined ${date(p.joined_at)}</p>
      ${p.bio ? `<p class="lede">${esc(p.bio)}</p>` : ''}
      ${links.length ? `<p class="links">${links.join(' · ')}</p>` : ''}
    </div>
    <dl class="record" aria-label="Record">
      <div><dt>Entered</dt><dd>${num(rec.competitions_entered)}</dd></div>
      <div><dt>Placed</dt><dd>${num(rec.competitions_placed)}</dd></div>
      <div><dt>Won</dt><dd>${num(rec.competitions_won)}</dd></div>
      <div><dt>Best</dt><dd>${rec.best_placement ? `#${num(rec.best_placement)}` : '—'}</dd></div>
      <div><dt>Prize money</dt><dd>${money(rec.prize_usd)}</dd></div>
    </dl>
  </section>
  <h2>Entries (${num(sols.length)})</h2>
  ${!sols.length ? '<p class="empty">No public entries yet.</p>' : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Entry</th><th scope="col">Bounty</th><th scope="col">Place</th><th scope="col">Score</th><th scope="col">Prize</th><th scope="col">Entered</th></tr></thead><tbody>${
    sols.map((s) => `<tr>
      <td><a href="https://make.fun/s/${encodeURIComponent(s.submission_id)}" target="_blank" rel="noopener">${esc(s.title)}</a></td>
      <td><a href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.competition.title)}</a></td>
      <td>${s.placement ? `#${num(s.placement)}` : '—'}</td>
      <td>${s.score ? (s.score.column?.key === 'judge' ? pct(s.score.value) : esc(s.score.display ?? s.score.value)) : '—'}</td>
      <td>${s.prize_usd ? money(s.prize_usd) : '—'}</td>
      <td>${date(s.entered_at)}</td></tr>`).join('')
  }</tbody></table></div>`}`;
}

/* ---------- errors ---------- */

export function errorPage(title, message) {
  return `<h1>${esc(title)}</h1><p class="empty">${esc(message)}</p><p><a class="btn" href="#/">Back to the board</a></p>`;
}

export function loadingPage(label) {
  return `<p class="empty" aria-live="polite">Loading ${esc(label)}…</p>`;
}
