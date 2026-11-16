// Small helpers for showing API values. Everything that reaches the page
// goes through esc() first; numbers and dates are formatted once, here.

/** Text made safe to put inside HTML.
 *  Numeric character references (&#38; etc.) are safe in both text nodes
 *  and quoted attribute values, so one escaper covers every insertion. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('656.50', 500 or null) as '$656.50' or '$500'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

/** A count as '1,234'. */
export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

/** A deadline as a short UTC date, e.g. '17 Nov 2026, 12:30 UTC'. */
export function date(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  }) + ' UTC';
}

/** Time until a deadline: '2d 4h left', '35m left', '12s left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return `${Math.floor(ms / 1000)}s left`;
}

/** Whether a bounty still takes entries: its deadline, not its status, decides.
 *  The API keeps status "open" past the deadline, so trusting status alone
 *  would show a dead bounty as enterable. */
export function takesEntries(b) {
  return b?.deadline ? new Date(b.deadline).getTime() > Date.now() : false;
}

/** A micro-unit score (950587) as a percent ('95.06%'). */
export function pct(micro) {
  const n = Number(micro);
  return Number.isFinite(n) ? `${(n / 10000).toFixed(2)}%` : '—';
}

/** A byte count as '660 KB'. */
export function bytes(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** An API image path (relative '/api/...' or absolute) as a full URL. */
export function imgUrl(url) {
  if (!url) return '';
  return url.startsWith('/') ? `https://make.fun${url}` : url;
}

/** Shorten a Solana address: '8pUK…yGnx'. */
export function shortAddr(addr) {
  return addr && addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : (addr ?? '—');
}
