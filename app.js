(() => {
  'use strict';

  const STORAGE_KEY = 'flip7.game.v1';
  const $ = (id) => document.getElementById(id);

  // ---------- State ----------
  // game = { players: string[], target: number, rounds: (number|null)[][] }
  // A null score means that player didn't play the round (tie-break rounds only).
  let game = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const g = JSON.parse(raw);
      if (!Array.isArray(g.players) || !Array.isArray(g.rounds)) return null;
      return g;
    } catch { return null; }
  }
  function save() {
    try {
      if (game) localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* storage unavailable: keep in memory */ }
  }

  // ---------- Game logic ----------
  function analyzeRounds(players, target, rounds) {
    const totals = players.map(() => 0);
    const tbFlags = [];
    let status = { state: 'playing', contenders: players.map((_, i) => i) };
    for (const r of rounds) {
      tbFlags.push(status.state === 'tiebreak');
      r.forEach((s, i) => { if (s != null) totals[i] += s; });
      status = statusFor(totals, target, status);
    }
    return { totals, status, tbFlags };
  }

  function statusFor(totals, target, prev) {
    // Only contenders of an ongoing tie-break can win it.
    const pool = prev.state === 'tiebreak' ? prev.contenders : totals.map((_, i) => i);
    const max = Math.max(...pool.map((i) => totals[i]));
    if (max < target) return { state: 'playing', contenders: totals.map((_, i) => i) };
    const leaders = pool.filter((i) => totals[i] === max);
    if (leaders.length === 1) return { state: 'won', winner: leaders[0], contenders: leaders };
    return { state: 'tiebreak', contenders: leaders };
  }

  function analyze() { return analyzeRounds(game.players, game.target, game.rounds); }

  function ranking(totals) {
    const order = totals.map((t, i) => i).sort((a, b) => totals[b] - totals[a] || a - b);
    let rank = 0, prev = null;
    return order.map((i, pos) => {
      if (totals[i] !== prev) { rank = pos + 1; prev = totals[i]; }
      return { i, rank };
    });
  }

  function parseNames(str) {
    const seen = new Set();
    const out = [];
    for (let n of str.split(',')) {
      n = n.trim().replace(/\s+/g, ' ');
      if (!n) continue;
      let name = n, k = 2;
      while (seen.has(name.toLowerCase())) name = `${n} ${k++}`;
      seen.add(name.toLowerCase());
      out.push(name);
    }
    return out;
  }

  // ---------- Rendering ----------
  function show(screen) {
    for (const s of ['setup', 'game', 'results']) $(`screen-${s}`).hidden = s !== screen;
    $('btn-new-top').hidden = screen === 'setup';
    window.scrollTo(0, 0);
  }

  function render() {
    if (!game) {
      show('setup');
      return;
    }
    const a = analyze();
    if (a.status.state === 'won') renderResults(a);
    else renderGame(a);
  }

  function el(tag, props = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const c of children) if (c != null) e.append(c);
    return e;
  }

  function renderStandings(list, totals, contenders, showProgress) {
    list.replaceChildren();
    for (const { i, rank } of ranking(totals)) {
      const nameCell = el('div', { class: 'name', text: game.players[i] });
      if (showProgress) {
        const pct = Math.min(100, Math.max(0, (totals[i] / game.target) * 100));
        const bar = el('div', { class: 'progress' }, el('span', { style: `width:${pct}%` }));
        const left = game.target - totals[i];
        nameCell.append(el('span', { class: 'sub', text: left > 0 ? `${left} to go` : 'Reached target' }), bar);
      }
      const li = el('li', {},
        el('span', { class: 'rank', text: String(rank) }),
        nameCell,
        el('span', { class: 'total', text: String(totals[i]) }));
      if (rank === 1) li.classList.add('first');
      if (contenders && !contenders.includes(i)) li.classList.add('out');
      list.append(li);
    }
  }

  function scoreInputs(container, values, enabledIdx, prefix) {
    container.replaceChildren();
    game.players.forEach((name, i) => {
      if (!enabledIdx.includes(i)) return;
      const id = `${prefix}-${i}`;
      const input = el('input', {
        id, type: 'number', inputmode: 'numeric', pattern: '[0-9]*',
        min: '0', step: '1', placeholder: '0', 'data-i': String(i),
      });
      if (values && values[i] != null) input.value = values[i];
      container.append(el('div', { class: 'row' }, el('label', { for: id, text: name }), input));
    });
  }

  function readInputs(container) {
    const scores = game.players.map(() => null);
    for (const input of container.querySelectorAll('input')) {
      const v = input.value.trim() === '' ? 0 : Number(input.value);
      if (!Number.isInteger(v) || v < 0) {
        input.focus();
        input.setCustomValidity('Enter a whole number, 0 or more');
        input.reportValidity();
        input.addEventListener('input', () => input.setCustomValidity(''), { once: true });
        return null;
      }
      scores[Number(input.dataset.i)] = v;
    }
    return scores;
  }

  function renderHistory(table, a) {
    table.replaceChildren();
    if (!game.rounds.length) {
      table.append(el('tbody', {}, el('tr', {}, el('td', { class: 'muted', text: 'No rounds yet.' }))));
      return;
    }
    const head = el('tr', {}, el('th', { text: 'Round' }));
    game.players.forEach((p) => head.append(el('th', { text: p })));
    head.append(el('th'));
    const body = el('tbody');
    game.rounds.forEach((r, ri) => {
      const tr = el('tr', {}, el('td', { text: String(ri + 1) }));
      if (a.tbFlags[ri]) tr.classList.add('tb');
      r.forEach((s) => tr.append(el('td', { text: s == null ? '–' : String(s) })));
      const btn = el('button', { class: 'ghost edit', type: 'button', text: 'Edit' });
      btn.addEventListener('click', () => openEdit(ri));
      tr.append(el('td', {}, btn));
      body.append(tr);
    });
    const foot = el('tr', {}, el('td', { text: 'Total' }));
    a.totals.forEach((t) => foot.append(el('td', { text: String(t) })));
    foot.append(el('td'));
    table.append(el('thead', {}, head), body, el('tfoot', {}, foot));
  }

  function renderGame(a) {
    show('game');
    const n = game.rounds.length + 1;
    const tb = a.status.state === 'tiebreak';
    $('round-title').textContent = tb ? `Round ${n} · Tie-break` : `Round ${n}`;
    $('entry-title').textContent = tb ? 'Tie-break scores' : `Round ${n} scores`;
    $('target-label').textContent = `First to ${game.target} points wins`;
    $('btn-undo').disabled = game.rounds.length === 0;

    const banner = $('tiebreak-banner');
    if (tb) {
      const names = a.status.contenders.map((i) => game.players[i]);
      banner.textContent = `Tie at ${a.totals[a.status.contenders[0]]}! ${listJoin(names)} play a tie-break round.`;
      banner.hidden = false;
    } else banner.hidden = true;

    renderStandings($('standings'), a.totals, tb ? a.status.contenders : null, true);
    scoreInputs($('round-inputs'), null, a.status.contenders, 'score');
    renderHistory($('history'), a);
  }

  function renderResults(a) {
    show('results');
    const w = a.status.winner;
    $('winner-name').textContent = game.players[w];
    $('winner-score').textContent = `${a.totals[w]} points`;
    $('stat-rounds').textContent = String(game.rounds.length);

    let best = -1, who = [];
    game.rounds.forEach((r) => r.forEach((s, i) => {
      if (s == null) return;
      if (s > best) { best = s; who = [i]; }
      else if (s === best && !who.includes(i)) who.push(i);
    }));
    $('stat-high').textContent = best >= 0 ? `${best}` : '–';
    $('stat-high-label').textContent = best >= 0
      ? `Highest round · ${listJoin(who.map((i) => game.players[i]))}` : 'Highest round';

    renderStandings($('final-standings'), a.totals, null, false);
    renderHistory($('final-history'), a);
  }

  function listJoin(arr) {
    if (arr.length <= 1) return arr.join('');
    return `${arr.slice(0, -1).join(', ')} & ${arr[arr.length - 1]}`;
  }

  // ---------- Edit dialog ----------
  let editing = null;
  function openEdit(ri) {
    editing = ri;
    const r = game.rounds[ri];
    $('edit-title').textContent = `Edit round ${ri + 1}`;
    const idx = r.map((s, i) => (s == null ? -1 : i)).filter((i) => i >= 0);
    scoreInputs($('edit-inputs'), r, idx, 'edit');
    $('edit-dialog').showModal();
  }
  $('edit-form').addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value === 'save') {
      const scores = readInputs($('edit-inputs'));
      if (!scores) { e.preventDefault(); return; }
      game.rounds[editing] = scores;
      // Edits can resolve an earlier tie / win; drop rounds that no longer make sense.
      trimInvalidRounds();
      save();
      render();
    }
  });

  function trimInvalidRounds() {
    for (let k = 1; k <= game.rounds.length; k++) {
      const { status } = analyzeRounds(game.players, game.target, game.rounds.slice(0, k));
      if (status.state === 'won') { game.rounds.length = k; return; }
    }
  }

  // ---------- Events ----------
  $('setup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const names = parseNames($('names').value);
    const target = Number($('target').value);
    const err = $('setup-error');
    if (names.length < 2) {
      err.textContent = 'Enter at least two names, separated by commas.';
      err.hidden = false;
      return;
    }
    if (!Number.isInteger(target) || target < 1) {
      err.textContent = 'Points to win must be a whole number.';
      err.hidden = false;
      return;
    }
    err.hidden = true;
    game = { players: names, target, rounds: [] };
    save();
    render();
  });

  $('round-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const scores = readInputs($('round-inputs'));
    if (!scores) return;
    game.rounds.push(scores);
    save();
    render();
  });

  function undo() {
    if (!game || !game.rounds.length) return;
    game.rounds.pop();
    save();
    render();
  }
  $('btn-undo').addEventListener('click', undo);
  $('btn-undo-results').addEventListener('click', undo);

  function goSetup(prefillNames) {
    const prev = game;
    game = null;
    save();
    $('names').value = prefillNames && prev ? prev.players.join(', ') : '';
    if (prev) $('target').value = prev.target;
    render();
    if (!prefillNames) $('names').focus();
  }

  function requestNew() {
    const a = game && analyze();
    if (game && game.rounds.length && a.status.state !== 'won') {
      $('confirm-dialog').showModal();
    } else {
      goSetup(true);
    }
  }
  $('confirm-dialog').addEventListener('close', () => {
    if ($('confirm-dialog').returnValue === 'new') goSetup(true);
  });
  $('btn-new-top').addEventListener('click', requestNew);
  $('btn-new-results').addEventListener('click', () => goSetup(false));
  $('btn-rematch').addEventListener('click', () => {
    game = { players: game.players, target: game.target, rounds: [] };
    save();
    render();
  });

  render();

  // ---------- Offline support ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
