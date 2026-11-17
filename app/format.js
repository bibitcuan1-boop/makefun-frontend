// Formatting for money, dates and time-left. Pure functions, no I/O.

// Money in the API arrives as a number (rewardAmount) or as a string
// with two decimals ("726.50"). Both are handled; null means "none set".
export function usd(value, { decimals = 2 } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return "$" + n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function usdOr(value, fallback) {
  return usd(value) ?? fallback;
}

// Whole dollars for big headline figures: "$726" instead of "$726.50".
export function usdWhole(value) {
  return usd(value, { decimals: 0 });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(iso)} ${hh}:${mm} UTC`;
}

// "3d 5h", "11h 20m", "42m", "28s" — or null once the deadline passed.
export function timeLeft(iso, now = Date.now()) {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - now;
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function isPast(iso, now = Date.now()) {
  if (!iso) return false;
  const end = new Date(iso).getTime();
  return !Number.isNaN(end) && end <= now;
}

// A bounty takes entries while its deadline is ahead. Its status field
// alone cannot say this: a bounty past its deadline may still read
// "open" until its results are published.
export function acceptsEntries(comp, now = Date.now()) {
  if (!comp) return false;
  if (comp.acceptingSubmissions === false) return false;
  if (comp.deadline) return !isPast(comp.deadline, now);
  return comp.status === "open";
}

export function entryStatus(comp, now = Date.now()) {
  if (acceptsEntries(comp, now)) {
    const left = timeLeft(comp.deadline, now);
    if (left && new Date(comp.deadline).getTime() - now < 24 * 3600 * 1000) {
      return { kind: "soon", label: "Closing soon" };
    }
    return { kind: "open", label: "Open for entries" };
  }
  return { kind: "closed", label: "Entries closed" };
}

// Judge win rate: the API stores it in micro units, 956066 = 95.6066%.
export function winRate(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return (n / 10000).toFixed(1) + "%";
}

export function compact(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("en-US");
}

export function plural(n, one, many) {
  return Number(n) === 1 ? one : many;
}

// Escape anything the API (or a handle in the URL) gives us before it
// goes into HTML. Titles, bios and descriptions are all untrusted text.
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
