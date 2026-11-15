// The four surfaces, each a function from live API data to HTML.
// Board, bounty page, leaderboard and profile — every link is a real
// hash route, so each surface has its own URL as well as its link.

import { date, esc, money, num, shortAddr, takingEntries, timeLeft, winRate } from './format.js';

/** The live pot: entry fees paid in join the pot, so potUsd is the number. */
export function potOf(b) {
  return money(b.potUsd ?? b.rewardAmount);
}

export function feeOf(b) {
  const fee = Number(b.entryFeeUsd ?? 0);
  return fee > 0 ? money(fee) : 'Free';
}

function bountyLink(b) {
  return `#/bounty/${encodeURIComponent(b.slug)}`;
}

function profileLink(handle) {
  return `#/u/${encodeURIComponent(handle)}`;
}

function statusPill(b) {
  if (takingEntries(b)) {
    const ms = new Date(b.deadline).getTime() - Date.now();
    if (ms < 86400000) return '<span class="pill soon">Closing soon</span>';
    return '<span class="pill open">Taking entries</span>';
  }
  return '<span class="pill closed">Entries closed</span>';
}

function skillTags(b) {
  return (b.skills ?? []).slice(0, 4).map((s) => `<span class="tag">${esc(s)}</span>`).join('');
}

/** The board: stats strip, search + filter + sort, paginated dense table. */
export function boardView(items, state) {
  const open = items.filter((b) => takingEntries(b));
  const totalPot = items.reduce((sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const totalEntries = items.reduce((sum, b) => sum + Number(b.submissionCount ?? 0), 0);
  const rows = state.pageItems
    .map(
      (b) => `
      <tr>
        <td>
          <a class="title" href="${bountyLink(b)}">${esc(b.title)}</a>
          <div class="sub">${esc(b.category ?? '')} · ${esc(b.sponsor?.name ?? '')}</div>
          <div>${skillTags(b)}</div>
        </td>
        <td class="pot"><small>Live pot</small>${potOf(b)}</td>
        <td class="num">${feeOf(b)}</td>
        <td class="num">${num(b.submissionCount)}</td>
        <td class="num"><span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span><br>${statusPill(b)}</td>
      </tr>`,
    )
    .join('');
  return `
  <section class="hero">
    <h1>Every open bounty.<br>One fast board.</h1>
    <p class="lede">Live pots, entry fees and time left, straight from make.fun's public API —
    cached, revalidated, no sign-in, no framework.</p>
  </section>
  <section class="stats" aria-label="Board totals">
    <div class="stat"><b>${money(totalPot)}</b><span>Live prize pots</span></div>
    <div class="stat"><b>${num(open.length)} / ${num(items.length)}</b><span>Taking entries</span></div>
    <div class="stat"><b>${num(totalEntries)}</b><span>Entries on the board</span></div>
    <div class="stat"><b>${num(items.length)}</b><span>Open bounties</span></div>
  </section>
  <div class="controls">
    <input type="search" id="q" placeholder="Search titles, skills, categories…" value="${esc(state.q)}" aria-label="Search bounties">
    <button class="chip" data-filter="all" aria-pressed="${state.filter === 'all'}">All bounties</button>
    <button class="chip" data-filter="open" aria-pressed="${state.filter === 'open'}">Taking entries</button>
    <button class="chip" data-filter="soon" aria-pressed="${state.filter === 'soon'}">Ending &lt; 24h</button>
    <select id="sort" aria-label="Sort bounties">
      <option value="time" ${state.sort === 'time' ? 'selected' : ''}>Sort: time left</option>
      <option value="pot" ${state.sort === 'pot' ? 'selected' : ''}>Sort: live pot</option>
      <option value="entries" ${state.sort === 'entries' ? 'selected' : ''}>Sort: entries</option>
    </select>
    <span class="count">${num(state.filtered.length)} shown</span>
  </div>
  ${rows ? `<table>
    <thead><tr><th>Bounty / category</th><th class="num">Live pot</th><th class="num">Entry fee</th><th class="num">Entries</th><th class="num">Time left</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>` : '<p>No bounties match that search.</p>'}
  <div class="pager">
    <button id="prev" ${state.page === 0 ? 'disabled' : ''}>← Newer</button>
    <span>Page ${state.page + 1} of ${Math.max(1, state.pages)}</span>
    <button id="next" ${state.page + 1 >= state.pages ? 'disabled' : ''}>Older →</button>
  </div>`;
}

/** Minimal markdown for a bounty description: headings, bold, lists. */
export function md(text) {
  const lines = String(text ?? '').split('\n');
  let out = '';
  let inList = false;
  const closeList = () => {
    if (inList) { out += '</ul>'; inList = false; }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('## ')) { closeList(); out += `<h3>${esc(line.slice(3))}</h3>`; }
    else if (line.startsWith('### ')) { closeList(); out += `<h3>${esc(line.slice(4))}</h3>`; }
    else if (line.startsWith('- ')) {
      if (!inList) { out += '<ul>'; inList = true; }
      out += `<li>${esc(line.slice(2)).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</li>`;
    } else if (line === '') { closeList(); }
    else {
      closeList();
      out += `<p>${esc(line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>`;
    }
  }
  closeList();
  return out;
}

/** A bounty's page: facts, rewards table, dates, rules, leaderboard tab. */
export function bountyView(b, lb, tab) {
  const open = takingEntries(b);
  const rewards = Object.entries(b.rewards ?? {})
    .sort((a, b2) => Number(a[0]) - Number(b2[0]))
    .map(([place, amount]) => `<tr><td>${place === '1' ? '🥇 1st' : place === '2' ? '🥈 2nd' : place === '3' ? '🥉 3rd' : `${place}th`}</td><td class="num">${money(amount)}</td></tr>`)
    .join('');
  const phases = (b.phases ?? []).map((p) => `<li><strong>${esc(p.title)}</strong> — ${date(p.startsAt)} to ${date(p.endsAt)}</li>`).join('');
  const body = tab === 'leaderboard' ? leaderboardTable(lb, b.slug) : `
    <h2>About this bounty</h2>
    <div class="desc">${md(b.description)}</div>
    <h2>Rewards</h2>
    <p>Live pot <strong>${potOf(b)}</strong> — the ${money(b.rewardAmount)} prize plus every entry fee paid in.</p>
    <table class="rewards"><thead><tr><th>Place</th><th class="num">Prize</th></tr></thead><tbody>${rewards || '<tr><td colspan="2">No rewards table published.</td></tr>'}</tbody></table>
    <h2>Dates</h2>
    <ul>${phases || `<li>Entries close ${date(b.deadline)}</li>`}</ul>`;
  return `
  <p class="crumbs"><a href="#/">All bounties</a> · ${esc(b.category ?? '')}</p>
  <h1>${esc(b.title)}</h1>
  <p>${statusPill(b)} ${b.sponsor ? `<span class="sub">by ${esc(b.sponsor.name)}</span>` : ''}</p>
  <p class="lede">${esc(b.summary ?? '')}</p>
  <dl class="facts">
    <div class="fact"><dt>Live pot</dt><dd>${potOf(b)}<small>prize ${money(b.rewardAmount)}</small></dd></div>
    <div class="fact"><dt>1st place</dt><dd>${money(b.rewards?.['1'] ?? 0)}</dd></div>
    <div class="fact"><dt>Entry fee</dt><dd>${feeOf(b)}</dd></div>
    <div class="fact"><dt>Deadline</dt><dd><span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span><small>${date(b.deadline)}</small></dd></div>
    <div class="fact"><dt>Entries</dt><dd>${num(b.submissionCount)}</dd></div>
    <div class="fact"><dt>Status</dt><dd>${open ? 'Taking entries' : 'Entries closed'}<small>judged by deadline, not status alone</small></dd></div>
  </dl>
  <nav class="tabs" aria-label="Bounty sections">
    <a href="${bountyLink(b)}" ${tab !== 'leaderboard' ? 'aria-current="page"' : ''}>Overview</a>
    <a href="${bountyLink(b)}/leaderboard" ${tab === 'leaderboard' ? 'aria-current="page"' : ''}>Leaderboard${lb ? ` (${num(lb.entries?.length ?? 0)})` : ''}</a>
  </nav>
  ${body}`;
}

/** A leaderboard table: rank, builder, entry, score, record. */
export function leaderboardTable(lb, slug) {
  if (!lb) return '<p class="loading">Loading leaderboard…</p>';
  const entries = lb.entries ?? [];
  const key = lb.rank_key ?? 'judge';
  const col = (lb.columns ?? []).find((c) => c.key === key);
  if (!entries.length) return '<p>No entries yet — be the first to build.</p>';
  const rows = entries
    .map((e) => {
      const score = e.values?.[key];
      const shown = key === 'judge' && typeof score === 'number' ? winRate(score) : esc(e.display?.[key] ?? score ?? '—');
      const record = e.judge ? `${num(e.judge.wins)}W · ${num(e.judge.draws)}D · ${num(e.judge.losses)}L` : '';
      const avatar = e.image ? `<img crossorigin="anonymous" src="https://make.fun${esc(e.image)}" alt="" width="28" height="28" style="border-radius:50%;vertical-align:-8px;margin-right:6px" loading="lazy">` : '';
      return `<tr>
        <td class="num"><strong>${num(e.rank)}</strong>${e.prize_rank ? `<br><span class="sub">prize #${num(e.prize_rank)}</span>` : ''}</td>
        <td>${avatar}<a href="${profileLink(e.handle)}">${esc(e.handle)}</a><div class="sub">${record}</div></td>
        <td>${esc(e.title ?? '')}<div class="sub">${e.status ?? ''}${e.valid === 0 ? ' · invalid' : ''}</div></td>
        <td class="num"><strong>${shown}</strong><div class="sub">${esc(col?.title ?? 'Score')}</div></td>
      </tr>`;
    })
    .join('');
  return `
  <h2>Leaderboard — ${esc(lb.competition?.title ?? slug)}</h2>
  <p class="sub">${num(entries.length)} entries · ranked by ${esc(col?.title ?? key)} · ${esc(lb.phase?.title ?? '')} phase</p>
  <table><thead><tr><th class="num">Rank</th><th>Builder</th><th>Entry</th><th class="num">Score</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** An account's public profile: identity, record, every entry. */
export function profileView(p) {
  const r = p.record ?? {};
  const initial = String(p.display_name ?? p.handle ?? '?').slice(0, 1).toUpperCase();
  const avatar = p.image || p.avatar
    ? `<img class="avatar" crossorigin="anonymous" src="https://make.fun${esc(p.image ?? p.avatar)}" alt="Avatar of ${esc(p.display_name ?? p.handle)}" loading="lazy">`
    : `<span class="avatar-fallback" aria-hidden="true">${esc(initial)}</span>`;
  const rows = (p.solutions ?? [])
    .map((s) => `<tr>
      <td><a class="title" href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.title)}</a><div class="sub">${esc(s.competition.title)}</div></td>
      <td class="num">${s.placement ? `#${num(s.placement)}` : '—'}</td>
      <td class="num">${s.prize_usd ? money(s.prize_usd) : '—'}</td>
      <td class="num">${esc(s.score?.display ?? '—')}</td>
    </tr>`)
    .join('');
  return `
  <div class="profile-head">
    ${avatar}
    <div>
      <h1 style="margin:0">${esc(p.display_name ?? p.handle)}</h1>
      <p class="handle">@${esc(p.handle)} · joined ${date(p.joined_at)}</p>
      ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
      ${p.wallet?.address ? `<p class="wallet">Wallet ${esc(shortAddr(p.wallet.address))} · <a href="${esc(p.wallet.explorer_url)}">Solscan ↗</a></p>` : ''}
      ${p.github_login ? `<p>GitHub: ${esc(p.github_login)}</p>` : ''}
    </div>
  </div>
  <section class="stats" aria-label="Builder record">
    <div class="stat"><b>${num(r.competitions_entered)}</b><span>Bounties entered</span></div>
    <div class="stat"><b>${num(r.competitions_placed)}</b><span>Placements</span></div>
    <div class="stat"><b>${num(r.competitions_won)}</b><span>Wins</span></div>
    <div class="stat"><b>${r.best_placement ? `#${num(r.best_placement)}` : '—'}</b><span>Best placement</span></div>
  </section>
  <h2>Entries (${num((p.solutions ?? []).length)})</h2>
  ${rows ? `<table><thead><tr><th>Entry</th><th class="num">Place</th><th class="num">Prize</th><th class="num">Score</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>No entries yet.</p>'}`;
}
