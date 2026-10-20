// Import from Excel (.xlsx/.xls) or CSV using the bundled SheetJS library. Works offline.
const Importer = (() => {
  const KINDS = {
    batches: {
      label: 'Batch records', desc: 'Past and current batches with start, end and yield',
      fields: [
        { k: 'id', label: 'Batch ID', req: true, alias: ['batch no', 'batch number', 'batch id', 'batch', 'lot', 'lot no'] },
        { k: 'product', label: 'Product', req: true, alias: ['product', 'material', 'api', 'product name'] },
        { k: 'reactor', label: 'Reactor', req: true, alias: ['reactor', 'equipment', 'vessel', 'reactor no'] },
        { k: 'start', label: 'Start time', req: true, alias: ['start', 'start time', 'start date', 'charged on', 'charging date'] },
        { k: 'end', label: 'End time', alias: ['end', 'end time', 'end date', 'completed', 'completion', 'finished'] },
        { k: 'yield', label: 'Yield %', alias: ['yield', 'yield %', 'yield percent', 'yield (%)'] },
        { k: 'status', label: 'Status', alias: ['status', 'outcome', 'result', 'disposition'] },
      ],
      template: 'Batch ID,Product,Reactor,Start time,End time,Yield %,Status\nMET-2610-030,Metformin HCl,R-101,2026-10-01 08:00,2026-10-02 18:00,94.5,Released\n',
    },
    schedule: {
      label: 'Reactor schedule', desc: 'Planned or past campaigns per reactor',
      fields: [
        { k: 'reactor', label: 'Reactor', req: true, alias: ['reactor', 'equipment', 'vessel'] },
        { k: 'product', label: 'Product', req: true, alias: ['product', 'material', 'api'] },
        { k: 'start', label: 'Start date', req: true, alias: ['start', 'start date', 'from'] },
        { k: 'end', label: 'End date', req: true, alias: ['end', 'end date', 'to', 'until'] },
        { k: 'batches', label: 'No. of batches', alias: ['batches', 'no of batches', 'count', 'number of batches'] },
      ],
      template: 'Reactor,Product,Start date,End date,No. of batches\nR-103,Losartan Potassium,2026-11-02,2026-11-20,8\n',
    },
    roster: {
      label: 'Employee roster', desc: 'Staff and their shift for each date',
      fields: [
        { k: 'name', label: 'Employee name', req: true, alias: ['name', 'employee', 'employee name', 'staff'] },
        { k: 'role', label: 'Role', alias: ['role', 'designation', 'position'] },
        { k: 'date', label: 'Date', req: true, alias: ['date', 'day'] },
        { k: 'shift', label: 'Shift (A/B/C/Off/Leave)', req: true, alias: ['shift', 'shift code'] },
      ],
      template: 'Employee name,Role,Date,Shift\nOperator 11,Reactor operator,2026-10-26,A\n',
    },
  };

  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

  async function readFile(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
    return { name: file.name, headers: Object.keys(rows[0] || {}), rows };
  }

  function autoMap(kind, headers) {
    const map = {};
    for (const f of KINDS[kind].fields) {
      const hit = headers.find((h) => f.alias.includes(norm(h)));
      map[f.k] = hit || '';
    }
    return map;
  }

  const toISO = (v) => {
    if (v === '' || v == null) return null;
    const d = v instanceof Date ? v : new Date(typeof v === 'number' ? Math.round((v - 25569) * 864e5) : String(v).replace(' ', 'T'));
    return isNaN(d) ? null : d.toISOString();
  };
  // Calendar day as YYYY-MM-DD in local time (Excel dates can be a few minutes off midnight, so add 12 h first).
  const toDay = (v) => {
    if (v === '' || v == null) return null;
    let d = v instanceof Date ? new Date(v.getTime() + 12 * 36e5) : new Date(typeof v === 'number' ? Math.round((v - 25569) * 864e5) + 12 * 36e5 : String(v).replace(' ', 'T'));
    if (isNaN(d)) return null;
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  const reactorId = (v) => { const m = String(v).match(/R\s*-?\s*(\d+)/i); return m ? 'R-' + m[1] : ''; };
  const shiftCode = (v) => {
    const s = norm(v);
    if (/^(a|shift a|1)$/.test(s)) return 'A';
    if (/^(b|shift b|2)$/.test(s)) return 'B';
    if (/^(c|shift c|3|night)$/.test(s)) return 'C';
    if (/^(o|off|weekly off|wo)$/.test(s)) return 'O';
    if (/^(l|leave|cl|sl|pl)$/.test(s)) return 'L';
    return '';
  };
  const statusOf = (v, hasEnd) => {
    const s = norm(v);
    if (/reject/.test(s)) return 'rejected';
    if (/re work|rework/.test(s)) return 'rework';
    if (/hold/.test(s)) return 'hold';
    if (/delay/.test(s)) return 'delayed';
    if (/run|progress/.test(s)) return 'running';
    if (/releas|pass|approv/.test(s)) return 'released';
    return hasEnd ? 'released' : 'running';
  };

  // Check every row. Returns rows ready to save, warnings (saved anyway) and errors (skipped).
  function validate(kind, data, map, ctx) {
    const get = (row, k) => (map[k] ? row[map[k]] : '');
    const ready = [], warns = [], errs = [];
    const seen = new Set(ctx.batchIds);
    data.rows.forEach((row, i) => {
      const n = i + 2; // row number in the sheet, header is row 1
      const missing = KINDS[kind].fields.filter((f) => f.req && (get(row, f.k) === '' || get(row, f.k) == null));
      if (missing.length) return errs.push({ row: n, msg: 'Missing ' + missing.map((m) => m.label).join(', ') });
      if (kind === 'batches') {
        const id = String(get(row, 'id')).trim();
        const reactor = reactorId(get(row, 'reactor'));
        const start = toISO(get(row, 'start'));
        const end = toISO(get(row, 'end'));
        if (seen.has(id)) return errs.push({ row: n, msg: 'Duplicate batch number ' + id });
        if (!ctx.reactors.has(reactor)) return errs.push({ row: n, msg: 'Unknown reactor "' + get(row, 'reactor') + '"' });
        if (!start) return errs.push({ row: n, msg: 'Start time not understood' });
        if (end && end < start) return errs.push({ row: n, msg: 'End is before start' });
        seen.add(id);
        let y = get(row, 'yield'); y = y === '' ? null : Number(String(y).replace('%', ''));
        if (y != null && (isNaN(y) || y < 0 || y > 100)) { warns.push({ row: n, msg: 'Yield looks wrong, left blank' }); y = null; }
        ready.push({ id, product: ctx.product(String(get(row, 'product'))), reactor, start, end, yield: y, status: statusOf(get(row, 'status'), !!end), steps: [], imported: true });
      } else if (kind === 'schedule') {
        const reactor = reactorId(get(row, 'reactor'));
        const start = toISO(get(row, 'start')), end = toISO(get(row, 'end'));
        if (!ctx.reactors.has(reactor)) return errs.push({ row: n, msg: 'Unknown reactor "' + get(row, 'reactor') + '"' });
        if (!start || !end) return errs.push({ row: n, msg: 'Date not understood' });
        if (end < start) return errs.push({ row: n, msg: 'End is before start' });
        const nb = Number(get(row, 'batches'));
        ready.push({ id: 'c' + Date.now().toString(36) + i, reactor, product: ctx.product(String(get(row, 'product'))), start, end, batches: nb > 0 ? nb : null });
      } else {
        const date = toDay(get(row, 'date'));
        const code = shiftCode(get(row, 'shift'));
        if (!date) return errs.push({ row: n, msg: 'Date not understood' });
        if (!code) return errs.push({ row: n, msg: 'Shift "' + get(row, 'shift') + '" is not A, B, C, Off or Leave' });
        if (!get(row, 'role') && map.role) warns.push({ row: n, msg: 'No role given' });
        ready.push({ name: String(get(row, 'name')).trim(), role: String(get(row, 'role') || 'Operator').trim(), date, code });
      }
    });
    return { ready, warns, errs };
  }

  const template = (kind) => KINDS[kind].template;
  return { KINDS, readFile, autoMap, validate, template, shiftCode };
})();
