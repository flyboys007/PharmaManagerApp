// Sample data so the app is usable on first open. All names, batches and numbers are made up.
const SEED_PRODUCTS = [
  { k: 'met', color: '#0B5F58', name: 'Metformin HCl', code: 'MET', cyc: 1.4 },
  { k: 'atv', color: '#1E4FBF', name: 'Atorvastatin Ca', code: 'ATV', cyc: 2.2 },
  { k: 'los', color: '#9A4A06', name: 'Losartan K', code: 'LOS', cyc: 2.4 },
  { k: 'aml', color: '#6428C4', name: 'Amlodipine Bes.', code: 'AML', cyc: 1.6 },
  { k: 'pan', color: '#3F4B49', name: 'Pantoprazole Na', code: 'PAN', cyc: 3.2 },
];
const SEED_STAGES = ['Raw material charge', 'Reaction', 'Crystallisation', 'Centrifuge and wash', 'Drying', 'QC release'];
const REACTOR_DEFS = [
  ['R-101', 'A', '6 KL stainless steel'], ['R-102', 'A', '6 KL glass-lined'], ['R-103', 'A', '4 KL glass-lined'],
  ['R-104', 'A', '4 KL hastelloy'], ['R-105', 'A', '6 KL glass-lined'], ['R-106', 'A', '4 KL stainless steel'],
  ['R-107', 'B', '6 KL stainless steel'], ['R-108', 'B', '6 KL glass-lined'], ['R-109', 'B', '4 KL glass-lined'],
  ['R-110', 'B', '4 KL hastelloy'], ['R-111', 'B', '6 KL glass-lined'], ['R-112', 'B', '4 KL stainless steel'],
];
const SEED_BLOCKS = { A: { name: 'Intermediates', zone: 'General' }, B: { name: 'Final API', zone: 'Controlled' } };
const PALETTE = ['#0B5F58', '#1E4FBF', '#9A4A06', '#6428C4', '#3F4B49', '#B3261E', '#0E7490', '#7A5C00'];
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

async function seedData() {
  const now = Date.now(), DAY = 864e5, H = 36e5;
  const used = {};
  const nextId = (code, t) => {
    const d = new Date(t), ym = String(d.getFullYear()).slice(2) + pad2(d.getMonth() + 1), key = code + ym;
    used[key] = (used[key] || 0) + 1;
    return `${code}-${ym}-${String(used[key] + 3).padStart(3, '0')}`;
  };
  const iso = (t) => new Date(t).toISOString();
  const stepsFor = (start, upto, total) => SEED_STAGES.slice(0, upto).map((name, i) => ({ name, at: iso(start + (total * i) / SEED_STAGES.length) }));

  const live = {
    'R-101': [0, 'running', 'Condensation · 78 °C', 62, 'running', 14, 11],
    'R-102': [1, 'running', 'Crystallisation · 12 °C', 85, 'running', 50, 4],
    'R-103': [2, 'charging', 'Raw material charge', 10, 'running', 1, 52],
    'R-104': [3, 'running', 'Hydrogenation · 4.5 bar', 40, 'delayed', 8, 17],
    'R-107': [0, 'running', 'Distillation · 64 °C', 71, 'running', 26, 9],
    'R-109': [4, 'running', 'Reaction · 25 °C', 33, 'hold', 11, 40],
    'R-111': [1, 'charging', 'Solvent charge', 5, 'running', 0.5, 50],
    'R-112': [2, 'running', 'Drying · vacuum', 92, 'running', 60, 3],
  };
  const batches = [], reactors = [];
  REACTOR_DEFS.forEach(([id, block, cap], i) => {
    const l = live[id];
    const r = { id, block, cap, state: 'idle', step: 'Available now', pct: 0, batchId: null, inCharge: 'Operator ' + pad2(i + 1) };
    if (l) {
      const p = SEED_PRODUCTS[l[0]], start = now - l[5] * H;
      const b = { id: nextId(p.code, start), product: p.name, reactor: id, start: iso(start), end: null, eta: iso(now + l[6] * H), yield: null, status: l[4], steps: stepsFor(start, Math.max(1, Math.round((l[3] / 100) * 5) + 1), l[5] * H * 1.2) };
      if (l[4] === 'hold') b.deviation = 'In-process sample waiting for QC release before the next step.';
      if (l[4] === 'delayed') b.deviation = 'Running about 2 h behind plan.';
      batches.push(b);
      Object.assign(r, { state: l[1], step: l[2], pct: l[3], batchId: b.id });
    }
    if (id === 'R-105') Object.assign(r, { state: 'cleaning', step: 'Clean-in-place running', pct: 55 });
    if (id === 'R-108') Object.assign(r, { state: 'maintenance', step: 'Agitator seal replacement', pct: 30 });
    if (id === 'R-110') r.step = 'Available from 14:00';
    reactors.push(r);
  });

  // Past 6 months of finished batches.
  for (let i = 0; i < 70; i++) {
    const p = SEED_PRODUCTS[i % 5], rid = REACTOR_DEFS[(i * 7) % 12][0];
    const start = now - (1.5 + i * 2.5) * DAY + (i % 5) * 3 * H, dur = (p.cyc + ((i * 3) % 5) * 0.1) * DAY, end = start + dur;
    let status = 'released', y = 86 + ((i * 13) % 90) / 10;
    if (i % 23 === 5) { status = 'rejected'; y = 79.5; } else if (i % 11 === 4) { status = 'rework'; y = 86.2; }
    const b = { id: nextId(p.code, start), product: p.name, reactor: rid, start: iso(start), end: iso(end), yield: Math.round(y * 10) / 10, status, steps: stepsFor(start, 6, dur) };
    if (i === 8) b.deviation = 'Jacket temperature 3 °C above set point for 25 min during crystallisation. QA reviewed: no impact on release.';
    batches.push(b);
  }

  // Campaigns: runs of one product on a reactor, 150 days back to 30 days ahead.
  const campaigns = [], d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const base = d0.getTime() - 150 * DAY, total = 180;
  REACTOR_DEFS.forEach(([rid], i) => {
    let day = (i * 3) % 7, k = 0;
    while (day < total - 1) {
      const p = SEED_PRODUCTS[(i + k) % 5], len = 14 + ((i * 7 + k * 11) % 20), end = Math.min(day + len, total);
      campaigns.push({ id: `c${i}_${k}`, reactor: rid, product: p.name, start: iso(base + day * DAY), end: iso(base + end * DAY), batches: Math.max(1, Math.round((end - day) / p.cyc)) });
      day = end + 2; k++;
    }
  });

  // People and shifts.
  const emps = [
    ['Operator 01', 'Reactor operator', 'A'], ['Operator 02', 'Reactor operator', 'A'], ['Operator 03', 'Reactor operator', 'B'],
    ['Operator 04', 'Reactor operator', 'B'], ['Operator 05', 'Reactor operator', 'C'], ['Operator 06', 'Reactor operator', 'A'],
    ['Supervisor 01', 'Shift supervisor', 'A'], ['Supervisor 02', 'Shift supervisor', 'B'], ['Supervisor 03', 'Shift supervisor', 'C'],
    ['Chemist 01', 'Process chemist', 'A'],
  ].map(([name, role, base], i) => ({ id: 'E-' + (1041 + i), name, role, base }));
  const shifts = [], att = [], today = ymd(new Date());
  for (let n = -30; n <= 30; n++) {
    const d = new Date(d0.getTime() + n * DAY), dow = (d.getDay() + 6) % 7;
    emps.forEach((e, i) => {
      let code = e.base;
      if (dow === i % 7 || dow === (i + 3) % 7) code = 'O';
      if (i === 5 && (n === 2 || n === 3)) code = 'L';
      shifts.push({ id: `${e.id}_${ymd(d)}`, emp: e.id, date: ymd(d), code });
    });
  }
  emps.forEach((e, i) => {
    const s = shifts.find((x) => x.id === `${e.id}_${today}`);
    if (s && s.code === 'A') att.push({ id: s.id, emp: e.id, date: today, inAt: new Date(d0.getTime() + (5.9 + (i === 5 ? 0.4 : 0.05)) * H).toISOString(), late: i === 5 });
  });

  const permits = [
    { id: 'PTW-0871', kind: 'Maintenance with line isolation', area: 'Block B', note: 'R-108 agitator seal', validTo: iso(now + 18 * H), status: 'active' },
    { id: 'PTW-0872', kind: 'Hot work', area: 'Utilities', note: 'Welding on chiller support', validTo: iso(now + 6 * H), status: 'awaiting' },
    { id: 'PTW-0869', kind: 'Work at height', area: 'Block A', note: 'Roof inspection', validTo: iso(now - 20 * H), status: 'closed' },
  ];
  const transfers = [
    { id: 'TR-0007', solvent: 'Methanol', qty: 1200, tank: 'T-201', reactor: 'R-103', batchId: reactors.find((r) => r.id === 'R-103').batchId, checks: [1, 1, 1, 1, 1, 1, 1].map(Boolean), signOp: true, signSup: true, status: 'running', startedAt: iso(now - 0.4 * H) },
    { id: 'TR-0008', solvent: 'Toluene', qty: 900, tank: 'T-204', reactor: 'R-111', batchId: reactors.find((r) => r.id === 'R-111').batchId, checks: [true, true, true, true, false, false, false], signOp: true, signSup: false, status: 'checks' },
  ];

  await DB.bulkPut('reactor', reactors);
  await DB.bulkPut('batch', batches);
  await DB.bulkPut('campaign', campaigns);
  await DB.bulkPut('employee', emps);
  await DB.bulkPut('shift', shifts);
  await DB.bulkPut('att', att);
  await DB.bulkPut('permit', permits);
  await DB.bulkPut('transfer', transfers);
  await DB.metaSet('seeded', true);
  await DB.metaSet('masterInit', false);
  await ensureMaster();
}

// Products, stages and blocks are editable master data (Setup menu). Created once, also for phones that already hold older data.
async function ensureMaster() {
  if (await DB.metaGet('masterInit')) return;
  const stages = SEED_STAGES.map((name, i) => ({ id: 's' + (i + 1), name, order: i }));
  const products = SEED_PRODUCTS.map((p) => ({ id: p.k, name: p.name, code: p.code, cyc: p.cyc, color: p.color, stages: stages.map((s) => s.id) }));
  const known = new Set(products.map((p) => p.name));
  const extra = [...(await DB.all('batch')), ...(await DB.all('campaign'))].map((x) => x.product).filter((n) => n && !known.has(n));
  [...new Set(extra)].forEach((name, i) => {
    let code = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'PRD';
    while (products.some((p) => p.code === code)) code = code.slice(0, 2) + String.fromCharCode(65 + ((i + products.length) % 26));
    products.push({ id: 'p' + (i + 1) + Date.now().toString(36), name, code, cyc: 2, color: PALETTE[products.length % PALETTE.length], stages: stages.map((s) => s.id) });
  });
  const bids = [...new Set((await DB.all('reactor')).map((r) => r.block))].sort();
  const blocks = bids.map((id) => ({ id, name: (SEED_BLOCKS[id] || {}).name || 'Block ' + id, zone: (SEED_BLOCKS[id] || {}).zone || 'General' }));
  await DB.bulkPut('stage', stages);
  await DB.bulkPut('product', products);
  if (blocks.length) await DB.bulkPut('block', blocks);
  await DB.metaSet('masterInit', true);
}
