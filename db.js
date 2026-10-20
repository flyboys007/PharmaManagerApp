// Local database on the phone: IndexedDB.
// Every record lives in one store ("docs") keyed "type:id".
// Every change is also appended to "oplog" so it can be backed up to Google Drive in small increments.
const DB = (() => {
  let db;
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });

  async function open() {
    db = await new Promise((res, rej) => {
      const r = indexedDB.open('batchbook', 1);
      r.onupgradeneeded = (e) => {
        const d = e.target.result;
        d.createObjectStore('docs', { keyPath: 'k' });
        d.createObjectStore('oplog', { keyPath: 'seq', autoIncrement: true });
        d.createObjectStore('meta', { keyPath: 'key' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  const range = (type) => IDBKeyRange.bound(type + ':', type + ':￿');
  const all = (type) => req(db.transaction('docs').objectStore('docs').getAll(range(type)));
  const get = (type, id) => req(db.transaction('docs').objectStore('docs').get(type + ':' + id));

  async function put(type, obj) {
    const doc = { ...obj, k: type + ':' + obj.id, type, _ts: Date.now() };
    const t = db.transaction(['docs', 'oplog'], 'readwrite');
    t.objectStore('docs').put(doc);
    t.objectStore('oplog').add({ ts: doc._ts, k: doc.k, op: 'put', doc });
    await done(t);
    DB.onchange && DB.onchange();
    return doc;
  }
  async function bulkPut(type, arr) {
    const t = db.transaction(['docs', 'oplog'], 'readwrite');
    const ts = Date.now();
    for (const obj of arr) {
      const doc = { ...obj, k: type + ':' + obj.id, type, _ts: ts };
      t.objectStore('docs').put(doc);
      t.objectStore('oplog').add({ ts, k: doc.k, op: 'put', doc });
    }
    await done(t);
    DB.onchange && DB.onchange();
  }
  async function del(type, id) {
    const k = type + ':' + id;
    const t = db.transaction(['docs', 'oplog'], 'readwrite');
    t.objectStore('docs').delete(k);
    t.objectStore('oplog').add({ ts: Date.now(), k, op: 'del' });
    await done(t);
    DB.onchange && DB.onchange();
  }

  const metaGet = async (key) => (await req(db.transaction('meta').objectStore('meta').get(key)))?.value;
  async function metaSet(key, value) {
    const t = db.transaction('meta', 'readwrite');
    t.objectStore('meta').put({ key, value });
    await done(t);
  }

  const opsSince = (seq) => req(db.transaction('oplog').objectStore('oplog').getAll(IDBKeyRange.lowerBound(seq, true)));
  async function lastSeq() {
    const c = await req(db.transaction('oplog').objectStore('oplog').openCursor(null, 'prev'));
    return c ? c.key : 0;
  }
  const exportAll = () => req(db.transaction('docs').objectStore('docs').getAll());

  // Apply changes that came from a backup. Newer record wins. Not written to oplog (already backed up).
  async function applyRemote(docs, ops) {
    const t = db.transaction('docs', 'readwrite');
    const store = t.objectStore('docs');
    const have = new Map((await req(store.getAll())).map((d) => [d.k, d]));
    const take = (k, ts, fn) => { const cur = have.get(k); if (!cur || cur._ts < ts) fn(); };
    for (const d of docs || []) take(d.k, d._ts, () => { store.put(d); have.set(d.k, d); });
    for (const o of ops || []) {
      if (o.op === 'put') take(o.k, o.ts, () => { store.put(o.doc); have.set(o.k, o.doc); });
      else take(o.k, o.ts, () => { store.delete(o.k); have.set(o.k, { _ts: o.ts }); });
    }
    await done(t);
  }

  async function wipe() {
    const t = db.transaction(['docs', 'oplog'], 'readwrite');
    t.objectStore('docs').clear();
    t.objectStore('oplog').clear();
    await done(t);
    DB.onchange && DB.onchange();
  }

  return { open, all, get, put, bulkPut, del, metaGet, metaSet, opsSince, lastSeq, exportAll, applyRemote, wipe, onchange: null };
})();
