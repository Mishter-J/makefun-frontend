// Ledger router: hash routes, one cached request per view, and a live
// countdown that ticks without refetching or rebuilding the page.
//
//   #/                          the bounty board
//   #/bounty/<slug>             one bounty (overview)
//   #/bounty/<slug>/leaderboard that bounty's leaderboard
//   #/u/<handle>                an account's public profile
//
// window.__shotReady is false while a route loads and true once its data
// has rendered, so a screenshot script knows when to capture.

import { getBoard, getBounty, getLeaderboard, getProfile } from './api.js';
import { boardView, bountyView, leaderboardTable, profileView } from './views.js';
import { takingEntries, timeLeft } from './format.js';

const app = document.getElementById('app');
const PAGE = 10;

const boardState = { q: '', filter: 'all', sort: 'time', page: 0, items: null };

function setReady() {
  window.__shotReady = true;
}

function fail(err) {
  app.innerHTML = `<p class="error">Could not load live data from make.fun (${err.message}). <a href="${location.hash || '#/'}">Try again</a></p>`;
  document.title = 'Ledger — a fast make.fun frontend';
  setReady();
}

/** Filter + sort the board in memory; the list is one fetch, reused. */
function boardSlice() {
  const q = boardState.q.trim().toLowerCase();
  let list = boardState.items ?? [];
  if (boardState.filter === 'open') list = list.filter((b) => takingEntries(b));
  if (boardState.filter === 'soon') {
    list = list.filter((b) => {
      const ms = new Date(b.deadline).getTime() - Date.now();
      return ms > 0 && ms < 86400000;
    });
  }
  if (q) {
    list = list.filter((b) =>
      [b.title, b.category, b.slug, ...(b.skills ?? []), b.sponsor?.name]
        .join(' ').toLowerCase().includes(q));
  }
  const by = {
    // Time left, but bounties still taking entries first: a board whose
    // first rows are all "ended" reads dead even when it is live.
    time: (a, b) => Number(!takingEntries(a)) - Number(!takingEntries(b)) || new Date(a.deadline) - new Date(b.deadline),
    pot: (a, b) => Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0),
    entries: (a, b) => Number(b.submissionCount ?? 0) - Number(a.submissionCount ?? 0),
  }[boardState.sort];
  list = [...list].sort(by);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  boardState.page = Math.min(boardState.page, pages - 1);
  return { filtered: list, pages, pageItems: list.slice(boardState.page * PAGE, boardState.page * PAGE + PAGE) };
}

function renderBoard() {
  const state = { ...boardState, ...boardSlice() };
  app.innerHTML = boardView(boardState.items, state);
  document.title = 'Ledger — a fast make.fun frontend';
  const q = document.getElementById('q');
  q.addEventListener('input', () => {
    boardState.q = q.value;
    boardState.page = 0;
    const pos = q.selectionStart;
    renderBoard();
    const next = document.getElementById('q');
    next.focus();
    next.setSelectionRange(pos, pos);
  });
  document.getElementById('sort').addEventListener('change', (e) => {
    boardState.sort = e.target.value;
    renderBoard();
  });
  app.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      boardState.filter = btn.dataset.filter;
      boardState.page = 0;
      renderBoard();
    });
  });
  document.getElementById('prev')?.addEventListener('click', () => {
    boardState.page = Math.max(0, boardState.page - 1);
    renderBoard();
  });
  document.getElementById('next')?.addEventListener('click', () => {
    boardState.page += 1;
    renderBoard();
  });
  setReady();
}

async function renderBounty(slug, tab) {
  try {
    const b = await getBounty(slug);
    // The leaderboard loads only when its tab opens: one extra request,
    // and only then — the overview stays a single request.
    const lb = tab === 'leaderboard' ? await getLeaderboard(slug) : null;
    app.innerHTML = bountyView(b, lb, tab);
    document.title = `${b.title} | Ledger`;
    setReady();
  } catch (err) {
    fail(err);
  }
}

async function renderProfile(handle) {
  try {
    const p = await getProfile(handle);
    app.innerHTML = profileView(p);
    document.title = `${p.display_name ?? p.handle} | Ledger`;
    setReady();
  } catch (err) {
    fail(err);
  }
}

async function route() {
  window.__shotReady = false;
  const hash = location.hash || '#/';
  const bounty = hash.match(/^#\/bounty\/([^/]+)(\/leaderboard)?$/);
  const profile = hash.match(/^#\/u\/([^/]+)$/);
  if (bounty) {
    app.innerHTML = '<p class="loading">Loading bounty…</p>';
    await renderBounty(decodeURIComponent(bounty[1]), bounty[2] ? 'leaderboard' : 'overview');
  } else if (profile) {
    app.innerHTML = '<p class="loading">Loading profile…</p>';
    await renderProfile(decodeURIComponent(profile[1]));
  } else {
    if (!boardState.items) {
      app.innerHTML = '<p class="loading">Loading live bounties…</p>';
      try {
        const data = await getBoard();
        boardState.items = data.items ?? [];
      } catch (err) {
        fail(err);
        return;
      }
    }
    renderBoard();
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

// The countdown ticks once a second by rewriting only the time-left
// text nodes — no refetch, no page rebuild.
setInterval(() => {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    el.textContent = timeLeft(el.dataset.deadline);
  });
}, 1000);

route();
