// BatchBook: screens, actions and routing. No framework; each screen returns an HTML string.
const $app = document.getElementById('app');
const DAY = 864e5;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
const fmtDay = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
const fmtDur = (a, b) => { const m = Math.round((new Date(b) - new Date(a)) / 6e4); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' m'; };
const opt = (items, sel) => items.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`).join('');
const toast = (msg) => { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); };
const prodOf = (name) => PRODUCTS.find((p) => p.name === name || p.code === name) || null;
const matchProduct = (text) => { const t = text.toLowerCase(); const p = PRODUCTS.find((x) => t.includes(x.name.split(' ')[0].toLowerCase()) || t === x.code.toLowerCase()); return p ? p.name : text.trim(); };

const ui = { bq: '', bf: 'all', teamDate: ymd(new Date()), teamShift: 'all', imp: null, plantLayer: 'status', installEvt: null, pending: 0 };
let D = null; // data loaded for the current screen

const ICON = {
  home: 'M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  grid: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  team: 'M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7M21 20v-2a4 4 0 00-3-3.9M16 3.1a3.5 3.5 0 010 6.8',
  dl: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  cloud: 'M7 18a4 4 0 010-8 5 5 0 019.6-1A4.5 4.5 0 0117 18z',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
};
const svg = (d, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

const BST = { running: ['Running', 'c-ok'], delayed: ['Delayed', 'c-warn'], hold: ['QA hold', 'c-bad'], released: ['Released', 'c-ok'], rejected: ['Rejected', 'c-bad'], rework: ['Re-work', 'c-warn'] };
const RST = { running: ['Running', 'c-ok'], charging: ['Charging', 'c-info'], cleaning: ['Cleaning', 'c-idle'], idle: ['Idle', 'c-idle'], maintenance: ['Maintenance', 'c-warn'] };
const chip = (map, k) => `<span class="chip ${(map[k] || ['', 'c-idle'])[1]}">${esc((map[k] || [k])[0])}</span>`;
const LIVE = ['running', 'delayed', 'hold'];
const SHIFT_T = { A: '06–14', B: '14–22', C: '22–06' };
const CHECKS = ['Earthing and bonding clamp connected', 'Nitrogen blanketing on receiving reactor', 'Flame-proof pump and hose inspected', 'No hot work permit open in this zone (checked by the app)', 'Vent condenser coolant flowing', 'Spill kit and extinguisher at transfer point', 'Receiving reactor has room for the quantity'];
const SOLVENTS = ['Methanol', 'Toluene', 'Ethyl acetate', 'Acetone', 'Isopropyl alcohol', 'DMF'];
const AREAS = ['Solvent farm', 'Block A', 'Block B', 'Utilities', 'Warehouse', 'Effluent plant'];
const PERMIT_KINDS = ['Hot work', 'Maintenance with line isolation', 'Confined space entry', 'Work at height', 'Line breaking'];

async function load() {
  const names = ['batch', 'reactor', 'campaign', 'employee', 'shift', 'permit', 'transfer', 'att'];
  const rows = await Promise.all(names.map((n) => DB.all(n)));
  D = Object.fromEntries(names.map((n, i) => [n, rows[i]]));
  D.reactor.sort((a, b) => a.id.localeCompare(b.id));
  D.batch.sort((a, b) => b.start.localeCompare(a.start));
  ui.pending = await Sync.pending();
}

// ---------- shared layout ----------
function layout({ title, sub, left = '', right = '', body, tab, col = false }) {
  const tabs = [['home', 'Home', 'home', 'flask'], ['batches', 'Batches', 'flask'], ['schedule', 'Schedule', 'cal'], ['plant', 'Plant', 'grid'], ['team', 'Team', 'team']];
  return `<header class="top ${col ? 'col' : ''}">${col ? `${left}<h1>${title}</h1>${sub ? `<div class="sub" style="margin-top:4px">${sub}</div>` : ''}` : `<div>${sub ? `<div class="sub">${sub}</div>` : ''}<h1>${title}</h1></div>`}${col ? '' : right}</header>
  <main class="scroll">${body}</main>
  <nav class="tabs" aria-label="Main">${tabs.map(([k, l, ic]) => `<a class="tab ${tab === k ? 'on' : ''}" href="#/${k === 'home' ? 'home' : k}" ${tab === k ? 'aria-current="page"' : ''}>${svg(ICON[ic === 'home' ? 'home' : ic])}<span>${l}</span></a>`).join('')}</nav>`;
}
const back = (href, label) => `<a class="back" href="${href}">‹ ${esc(label)}</a>`;
const importBtn = (icon) => icon
  ? `<a class="ibtn" href="#/import" aria-label="Import data">${svg(ICON.dl, 20)}</a>`
  : `<a class="btn ghost" href="#/import">${svg(ICON.dl, 18)} Import</a>`;

// ---------- Home ----------
function vHome() {
  const live = D.batch.filter((b) => LIVE.includes(b.status));
  const inUse = D.reactor.filter((r) => ['running', 'charging'].includes(r.state)).length;
  const due = live.filter((b) => b.eta && new Date(b.eta) - Date.now() < DAY).length;
  const issues = live.filter((b) => b.status !== 'running');
  const alerts = [
    ...D.batch.filter((b) => b.status === 'hold').map((b) => ['QA hold', 'c-bad', `${b.id}: ${b.deviation || 'waiting for QC release.'}`]),
    ...D.batch.filter((b) => b.status === 'delayed').map((b) => ['Delay', 'c-warn', `${b.id} on ${b.reactor}: ${b.deviation || 'behind plan.'}`]),
    ...D.reactor.filter((r) => r.state === 'maintenance').map((r) => ['Maint.', 'c-info', `${r.id}: ${r.step}.`]),
    ...D.permit.filter((p) => p.status === 'awaiting').map((p) => ['Permit', 'c-warn', `${p.id} ${p.kind} (${p.area}) is waiting for approval.`]),
    ...D.transfer.filter((t) => t.status === 'checks').map((t) => ['Transfer', 'c-warn', `${t.id} ${t.solvent} to ${t.reactor} has checks pending.`]),
  ];
  const hr = new Date().getHours(), cur = hr >= 6 && hr < 14 ? 'A' : hr >= 14 && hr < 22 ? 'B' : 'C';
  const today = ymd(new Date());
  const onShift = D.shift.filter((s) => s.date === today && s.code === cur);
  const clocked = D.att.filter((a) => a.date === today && onShift.some((s) => s.emp === a.emp)).length;
  const blk = (b) => { const rs = D.reactor.filter((r) => r.block === b); return `${rs.filter((r) => ['running', 'charging'].includes(r.state)).length} / ${rs.length}`; };
  const openPermits = D.permit.filter((p) => p.status !== 'closed').length;
  const running = D.transfer.filter((t) => t.status === 'running').length;
  return layout({
    tab: 'home', title: 'Plant overview', sub: new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · Shift ' + cur,
    right: `<a class="ibtn" href="#/settings" aria-label="Settings${ui.pending ? ', ' + ui.pending + ' changes not backed up' : ''}">${svg(ICON.gear, 20)}${ui.pending ? '<span class="dotb"></span>' : ''}</a>`,
    body: `
    <div style="display:flex;gap:10px"><a class="btn" style="flex:1" href="#/newbatch">+ New batch</a><a class="btn ghost" style="flex:1" href="#/import">${svg(ICON.dl, 18)} Import data</a></div>
    <section class="grid2" aria-label="Key figures">
      <div class="card"><div class="sub">Batches running</div><div class="kpi">${live.length}</div><div class="sub">${live.length - issues.length} on track</div></div>
      <div class="card"><div class="sub">Reactors in use</div><div class="kpi">${inUse} / ${D.reactor.length}</div><div class="sub">${D.reactor.filter((r) => r.state === 'idle').length} idle</div></div>
      <div class="card"><div class="sub">Due in 24 h</div><div class="kpi">${due}</div><div class="sub">batches finishing</div></div>
      <div class="card"><div class="sub">Open deviations</div><div class="kpi">${issues.length}</div><div class="sub">holds and delays</div></div>
    </section>
    <section class="card"><h2 class="h" style="margin-bottom:12px">Needs attention</h2><div class="stack" style="gap:12px">
      ${alerts.length ? alerts.map(([t, c, x]) => `<div style="display:flex;gap:10px;align-items:flex-start"><span class="chip ${c}">${t}</span><div style="font-size:14px;line-height:1.4">${esc(x)}</div></div>`).join('') : '<div class="sub">Nothing needs attention right now.</div>'}
    </div></section>
    <section class="grid2">
      <a class="card" href="#/block/A"><div class="sub">Block A · Intermediates</div><div class="kpi">${blk('A')}</div><div class="sub">reactors active</div></a>
      <a class="card" href="#/block/B"><div class="sub">Block B · Final API</div><div class="kpi">${blk('B')}</div><div class="sub">reactors active</div></a>
    </section>
    <a class="card r2" href="#/safety"><div><div class="h">Safety and permits</div><div class="sub">${openPermits} open permits · ${running} solvent transfer running</div></div>${D.permit.some((p) => p.status === 'awaiting') ? '<span class="chip c-warn">Awaiting</span>' : '<span class="chip c-ok">Clear</span>'}</a>
    <a class="card" href="#/team"><div class="r2"><h2 class="h">Shift ${cur} staffing</h2><span class="sub">${clocked} in of ${onShift.length}</span></div><div class="bar" style="margin:10px 0 8px"><i style="width:${onShift.length ? Math.round((clocked / onShift.length) * 100) : 0}%"></i></div><div class="sub">Tap to open the roster</div></a>`,
  });
}

// ---------- Batches ----------
function batchRows() {
  const q = ui.bq.toLowerCase();
  const rows = D.batch.filter((b) => (ui.bf === 'all' || (ui.bf === 'running' ? LIVE.includes(b.status) : b.status === ui.bf)) && (!q || (b.id + b.product + b.reactor).toLowerCase().includes(q)));
  if (!rows.length) return '<div class="empty sub">No batches match. Try another filter, or import your records.</div>';
  return rows.slice(0, 60).map((b) => `<a class="card stack" style="gap:8px" href="#/batch/${esc(b.id)}">
    <div class="r2"><span class="mono" style="font-size:15px">${esc(b.id)}</span>${chip(BST, b.status)}</div>
    <div style="font-size:14px;font-weight:600">${esc(b.product)} · <span class="mono">${esc(b.reactor)}</span></div>
    <div class="r2"><span class="sub">${b.end ? fmt(b.start) + ' → ' + fmt(b.end) : 'Started ' + fmt(b.start) + (b.eta ? ' · ETA ' + fmt(b.eta) : '')}</span><span class="sub">${b.yield != null ? 'Yield ' + b.yield + ' %' : 'In progress'}</span></div></a>`).join('') + (rows.length > 60 ? `<div class="sub empty">Showing 60 of ${rows.length}. Use search to narrow.</div>` : '');
}
function vBatches() {
  const f = [['all', 'All'], ['running', 'Running'], ['hold', 'QA hold'], ['released', 'Released'], ['rework', 'Re-work'], ['rejected', 'Rejected']];
  return layout({
    tab: 'batches', title: 'Batches', right: importBtn(false),
    body: `<label class="hide-a11y" for="bq">Search batches</label><input id="bq" class="field" data-input="bq" placeholder="Search batch, product or reactor" value="${esc(ui.bq)}">
    <div class="pills" role="group" aria-label="Status filter">${f.map(([k, l]) => `<button class="pill ${ui.bf === k ? 'on' : ''}" data-act="bfilter" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="r2"><span class="sub">${D.batch.length} batches on this phone</span><a class="sub" style="color:var(--pri);font-weight:600" href="#/newbatch">+ New batch</a></div>
    <div id="blist" class="stack">${batchRows()}</div>`,
  });
}
function vBatch(id) {
  const b = D.batch.find((x) => x.id === id);
  if (!b) return layout({ tab: 'batches', title: 'Not found', body: `<div class="empty sub">That batch is not on this phone.</div>${back('#/batches', 'Batches')}` });
  const r = D.reactor.find((x) => x.id === b.reactor);
  const done = b.end || ['released', 'rejected', 'rework'].includes(b.status);
  return layout({
    tab: 'batches', col: true, title: `<span class="mono" style="font-size:20px">${esc(b.id)}</span>`, sub: `${esc(b.product)} · ${esc(b.reactor)}${r ? ' · Block ' + r.block : ''}`,
    left: `<div class="r2" style="width:100%">${back('#/batches', 'Batches')}${chip(BST, b.status)}</div>`,
    body: `<section class="grid3">
      <div class="card" style="padding:12px"><div class="sub">Cycle</div><div style="font-size:15px;font-weight:700;margin-top:2px">${b.end ? fmtDur(b.start, b.end) : fmtDur(b.start, new Date())}</div></div>
      <div class="card" style="padding:12px"><div class="sub">Yield</div><div style="font-size:15px;font-weight:700;margin-top:2px">${b.yield != null ? b.yield + ' %' : '—'}</div></div>
      <div class="card" style="padding:12px"><div class="sub">Started</div><div style="font-size:15px;font-weight:700;margin-top:2px">${fmtDay(b.start)}</div></div></section>
    <section class="card"><h2 class="h" style="margin-bottom:12px">Process timeline</h2><div class="stack">
      ${b.steps.length ? b.steps.map((s) => `<div style="display:flex;gap:12px"><span class="dot"></span><div><div style="font-size:14px;font-weight:600">${esc(s.name)}</div><div class="sub">${fmt(s.at)}${s.note ? ' · ' + esc(s.note) : ''}</div></div></div>`).join('') : '<div class="sub">No steps recorded yet.</div>'}
    </div></section>
    ${b.deviation ? `<section class="card c-warn" style="border-color:transparent"><div style="font-weight:700;font-size:14px">Deviation</div><div style="font-size:13px;line-height:1.5;margin-top:4px">${esc(b.deviation)}</div></section>` : ''}
    <form class="card fg" data-form="addstep"><input type="hidden" name="id" value="${esc(b.id)}"><h2 class="h">Record a step</h2>
      <div><label class="lab" for="st">Step</label><select class="field" id="st" name="name">${opt(STEPS.map((s) => [s, s]), '')}</select></div>
      <div><label class="lab" for="sn">Note (optional)</label><input class="field" id="sn" name="note"></div>
      <button class="btn block">Add step now</button></form>
    <form class="card fg" data-form="setstatus"><input type="hidden" name="id" value="${esc(b.id)}"><h2 class="h">Update status</h2>
      <div><label class="lab" for="ss">Status</label><select class="field" id="ss" name="status">${opt(Object.entries(BST).map(([k, v]) => [k, v[0]]), b.status)}</select></div>
      <div><label class="lab" for="sy">Yield % (for released, rejected or re-work)</label><input class="field" id="sy" name="yield" type="number" step="0.1" min="0" max="100" inputmode="decimal" value="${b.yield ?? ''}"></div>
      <div><label class="lab" for="sd">Deviation note (optional)</label><textarea class="field" id="sd" name="deviation">${esc(b.deviation || '')}</textarea></div>
      <button class="btn block">Save</button></form>
    <button class="btn danger block" data-act="delbatch" data-id="${esc(b.id)}">Delete this batch</button>`,
  });
}
function vNewBatch() {
  const free = D.reactor.filter((r) => !['running', 'maintenance'].includes(r.state));
  return layout({
    tab: 'batches', col: true, title: 'New batch', left: back('#/batches', 'Batches'),
    body: `<form class="card fg" data-form="newbatch">
      <div><label class="lab" for="np">Product</label><select class="field" id="np" name="product">${opt(PRODUCTS.map((p) => [p.name, p.name]), '')}</select></div>
      <div><label class="lab" for="nr">Reactor</label><select class="field" id="nr" name="reactor">${free.length ? opt(free.map((r) => [r.id, `${r.id} · Block ${r.block} · ${RST[r.state][0]}`]), '') : '<option value="">No free reactor</option>'}</select></div>
      <div><label class="lab" for="ni">Batch ID (leave empty to auto-number)</label><input class="field" id="ni" name="id" autocapitalize="characters"></div>
      <button class="btn block"${free.length ? '' : ' disabled'}>Start batch</button></form>`,
  });
}

// ---------- Schedule ----------
function vSchedule() {
  const wStart = new Date(); wStart.setHours(0, 0, 0, 0); const w0 = wStart.getTime() - 150 * DAY, total = 180, now = Date.now();
  const pct = (t) => Math.max(0, Math.min(100, ((t - w0) / (total * DAY)) * 100));
  const months = []; let d = new Date(w0);
  while (d.getTime() < w0 + total * DAY) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1), end = Math.min(next.getTime(), w0 + total * DAY);
    months.push([d.toLocaleDateString('en-IN', { month: 'short' }), (end - d.getTime()) / DAY]); d = next;
  }
  const bar = (c, a, b, planned) => { const l = pct(a), w = pct(b) - l; if (w <= 0) return ''; const p = prodOf(c.product); return `<div class="gb p-${p ? p.k : 'oth'}${planned ? ' plan' : ''}" style="left:${l}%;width:${w}%" title="${esc(c.product)}">${w > 8 ? esc((p ? p.code : c.product.slice(0, 3).toUpperCase()) + (c.batches ? ' ×' + c.batches : '')) : ''}</div>`; };
  const rows = D.reactor.map((r) => `<div class="grow"><div class="glab mono">${r.id}</div><div class="gtr">${D.campaign.filter((c) => c.reactor === r.id).map((c) => { const s = new Date(c.start).getTime(), e = new Date(c.end).getTime(); return s < now && e > now ? bar(c, s, now, false) + bar(c, now, e, true) : bar(c, s, e, s >= now); }).join('')}</div></div>`).join('');
  const soon = D.campaign.filter((c) => new Date(c.end) > now && new Date(c.start) < now + 14 * DAY).sort((a, b) => a.start.localeCompare(b.start));
  return layout({
    tab: 'schedule', title: 'Reactor schedule', sub: months[0][0] + ' – ' + months[months.length - 1][0] + ' · past 5 months and next month', right: importBtn(true),
    body: `<a class="btn block" href="#/newcampaign">+ Schedule campaign</a>
    <section class="card" style="padding:12px 0 12px 12px"><div class="gscroll" style="padding-right:12px"><div class="ginner">
      <div style="display:flex;height:24px;align-items:flex-end;margin-left:52px">${months.map(([n, dd]) => `<div style="flex:${dd} 1 0;font-size:12px;font-weight:600;padding-left:6px">${dd >= 10 ? n : ''}</div>`).join('')}</div>
      <div style="position:relative">${rows}<div style="position:absolute;left:52px;right:0;top:0;bottom:0;pointer-events:none"><div style="position:absolute;top:0;bottom:0;left:${pct(now)}%;width:2px;background:#C2410C"></div></div></div></div></div>
      <div class="sub" style="padding:10px 12px 0 0">Swipe sideways. Orange line is today. Dashed bars are planned.</div></section>
    <div class="lg">${PRODUCTS.map((p) => `<span><i class="sw p-${p.k}"></i>${esc(p.name.split(' ')[0])}</span>`).join('')}</div>
    <section class="card"><h2 class="h" style="margin-bottom:12px">Active or starting in 14 days</h2><div class="stack" style="gap:12px">
      ${soon.length ? soon.map((c) => `<div class="r2" style="align-items:flex-start"><div><div style="font-size:14px;font-weight:600">${esc(c.reactor)} · ${esc(c.product)}</div><div class="sub">${fmtDay(c.start)} → ${fmtDay(c.end)}${c.batches ? ' · ' + c.batches + ' batches' : ''}</div></div><button class="btn danger" style="min-height:44px" data-act="delcampaign" data-id="${esc(c.id)}" aria-label="Delete campaign ${esc(c.reactor)} ${esc(c.product)}">Delete</button></div>`).join('') : '<div class="sub">No campaigns in this window.</div>'}
    </div></section>`,
  });
}
function vNewCampaign() {
  const t = ymd(new Date()), e = ymd(new Date(Date.now() + 14 * DAY));
  return layout({
    tab: 'schedule', col: true, title: 'Schedule campaign', left: back('#/schedule', 'Schedule'),
    body: `<form class="card fg" data-form="newcampaign">
      <div><label class="lab" for="cr">Reactor</label><select class="field" id="cr" name="reactor">${opt(D.reactor.map((r) => [r.id, `${r.id} · Block ${r.block}`]), '')}</select></div>
      <div><label class="lab" for="cp">Product</label><select class="field" id="cp" name="product">${opt(PRODUCTS.map((p) => [p.name, p.name]), '')}</select></div>
      <div><label class="lab" for="cs">Start date</label><input class="field" id="cs" name="start" type="date" value="${t}" required></div>
      <div><label class="lab" for="ce">End date</label><input class="field" id="ce" name="end" type="date" value="${e}" required></div>
      <button class="btn block">Save campaign</button></form>`,
  });
}

// ---------- Plant ----------
function vPlant() {
  const sq = (b) => D.reactor.filter((r) => r.block === b).map((r) => `<i class="q-${r.state}" title="${r.id} ${RST[r.state][0]}"></i>`).join('');
  const act = (b) => { const rs = D.reactor.filter((r) => r.block === b); return rs.filter((r) => ['running', 'charging'].includes(r.state)).length + ' / ' + rs.length; };
  const today = ymd(new Date());
  const staff = (b) => D.shift.filter((s) => s.date === today && ['A', 'B', 'C'].includes(s.code)).length;
  const lowTransfers = D.transfer.filter((t) => t.status !== 'done').length;
  return layout({
    tab: 'plant', title: 'Plant layout', sub: 'Unit 2 · Tap a block to open it', right: importBtn(true),
    body: `<section class="card" style="padding:10px"><div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px">
      <div class="z c-idle" style="grid-column:1 / span 2;min-height:64px"><b>Main gate</b><span>Security · visitor log</span></div>
      <div class="z c-idle" style="grid-column:3 / span 4;min-height:64px"><b>Admin and control room</b><span>DCS operators · production office</span></div>
      <a class="z c-info" href="#/block/A" style="grid-column:1 / span 3;min-height:150px"><b>Block A · Intermediates</b><span>General area · R-101 to R-106</span><div class="sq">${sq('A')}<em>${act('A')}</em></div></a>
      <a class="z c-ok" href="#/block/B" style="grid-column:4 / span 3;min-height:150px"><b>Block B · Final API</b><span>Controlled area · R-107 to R-112</span><div class="sq">${sq('B')}<em>${act('B')}</em></div></a>
      <a class="z c-warn" href="#/safety" style="grid-column:1 / span 2;min-height:84px"><b>Solvent tank farm</b><span>Hazardous zone · ${lowTransfers} open transfer${lowTransfers === 1 ? '' : 's'}</span></a>
      <div class="z c-idle" style="grid-column:3 / span 2;min-height:84px"><b>Utilities</b><span>Boiler · chillers · DG · air</span></div>
      <div class="z c-idle" style="grid-column:5 / span 2;min-height:84px"><b>Effluent plant</b><span>ETP · solvent recovery</span></div>
      <div class="z c-info" style="grid-column:1 / span 3;min-height:72px"><b>Warehouse</b><span>Raw material · finished API</span></div>
      <div class="z c-ok" style="grid-column:4 / span 2;min-height:72px"><b>QC lab</b><span>In-process and release</span></div>
      <div class="z c-bad" style="grid-column:6;min-height:72px"><b>Fire point</b><span>Muster 1</span></div></div></section>
    <div class="lg"><span><i class="q-running"></i>Running</span><span><i class="q-charging"></i>Charging</span><span><i class="q-idle"></i>Idle / cleaning</span><span><i class="q-maintenance"></i>Maintenance</span></div>
    <section class="card"><h2 class="h" style="margin-bottom:12px">Blocks and zones</h2><div class="stack">
      <a class="r2" href="#/block/A"><div><div style="font-size:14px;font-weight:600">Block A · Intermediates</div><div class="sub">6 reactors · ${act('A')} active</div></div><span class="chip c-info">General</span></a>
      <a class="r2" href="#/block/B"><div><div style="font-size:14px;font-weight:600">Block B · Final API</div><div class="sub">6 reactors · ${act('B')} active</div></div><span class="chip c-ok">Controlled</span></a>
      <a class="r2" href="#/safety"><div><div style="font-size:14px;font-weight:600">Solvent tank farm</div><div class="sub">Bulk solvent storage and transfer</div></div><span class="chip c-warn">Hazardous</span></a></div></section>
    <div class="sub">Block and zone names are samples. They will become editable once you share your real layout.</div>`,
  });
}
function vBlock(b) {
  const rs = D.reactor.filter((r) => r.block === b);
  const names = { A: 'Block A · Intermediates', B: 'Block B · Final API' };
  const openPermits = D.permit.filter((p) => p.area === 'Block ' + b && p.status !== 'closed').length;
  return layout({
    tab: 'plant', col: true, title: names[b] || 'Block', left: back('#/plant', 'Plant layout'),
    sub: `<span class="chip ${b === 'A' ? 'c-info' : 'c-ok'}">${b === 'A' ? 'General area' : 'Controlled area'}</span> <span class="chip c-ok">${rs.filter((r) => ['running', 'charging'].includes(r.state)).length} of ${rs.length} active</span> <span class="chip c-idle">${openPermits} open permits</span>`,
    body: `<div class="pills" style="margin-top:8px"><a class="pill ${b === 'A' ? 'on' : ''}" href="#/block/A">Block A</a><a class="pill ${b === 'B' ? 'on' : ''}" href="#/block/B">Block B</a></div>` +
      rs.map((r) => { const bt = D.batch.find((x) => x.id === r.batchId); return `<article class="card stack" style="gap:8px">
        <div class="r2"><div><span class="mono" style="font-size:16px">${r.id}</span> <span class="sub">· ${esc(r.cap)}</span></div>${chip(RST, r.state)}</div>
        <div style="font-size:14px;font-weight:600">${bt ? esc(bt.product) + ' · ' + esc(bt.id) : 'No batch'}</div><div class="sub">${esc(r.step)}</div>
        <div class="bar"><i style="width:${r.pct}%"></i></div>
        <div class="r2"><span class="sub">In charge: ${esc(r.inCharge)}</span>${bt ? `<a href="#/batch/${esc(bt.id)}" style="font-size:13px;font-weight:600;color:var(--pri);min-height:44px;display:inline-flex;align-items:center">Open batch ›</a>` : ''}</div>
        <label class="lab" for="rs-${r.id}" style="margin:0">Set reactor state</label>
        <select class="field" id="rs-${r.id}" data-change="reactorstate" data-id="${r.id}">${opt(Object.entries(RST).map(([k, v]) => [k, v[0]]), r.state)}</select></article>`; }).join(''),
  });
}

// ---------- Team ----------
function vTeam() {
  const sel = new Date(ui.teamDate + 'T12:00:00'), dow = (sel.getDay() + 6) % 7, mon = new Date(sel.getTime() - dow * DAY);
  const days = [...Array(7)].map((_, i) => new Date(mon.getTime() + i * DAY));
  const rows = D.employee.map((e) => ({ e, s: D.shift.find((x) => x.id === `${e.id}_${ui.teamDate}`) })).filter((x) => x.s);
  const cnt = (c) => rows.filter((x) => x.s.code === c).length;
  const list = rows.filter((x) => ui.teamShift === 'all' || x.s.code === ui.teamShift);
  const isToday = ui.teamDate === ymd(new Date());
  const f = [['all', 'All'], ['A', `A · ${cnt('A')}`], ['B', `B · ${cnt('B')}`], ['C', `C · ${cnt('C')}`], ['O', `Off · ${cnt('O')}`], ['L', `Leave · ${cnt('L')}`]];
  return layout({
    tab: 'team', title: 'Team and shifts', sub: 'Week of ' + fmtDay(mon) + ' – ' + fmtDay(days[6]), right: importBtn(true),
    body: `<div class="r2"><button class="pill" data-act="week" data-v="-7" aria-label="Previous week">‹ Prev</button><button class="pill" data-act="weektoday">Today</button><button class="pill" data-act="week" data-v="7" aria-label="Next week">Next ›</button></div>
    <div style="display:flex;gap:6px" role="group" aria-label="Day">${days.map((d) => `<button class="day ${ymd(d) === ui.teamDate ? 'on' : ''}" data-act="day" data-v="${ymd(d)}"><span>${d.toLocaleDateString('en-IN', { weekday: 'short' })}</span><b>${d.getDate()}</b></button>`).join('')}</div>
    <div class="pills" role="group" aria-label="Shift filter">${f.map(([k, l]) => `<button class="pill ${ui.teamShift === k ? 'on' : ''}" data-act="tshift" data-v="${k}">${l}</button>`).join('')}</div>
    <section class="card"><div class="r2" style="margin-bottom:12px"><h2 class="h">${ui.teamShift === 'all' ? 'Everyone' : 'Filtered'} · ${new Date(ui.teamDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</h2></div>
      <div class="sub" style="margin-bottom:10px">Tap a shift code to change it. Shift times: A 06–14, B 14–22, C 22–06.</div>
      <div class="stack">${list.length ? list.map(({ e, s }) => { const a = D.att.find((x) => x.id === s.id); return `<div class="r2"><div style="min-width:0"><div style="font-size:14px;font-weight:600">${esc(e.name)}</div><div class="sub">${esc(e.role)}${a ? ' · ' + (a.late ? 'Late, in ' : 'In ') + new Date(a.inAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}</div></div>
        <div style="display:flex;gap:8px;align-items:center">${isToday && ['A', 'B', 'C'].includes(s.code) && !a ? `<button class="pill" style="min-height:44px" data-act="clockin" data-id="${esc(s.id)}">Clock in</button>` : ''}<button class="sc s${s.code}" style="min-height:44px" data-act="cycleshift" data-id="${esc(s.id)}" aria-label="${esc(e.name)} shift ${s.code}. Tap to change">${{ O: 'Off', L: 'Leave' }[s.code] || s.code}</button></div></div>`; }).join('') : '<div class="empty sub">No roster for this day. Import a roster or add people.</div>'}</div></section>
    <div style="display:flex;gap:10px"><a class="btn" style="flex:1" href="#/newperson">+ Add person</a><a class="btn ghost" style="flex:1" href="#/import">Import roster</a></div>`,
  });
}
function vNewPerson() {
  return layout({
    tab: 'team', col: true, title: 'Add person', left: back('#/team', 'Team'),
    body: `<form class="card fg" data-form="newperson">
      <div><label class="lab" for="pn">Name</label><input class="field" id="pn" name="name" required></div>
      <div><label class="lab" for="pr">Role</label><select class="field" id="pr" name="role">${opt(['Reactor operator', 'Shift supervisor', 'Process chemist', 'Maintenance technician', 'QA officer'].map((x) => [x, x]), '')}</select></div>
      <div><label class="lab" for="pb">Usual shift</label><select class="field" id="pb" name="base">${opt([['A', 'A · 06–14'], ['B', 'B · 14–22'], ['C', 'C · 22–06']], 'A')}</select></div>
      <button class="btn block">Add and roster for next 4 weeks</button></form>`,
  });
}

// ---------- Safety ----------
const zonesOf = (t) => ['Solvent farm', 'Block ' + ((D.reactor.find((r) => r.id === t.reactor) || {}).block || '')];
const clashOf = (t) => D.permit.filter((p) => p.kind === 'Hot work' && p.status === 'active' && zonesOf(t).includes(p.area));
const TST = { checks: ['Checks pending', 'c-warn'], running: ['In progress', 'c-ok'], done: ['Completed', 'c-idle'] };
const PST = { awaiting: ['Awaiting approval', 'c-warn'], active: ['Active', 'c-ok'], closed: ['Closed', 'c-idle'] };
function vSafety() {
  const open = D.permit.filter((p) => p.status !== 'closed').length;
  const hot = D.permit.filter((p) => p.kind === 'Hot work' && p.status === 'active');
  const ts = [...D.transfer].sort((a, b) => b.id.localeCompare(a.id));
  return layout({
    tab: 'plant', col: true, title: 'Safety and permits', left: back('#/plant', 'Plant layout'),
    sub: `<span class="chip c-ok">${open} open permits</span> <span class="chip c-info">${D.transfer.filter((t) => t.status !== 'done').length} open transfers</span>`,
    body: `<div style="display:flex;gap:10px;margin-top:10px"><a class="btn" style="flex:1" href="#/newpermit">+ New permit</a><a class="btn ghost" style="flex:1" href="#/newtransfer">+ Solvent transfer</a></div>
    <section class="card"><h2 class="h" style="margin-bottom:12px">Solvent transfers</h2><div class="stack">
      ${ts.length ? ts.map((t) => `<a class="stack" style="gap:6px" href="#/transfer/${esc(t.id)}"><div class="r2"><span class="mono" style="font-size:14px">${esc(t.id)}</span>${chip(TST, t.status)}</div><div style="font-size:14px;font-weight:600">${esc(t.solvent)} · ${t.qty} L</div><div class="sub">Tank ${esc(t.tank)} → ${esc(t.reactor)}</div></a>`).join('') : '<div class="sub">No transfers yet.</div>'}</div></section>
    <section class="card"><h2 class="h" style="margin-bottom:12px">Work permits</h2><div class="stack">
      ${D.permit.length ? [...D.permit].sort((a, b) => b.id.localeCompare(a.id)).map((p) => `<div class="stack" style="gap:8px"><div class="r2" style="align-items:flex-start"><div style="min-width:0"><div class="mono" style="font-size:13px">${esc(p.id)}</div><div style="font-size:14px;font-weight:600">${esc(p.kind)}</div><div class="sub">${esc(p.area)} · ${esc(p.note || '')} · until ${fmt(p.validTo)}</div></div>${chip(PST, p.status)}</div>
        ${p.status === 'awaiting' ? `<button class="btn" data-act="permit" data-v="active" data-id="${esc(p.id)}">Approve permit</button>` : ''}${p.status === 'active' ? `<button class="btn ghost" data-act="permit" data-v="closed" data-id="${esc(p.id)}">Close permit</button>` : ''}</div>`).join('') : '<div class="sub">No permits yet.</div>'}</div></section>
    <section class="card"><h2 class="h" style="margin-bottom:6px">Clash check</h2><div style="display:flex;gap:10px;align-items:flex-start"><span class="chip ${hot.length ? 'c-warn' : 'c-ok'}">${hot.length ? 'Watch' : 'Clear'}</span><div style="font-size:13px;line-height:1.45">${hot.length ? 'Hot work is active in: ' + esc(hot.map((p) => p.area).join(', ')) + '. Solvent transfers into these zones are blocked.' : 'No hot work is active. A transfer cannot start if hot work is active in its zone.'}</div></div></section>`,
  });
}
function vNewPermit() {
  return layout({
    tab: 'plant', col: true, title: 'New permit', left: back('#/safety', 'Safety'),
    body: `<form class="card fg" data-form="newpermit">
      <div><label class="lab" for="pk">Permit type</label><select class="field" id="pk" name="kind">${opt(PERMIT_KINDS.map((x) => [x, x]), '')}</select></div>
      <div><label class="lab" for="pa">Area</label><select class="field" id="pa" name="area">${opt(AREAS.map((x) => [x, x]), '')}</select></div>
      <div><label class="lab" for="pt">Work description</label><input class="field" id="pt" name="note" required></div>
      <div><label class="lab" for="ph">Valid for (hours)</label><input class="field" id="ph" name="hours" type="number" min="1" max="24" value="8" inputmode="numeric"></div>
      <button class="btn block">Raise permit for approval</button></form>`,
  });
}
function vNewTransfer() {
  const rs = D.reactor.filter((r) => r.state !== 'maintenance');
  return layout({
    tab: 'plant', col: true, title: 'New solvent transfer', left: back('#/safety', 'Safety'),
    body: `<form class="card fg" data-form="newtransfer">
      <div><label class="lab" for="ts">Solvent</label><select class="field" id="ts" name="solvent">${opt(SOLVENTS.map((x) => [x, x]), '')}</select></div>
      <div><label class="lab" for="tq">Quantity (litres)</label><input class="field" id="tq" name="qty" type="number" min="1" inputmode="numeric" value="500" required></div>
      <div><label class="lab" for="tt">From tank</label><select class="field" id="tt" name="tank">${opt(['T-201', 'T-202', 'T-203', 'T-204', 'T-205'].map((x) => [x, x]), '')}</select></div>
      <div><label class="lab" for="tr">To reactor</label><select class="field" id="tr" name="reactor">${opt(rs.map((r) => [r.id, `${r.id} · Block ${r.block}`]), '')}</select></div>
      <button class="btn block">Create transfer</button></form>`,
  });
}
function vTransfer(id) {
  const t = D.transfer.find((x) => x.id === id);
  if (!t) return layout({ tab: 'plant', title: 'Not found', body: back('#/safety', 'Safety') });
  const clash = clashOf(t), checks = t.checks.map((c, i) => (i === 3 ? !clash.length : c));
  const nDone = checks.filter(Boolean).length, ready = nDone === CHECKS.length && t.signOp && t.signSup;
  const locked = t.status !== 'checks';
  return layout({
    tab: 'plant', col: true, title: `<span class="mono" style="font-size:20px">${esc(t.id)}</span>`, sub: `${esc(t.solvent)} · ${t.qty} L · Tank ${esc(t.tank)} → ${esc(t.reactor)}`,
    left: `<div class="r2" style="width:100%">${back('#/safety', 'Safety')}${chip(TST, t.status)}</div>`,
    body: `<section class="grid2"><div class="card" style="padding:12px"><div class="sub">Linked batch</div><div class="mono" style="font-size:14px;margin-top:2px">${esc(t.batchId || '—')}</div></div><div class="card" style="padding:12px"><div class="sub">Zones</div><div style="font-size:14px;font-weight:600;margin-top:2px">${esc(zonesOf(t).join(' + '))}</div></div></section>
    ${clash.length ? `<section class="card c-bad" style="border-color:transparent"><div style="font-weight:700;font-size:14px">Blocked by hot work</div><div style="font-size:13px;margin-top:4px">${clash.map((p) => esc(p.id + ' in ' + p.area)).join(', ')} must be closed before this transfer can start.</div></section>` : ''}
    <section class="card"><div class="r2" style="margin-bottom:12px"><h2 class="h">Pre-transfer checks</h2><span class="sub">${nDone} of ${CHECKS.length} done</span></div><div class="stack">
      ${CHECKS.map((c, i) => `<div class="crow"><button class="ck ${checks[i] ? 'done' : ''}" ${i === 3 || locked ? 'disabled' : ''} data-act="check" data-id="${esc(t.id)}" data-v="${i}" role="checkbox" aria-checked="${checks[i]}" aria-label="${esc(c)}">${checks[i] ? '✓' : ''}</button><div style="flex:1;font-size:14px;line-height:1.35">${esc(c)}<div class="sub">${checks[i] ? 'Done' : 'Pending'}</div></div></div>`).join('')}</div></section>
    <section class="card"><h2 class="h" style="margin-bottom:10px">Sign-off</h2>
      <div class="r2" style="margin-bottom:8px"><span style="font-size:14px">Operator</span><button class="pill ${t.signOp ? 'on' : ''}" ${locked ? 'disabled' : ''} data-act="sign" data-id="${esc(t.id)}" data-v="signOp">${t.signOp ? 'Signed' : 'Sign as operator'}</button></div>
      <div class="r2"><span style="font-size:14px">Shift supervisor</span><button class="pill ${t.signSup ? 'on' : ''}" ${locked ? 'disabled' : ''} data-act="sign" data-id="${esc(t.id)}" data-v="signSup">${t.signSup ? 'Signed' : 'Sign as supervisor'}</button></div></section>
    ${t.status === 'checks' ? `<button class="btn block" ${ready ? '' : 'disabled'} data-act="starttransfer" data-id="${esc(t.id)}">Start transfer</button><div class="sub" style="text-align:center">${ready ? 'All checks and sign-offs complete.' : 'Unlocks when all 7 checks and both sign-offs are done.'}</div>` : ''}
    ${t.status === 'running' ? `<button class="btn block" data-act="finishtransfer" data-id="${esc(t.id)}">Mark transfer complete</button><div class="sub" style="text-align:center">Started ${fmt(t.startedAt)}</div>` : ''}
    ${t.status === 'done' ? `<div class="sub" style="text-align:center">Completed ${fmt(t.doneAt)}</div>` : ''}`,
  });
}

// ---------- Import ----------
function vImport() {
  const s = ui.imp || (ui.imp = { kind: 'batches', data: null, map: {}, result: null });
  const K = Importer.KINDS[s.kind];
  const mapUi = s.data ? `<section class="card fg"><h2 class="h">3 · Check the columns</h2><div class="sub">${esc(s.data.name)} · ${s.data.rows.length} rows</div>
    ${K.fields.map((f) => `<div><label class="lab" for="m-${f.k}">${esc(f.label)}${f.req ? ' *' : ''}</label><select class="field" id="m-${f.k}" data-change="impmap" data-id="${f.k}"><option value="">— not in my file —</option>${opt(s.data.headers.map((h) => [h, h]), s.map[f.k])}</select></div>`).join('')}</section>` : '';
  const r = s.result;
  const rev = r ? `<section class="card"><h2 class="h" style="margin-bottom:10px">4 · Review</h2><div class="stack" style="gap:8px;font-size:14px">
    <div class="r2"><span>Ready to import</span><span class="chip c-ok">${r.ready.length} rows</span></div>
    <div class="r2"><span>Warnings (will import)</span><span class="chip c-warn">${r.warns.length} rows</span></div>
    <div class="r2"><span>Errors (skipped)</span><span class="chip c-bad">${r.errs.length} rows</span></div></div>
    ${r.errs.length || r.warns.length ? `<div class="sub" style="margin-top:10px;line-height:1.6">${[...r.errs.map((e) => 'Row ' + e.row + ': ' + e.msg), ...r.warns.map((e) => 'Row ' + e.row + ' (warning): ' + e.msg)].slice(0, 12).map(esc).join('<br>')}${r.errs.length + r.warns.length > 12 ? '<br>…and more' : ''}</div>` : ''}</section>
    <button class="btn block" ${r.ready.length ? '' : 'disabled'} data-act="doimport">Import ${r.ready.length} rows</button>` : '';
  return layout({
    tab: 'home', col: true, title: 'Import data', sub: 'Bring in Excel or CSV files from your existing records.', left: back('#/home', 'Home'),
    body: `<section><h2 class="h" style="margin:10px 0">1 · What are you importing?</h2><div class="stack" style="gap:10px">
      ${Object.entries(Importer.KINDS).map(([k, v]) => `<button class="card r2" style="text-align:left;cursor:pointer;${s.kind === k ? 'border-color:var(--pri);border-width:2px;' : ''}" data-act="impkind" data-v="${k}" role="radio" aria-checked="${s.kind === k}"><div><div style="font-size:14px;font-weight:600">${esc(v.label)}</div><div class="sub">${esc(v.desc)}</div></div><span class="chip ${s.kind === k ? 'c-ok' : 'c-idle'}">${s.kind === k ? 'Selected' : 'Select'}</span></button>`).join('')}</div></section>
    <section class="card fg"><h2 class="h">2 · Choose the file</h2>
      <label class="btn ghost block" for="impfile" style="cursor:pointer">${s.data ? 'Choose a different file' : 'Choose Excel or CSV file'}</label>
      <input id="impfile" class="hide-a11y" type="file" accept=".xlsx,.xls,.csv,text/csv" data-change="impfile">
      <button class="btn ghost block" data-act="template">Get template (CSV)</button></section>
    ${mapUi}${rev}`,
  });
}

// ---------- Settings ----------
function vSettings() {
  const theme = localStorage.getItem('bb_theme') || 'light';
  const last = ui.lastSync ? new Date(ui.lastSync).toLocaleString('en-IN') : 'Never';
  return layout({
    tab: 'home', col: true, title: 'Settings', left: back('#/home', 'Home'),
    body: `<section class="card fg"><h2 class="h">Theme</h2><div class="pills" role="radiogroup" aria-label="Theme">
      ${[['light', 'Daylight'], ['dark', 'Night shift'], ['contrast', 'Plant floor']].map(([k, l]) => `<button class="pill ${theme === k ? 'on' : ''}" data-act="theme" data-v="${k}" role="radio" aria-checked="${theme === k}">${l}</button>`).join('')}</div></section>
    <section class="card fg"><h2 class="h">Back up to Google Drive</h2>
      <div class="sub">Everything is stored on this phone. Backup copies only what changed to a Drive folder called "BatchBook Backup".</div>
      <div class="r2"><span class="sub">Not backed up yet</span><span class="chip ${ui.pending ? 'c-warn' : 'c-ok'}">${ui.pending} change${ui.pending === 1 ? '' : 's'}</span></div>
      <div class="r2"><span class="sub">Last backup</span><span style="font-size:13px">${esc(last)}</span></div>
      <div><label class="lab" for="gc">Google client ID</label><input class="field" id="gc" data-input="gclient" value="${esc(Sync.clientId())}" placeholder="xxxx.apps.googleusercontent.com" autocapitalize="none" autocomplete="off"></div>
      <button class="btn block" data-act="syncnow">Back up now</button>
      <button class="btn ghost block" data-act="restore">Restore from Google Drive</button></section>
    <section class="card fg"><h2 class="h">Backup file on this phone</h2><div class="sub">A single file you can save anywhere, as a second safety net.</div>
      <button class="btn ghost block" data-act="exportjson">Download backup file</button>
      <label class="btn ghost block" for="bkfile" style="cursor:pointer">Load backup file</label><input id="bkfile" class="hide-a11y" type="file" accept=".json,application/json" data-change="bkfile"></section>
    <section class="card fg"><h2 class="h">Install on your phone</h2><div class="sub">Android Chrome: menu ⋮ → Install app. iPhone Safari: Share → Add to Home Screen.</div>
      ${ui.installEvt ? '<button class="btn block" data-act="install">Install app</button>' : ''}</section>
    <section class="card fg"><h2 class="h">Data</h2>
      <button class="btn ghost block" data-act="reseed">Reset to sample data</button>
      <button class="btn danger block" data-act="wipe">Erase everything on this phone</button></section>`,
  });
}

// ---------- routing ----------
const ROUTES = {
  home: vHome, batches: vBatches, newbatch: vNewBatch, schedule: vSchedule, newcampaign: vNewCampaign, plant: vPlant, team: vTeam, newperson: vNewPerson,
  safety: vSafety, newpermit: vNewPermit, newtransfer: vNewTransfer, import: vImport, settings: vSettings,
  batch: (id) => vBatch(decodeURIComponent(id)), block: vBlock, transfer: (id) => vTransfer(decodeURIComponent(id)),
};
async function render() {
  const keep = $app.querySelector('.scroll'), top = keep ? keep.scrollTop : 0, hadFocus = document.activeElement && document.activeElement.id;
  const [name, arg] = (location.hash.replace(/^#\//, '') || 'home').split('/');
  await load();
  $app.innerHTML = (ROUTES[name] || vHome)(arg);
  const sc = $app.querySelector('.scroll'); if (sc && ui.keepScroll) sc.scrollTop = top; else if (sc) sc.scrollTop = 0;
  ui.keepScroll = false;
  document.title = 'BatchBook';
}
const rerender = () => { ui.keepScroll = true; return render(); };

// ---------- actions ----------
const nextBatchId = (p) => { const d = new Date(), ym = String(d.getFullYear()).slice(2) + pad2(d.getMonth() + 1), pre = `${p.code}-${ym}-`; const n = D.batch.filter((b) => b.id.startsWith(pre)).map((b) => +b.id.slice(pre.length)).filter(Number); return pre + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0'); };
const ACT = {
  async bfilter(el) { ui.bf = el.dataset.v; await rerender(); },
  async day(el) { ui.teamDate = el.dataset.v; await rerender(); },
  async week(el) { ui.teamDate = ymd(new Date(new Date(ui.teamDate + 'T12:00:00').getTime() + Number(el.dataset.v) * DAY)); await rerender(); },
  async weektoday() { ui.teamDate = ymd(new Date()); await rerender(); },
  async tshift(el) { ui.teamShift = el.dataset.v; await rerender(); },
  async cycleshift(el) { const s = D.shift.find((x) => x.id === el.dataset.id), order = ['A', 'B', 'C', 'O', 'L']; await DB.put('shift', { ...s, code: order[(order.indexOf(s.code) + 1) % 5] }); await rerender(); },
  async clockin(el) { const s = D.shift.find((x) => x.id === el.dataset.id), hr = new Date().getHours(), start = { A: 6, B: 14, C: 22 }[s.code]; await DB.put('att', { id: s.id, emp: s.emp, date: s.date, inAt: new Date().toISOString(), late: Math.abs(hr - start) > 0 && hr - start >= 1 }); toast('Clocked in'); await rerender(); },
  async delbatch(el) { if (!confirm('Delete batch ' + el.dataset.id + '? This cannot be undone.')) return; const b = D.batch.find((x) => x.id === el.dataset.id); const r = D.reactor.find((x) => x.batchId === b.id); if (r) await DB.put('reactor', { ...r, batchId: null, state: 'idle', step: 'Available now', pct: 0 }); await DB.del('batch', b.id); toast('Batch deleted'); location.hash = '#/batches'; },
  async delcampaign(el) { if (!confirm('Delete this campaign?')) return; await DB.del('campaign', el.dataset.id); await rerender(); },
  async permit(el) { const p = D.permit.find((x) => x.id === el.dataset.id); await DB.put('permit', { ...p, status: el.dataset.v }); toast('Permit ' + (el.dataset.v === 'active' ? 'approved' : 'closed')); await rerender(); },
  async check(el) { const t = D.transfer.find((x) => x.id === el.dataset.id), i = +el.dataset.v, c = [...t.checks]; c[i] = !c[i]; await DB.put('transfer', { ...t, checks: c }); await rerender(); },
  async sign(el) { const t = D.transfer.find((x) => x.id === el.dataset.id); await DB.put('transfer', { ...t, [el.dataset.v]: !t[el.dataset.v] }); await rerender(); },
  async starttransfer(el) { const t = D.transfer.find((x) => x.id === el.dataset.id); if (clashOf(t).length) return toast('Blocked: hot work is active in this zone.'); await DB.put('transfer', { ...t, checks: t.checks.map((c, i) => (i === 3 ? true : c)), status: 'running', startedAt: new Date().toISOString() }); toast('Transfer started'); await rerender(); },
  async finishtransfer(el) { const t = D.transfer.find((x) => x.id === el.dataset.id); await DB.put('transfer', { ...t, status: 'done', doneAt: new Date().toISOString() }); toast('Transfer completed'); await rerender(); },
  async impkind(el) { ui.imp = { kind: el.dataset.v, data: null, map: {}, result: null }; await rerender(); },
  template() { const k = ui.imp ? ui.imp.kind : 'batches'; download(`batchbook-${k}-template.csv`, Importer.template(k), 'text/csv'); },
  async doimport() {
    const s = ui.imp, r = s.result; if (!r || !r.ready.length) return;
    if (s.kind === 'batches') {
      await DB.bulkPut('batch', r.ready);
    } else if (s.kind === 'schedule') {
      await DB.bulkPut('campaign', r.ready);
    } else {
      const byName = new Map(D.employee.map((e) => [e.name.toLowerCase(), e])), newEmps = [];
      let n = Math.max(1040, ...D.employee.map((e) => +e.id.replace(/\D/g, '') || 0));
      for (const row of r.ready) if (!byName.has(row.name.toLowerCase())) { const e = { id: 'E-' + ++n, name: row.name, role: row.role, base: row.code === 'O' || row.code === 'L' ? 'A' : row.code }; byName.set(row.name.toLowerCase(), e); newEmps.push(e); }
      if (newEmps.length) await DB.bulkPut('employee', newEmps);
      await DB.bulkPut('shift', r.ready.map((row) => { const e = byName.get(row.name.toLowerCase()); return { id: `${e.id}_${row.date}`, emp: e.id, date: row.date, code: row.code }; }));
    }
    toast(`Imported ${r.ready.length} rows`); ui.imp = null;
    location.hash = { batches: '#/batches', schedule: '#/schedule', roster: '#/team' }[s.kind];
  },
  theme(el) { localStorage.setItem('bb_theme', el.dataset.v); applyTheme(); rerender(); },
  async syncnow() { await withBusy('Backing up…', async () => { const n = await Sync.push(); ui.lastSync = Date.now(); toast(n ? `Backed up ${n} changes` : 'Already up to date'); }); },
  async restore() { if (!confirm('Merge the Google Drive backup into this phone? Newer records win.')) return; await withBusy('Restoring…', async () => { const r = await Sync.restore(); toast(`Restored from ${r.snapshots} snapshot and ${r.opsFiles} change files`); }); },
  async exportjson() { download(`batchbook-backup-${ymd(new Date())}.json`, JSON.stringify({ app: 'batchbook', at: Date.now(), docs: await DB.exportAll() }), 'application/json'); },
  async reseed() { if (!confirm('Replace everything on this phone with the sample data?')) return; await DB.wipe(); await seedData(); toast('Sample data loaded'); location.hash = '#/home'; },
  async wipe() { if (!confirm('Erase ALL data on this phone? If you have not backed up, it is gone for good.')) return; await DB.wipe(); await DB.metaSet('seeded', true); await DB.metaSet('syncedSeq', 0); toast('Everything erased'); location.hash = '#/home'; await render(); },
  async install() { ui.installEvt.prompt(); ui.installEvt = null; },
};
async function withBusy(msg, fn) { toast(msg); try { await fn(); } catch (e) { toast(e.message || String(e)); } await rerender(); }
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

const FORMS = {
  async newbatch(f) {
    const p = prodOf(f.product), r = D.reactor.find((x) => x.id === f.reactor); if (!p || !r) return toast('Pick a product and reactor');
    const id = (f.id || '').trim().toUpperCase() || nextBatchId(p); if (D.batch.some((b) => b.id === id)) return toast('Batch ' + id + ' already exists');
    const now = new Date().toISOString();
    await DB.put('batch', { id, product: p.name, reactor: r.id, start: now, end: null, eta: new Date(Date.now() + p.cyc * DAY).toISOString(), yield: null, status: 'running', steps: [{ name: STEPS[0], at: now }] });
    await DB.put('reactor', { ...r, state: 'charging', batchId: id, step: STEPS[0], pct: 5 });
    toast('Batch ' + id + ' started'); location.hash = '#/batch/' + encodeURIComponent(id);
  },
  async addstep(f) { const b = D.batch.find((x) => x.id === f.id); await DB.put('batch', { ...b, steps: [...b.steps, { name: f.name, at: new Date().toISOString(), note: f.note || '' }] }); const r = D.reactor.find((x) => x.batchId === b.id); if (r) await DB.put('reactor', { ...r, step: f.name, state: r.state === 'charging' && f.name !== STEPS[0] ? 'running' : r.state, pct: Math.min(95, Math.round(((STEPS.indexOf(f.name) + 1) / STEPS.length) * 100)) }); toast('Step recorded'); await rerender(); },
  async setstatus(f) {
    const b = D.batch.find((x) => x.id === f.id), fin = ['released', 'rejected', 'rework'].includes(f.status), y = f.yield === '' ? null : Number(f.yield);
    if (y != null && (isNaN(y) || y < 0 || y > 100)) return toast('Yield must be between 0 and 100');
    await DB.put('batch', { ...b, status: f.status, yield: y, deviation: f.deviation || undefined, end: fin ? b.end || new Date().toISOString() : null, eta: fin ? null : b.eta });
    const r = D.reactor.find((x) => x.batchId === b.id);
    if (r && fin) await DB.put('reactor', { ...r, state: 'cleaning', batchId: null, step: 'Clean-in-place', pct: 0 });
    toast('Status saved'); await rerender();
  },
  async newcampaign(f) { if (f.end < f.start) return toast('End date is before start date'); await DB.put('campaign', { id: 'c' + Date.now().toString(36), reactor: f.reactor, product: f.product, start: new Date(f.start + 'T00:00:00').toISOString(), end: new Date(f.end + 'T00:00:00').toISOString(), batches: Math.max(1, Math.round((new Date(f.end) - new Date(f.start)) / DAY / (prodOf(f.product)?.cyc || 2))) }); toast('Campaign saved'); location.hash = '#/schedule'; },
  async newperson(f) { const n = Math.max(1040, ...D.employee.map((e) => +e.id.replace(/\D/g, '') || 0)) + 1, id = 'E-' + n; await DB.put('employee', { id, name: f.name.trim(), role: f.role, base: f.base }); const rows = []; for (let i = 0; i < 28; i++) { const d = new Date(Date.now() + i * DAY), dw = (d.getDay() + 6) % 7; rows.push({ id: `${id}_${ymd(d)}`, emp: id, date: ymd(d), code: dw === 6 ? 'O' : f.base }); } await DB.bulkPut('shift', rows); toast(f.name + ' added'); location.hash = '#/team'; },
  async newpermit(f) { const n = Math.max(860, ...D.permit.map((p) => +p.id.replace(/\D/g, '') || 0)) + 1, id = 'PTW-' + String(n).padStart(4, '0'); await DB.put('permit', { id, kind: f.kind, area: f.area, note: f.note.trim(), validTo: new Date(Date.now() + Number(f.hours || 8) * 36e5).toISOString(), status: 'awaiting' }); toast(id + ' raised'); location.hash = '#/safety'; },
  async newtransfer(f) { const n = Math.max(0, ...D.transfer.map((t) => +t.id.replace(/\D/g, '') || 0)) + 1, id = 'TR-' + String(n).padStart(4, '0'), r = D.reactor.find((x) => x.id === f.reactor); await DB.put('transfer', { id, solvent: f.solvent, qty: Number(f.qty), tank: f.tank, reactor: f.reactor, batchId: r && r.batchId, checks: Array(7).fill(false), signOp: false, signSup: false, status: 'checks' }); toast(id + ' created'); location.hash = '#/transfer/' + id; },
};

document.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (!el || el.disabled) return; const fn = ACT[el.dataset.act]; if (fn) Promise.resolve(fn(el, e)).catch((err) => toast(err.message || String(err))); });
document.addEventListener('submit', (e) => { const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault(); const o = Object.fromEntries(new FormData(f).entries()); Promise.resolve(FORMS[f.dataset.form](o)).catch((err) => toast(err.message || String(err))); });
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]'); if (!el) return;
  if (el.dataset.input === 'bq') { ui.bq = el.value; const l = document.getElementById('blist'); if (l) l.innerHTML = batchRows(); }
  if (el.dataset.input === 'gclient') Sync.setClientId(el.value);
});
document.addEventListener('change', async (e) => {
  const el = e.target.closest('[data-change]'); if (!el) return;
  try {
    if (el.dataset.change === 'reactorstate') { const r = D.reactor.find((x) => x.id === el.dataset.id); const v = el.value; await DB.put('reactor', { ...r, state: v, step: { idle: 'Available now', cleaning: 'Clean-in-place running', maintenance: 'Under maintenance' }[v] || r.step, pct: ['idle', 'cleaning', 'maintenance'].includes(v) ? 0 : r.pct }); toast(r.id + ' set to ' + RST[v][0]); await rerender(); }
    if (el.dataset.change === 'impfile') {
      const file = el.files[0]; if (!file) return; const s = ui.imp || (ui.imp = { kind: 'batches' });
      s.data = await Importer.readFile(file); s.map = Importer.autoMap(s.kind, s.data.headers); runImportCheck(); await rerender();
    }
    if (el.dataset.change === 'impmap') { ui.imp.map[el.dataset.id] = el.value; runImportCheck(); await rerender(); }
    if (el.dataset.change === 'bkfile') {
      const file = el.files[0]; if (!file) return; const j = JSON.parse(await file.text()); if (!Array.isArray(j.docs)) throw new Error('That is not a BatchBook backup file.');
      await DB.applyRemote(j.docs, []); toast('Backup file loaded (' + j.docs.length + ' records)'); await rerender();
    }
  } catch (err) { toast('Could not read that file: ' + (err.message || err)); }
});
function runImportCheck() {
  const s = ui.imp; if (!s || !s.data) return;
  s.result = Importer.validate(s.kind, s.data, s.map, { batchIds: new Set(D.batch.map((b) => b.id)), reactors: new Set(D.reactor.map((r) => r.id)), product: matchProduct });
}

function applyTheme() { document.documentElement.dataset.theme = localStorage.getItem('bb_theme') || 'light'; }
window.addEventListener('hashchange', render);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installEvt = e; });
window.addEventListener('online', () => rerender());

(async function boot() {
  applyTheme();
  await DB.open();
  if (!(await DB.metaGet('seeded'))) await seedData();
  ui.lastSync = await DB.metaGet('lastSync');
  DB.onchange = async () => { ui.pending = await Sync.pending(); };
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  await render();
})();
