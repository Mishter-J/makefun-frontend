// Small formatting helpers for API values. Everything is escaped before
// it is put into HTML; money and dates are shown in USD / UTC.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A whole number with thousands separators. */
export function num(value) {
  return Number(value ?? 0).toLocaleString('en-US');
}

/** A dollar amount ('523.50', 500 or 0.5) as '$523.50' or '$500'. */
export function money(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** A deadline as a short UTC date + time. */
export function date(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** Time left until a deadline: '2d 4h', '3h 11m', '42m 09s', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s left`;
  return `${seconds}s left`;
}

/** Whether a bounty still takes entries: judged by its deadline, never by
    its status alone — a bounty past deadline may still read status open
    until its results are published. */
export function takingEntries(bounty) {
  if (bounty.acceptingSubmissions === false) return false;
  return new Date(bounty.deadline).getTime() > Date.now();
}

/** A long wallet address shortened for display. */
export function shortAddr(address) {
  const a = String(address ?? '');
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** A judge win rate in micro units (850346) as '85.03%'. */
export function winRate(micro) {
  return `${(Number(micro ?? 0) / 10000).toFixed(2)}%`;
}
