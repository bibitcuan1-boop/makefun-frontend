// make.fun public API, read-only GET. One tiny cache: answers are kept for
// 60 s and revalidated with If-None-Match (the API's ETags are bound to the
// minute, so a revalidation inside the same minute answers 304 and costs
// almost nothing). Every call is counted in window.__apiStats so the footer
// can show how little the app actually asks for.

const API = 'https://make.fun/api';
const TTL = 60_000;

const cache = new Map(); // path -> { etag, body, at }
export const stats = { requests: 0, served304: 0, bytes: 0 };
if (typeof window !== 'undefined') window.__apiStats = stats;

async function get(path) {
  const hit = cache.get(path);
  const fresh = hit && Date.now() - hit.at < TTL;
  if (fresh) return hit.body;
  stats.requests += 1;
  const headers = {};
  if (hit?.etag) headers['If-None-Match'] = hit.etag;
  const res = await fetch(API + path, { headers });
  if (res.status === 304 && hit) {
    stats.served304 += 1;
    hit.at = Date.now();
    return hit.body;
  }
  const text = await res.text();
  stats.bytes += text.length;
  if (!res.ok) {
    let message = `make.fun answered ${res.status}`;
    try {
      const err = JSON.parse(text);
      if (err?.error?.[0]?.message) message = err.error[0].message;
    } catch { /* keep the status message */ }
    const e = new Error(message);
    e.status = res.status;
    throw e;
  }
  const body = JSON.parse(text);
  cache.set(path, { etag: res.headers.get('etag'), body, at: Date.now() });
  return body;
}

/** Live bounties, newest activity first is the API's order; activity=times keeps each listing light. */
export const getBounties = () => get('/competitions?status=open&activity=times');

/** One bounty, with its rewards table and live pot; submissions=summary skips the (huge) entry list. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}?submissions=summary`);

/** A bounty's leaderboard in one view (overall or performance). */
export const getLeaderboard = (slug, view = 'performance') =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard?view=${view}`);

/** An account's public profile: links, record and solutions. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
