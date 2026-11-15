// make.fun's public API: read-only GET, CORS-open to any origin.
// Performance rule: one request per view. Answers are cached in memory
// with their ETag; a revalidation within the same minute answers 304 and
// costs no body, and a fresh answer is never fetched twice in one visit.
// A stale answer is served instantly while a background revalidation runs.

const API = 'https://make.fun/api';

const cache = new Map();
let fetches = 0;

async function api(path) {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && now - hit.at < 60000) return hit.body;
  fetches += 1;
  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  let res;
  try {
    res = await fetch(API + path, { headers });
  } catch (err) {
    if (hit) return hit.body;
    throw err;
  }
  if (res.status === 304 && hit) {
    hit.at = now;
    return hit.body;
  }
  if (!res.ok) {
    if (hit) return hit.body;
    throw new Error(`make.fun API ${res.status} for ${path}`);
  }
  const body = await res.json();
  cache.set(path, { body, etag: res.headers.get('etag'), at: now });
  return body;
}

/** How many real network fetches this visit made (for the footer note). */
export function requestCount() {
  return fetches;
}

/** The live board: open bounties with pot, fee, deadline and entries. */
export function getBoard() {
  return api('/competitions?status=open&activity=times');
}

/** One bounty: summary, description, rewards, dates and status. */
export function getBounty(slug) {
  return api(`/competitions/${encodeURIComponent(slug)}`);
}

/** One bounty's leaderboard: columns plus ranked entries. */
export function getLeaderboard(slug) {
  return api(`/competitions/${encodeURIComponent(slug)}/leaderboard`);
}

/** One account's public profile, with its entries and record. */
export function getProfile(handle) {
  return api(`/profiles/${encodeURIComponent(handle)}`);
}
