// make.fun public API client — GET only, read-only, no key, no sign-in.
//
// The API answers any origin (Access-Control-Allow-Origin: *) and sends
// Cache-Control: private, no-cache with an ETag. This module keeps one
// in-memory cache per URL with a 60 second lifetime and de-duplicates
// in-flight requests, so a view costs few requests and a re-visit inside
// the minute reuses the answer instead of fetching again.

const BASE = "https://make.fun/api";
const TTL_MS = 60_000;

const cache = new Map(); // url -> { at: number, data: unknown }
const inflight = new Map(); // url -> Promise<unknown>

function cacheKey(path) {
  return BASE + path;
}

async function getJson(path, { force = false } = {}) {
  const url = cacheKey(path);
  const now = Date.now();
  if (!force) {
    const hit = cache.get(url);
    if (hit && now - hit.at < TTL_MS) return hit.data;
    const pending = inflight.get(url);
    if (pending) return pending;
  }
  const promise = (async () => {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const err = new Error(`make.fun API ${res.status} for ${path}`);
      err.status = res.status;
      err.path = path;
      throw err;
    }
    const data = await res.json();
    cache.set(url, { at: Date.now(), data });
    return data;
  })();
  inflight.set(url, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(url);
  }
}

function query(params) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

// The board. Follows next_cursor until every page is in, so the board
// shows all live bounties, not just the first page.
export async function listCompetitions({ status, category, force = false } = {}) {
  const items = [];
  let cursor = undefined;
  let guard = 0;
  do {
    const page = await getJson(
      `/competitions${query({ status, category, cursor, limit: 100 })}`,
      { force: force && guard === 0 },
    );
    items.push(...(page.items || []));
    cursor = page.next_cursor || undefined;
    guard += 1;
  } while (cursor && guard < 20);
  return items;
}

// One bounty, with its embedded entries when the server includes them.
export function getCompetition(slug, { force = false } = {}) {
  return getJson(`/competitions/${encodeURIComponent(slug)}`, { force });
}

// A bounty's ranked entries. rows caps the page the server sends.
export function getLeaderboard(slug, { rows = 100, force = false } = {}) {
  return getJson(
    `/competitions/${encodeURIComponent(slug)}/leaderboard${query({ rows })}`,
    { force },
  );
}

// A bounty's entries (submissions), newest first, paged by cursor.
export async function listSubmissions(slug, { limit = 50, force = false } = {}) {
  const items = [];
  let cursor = undefined;
  let guard = 0;
  do {
    const page = await getJson(
      `/competitions/${encodeURIComponent(slug)}/submissions${query({ limit, cursor })}`,
      { force: force && guard === 0 },
    );
    items.push(...(page.items || []));
    cursor = page.next_cursor || undefined;
    guard += 1;
  } while (cursor && guard < 10 && items.length < 200);
  return items;
}

// An account's public profile: links, record and solutions.
export function getProfile(handle, { force = false } = {}) {
  return getJson(`/profiles/${encodeURIComponent(handle)}`, { force });
}

// Drop one cached answer, or the whole cache (used by the 60s revalidate).
export function bustCache(path) {
  if (path) cache.delete(cacheKey(path));
  else cache.clear();
}
