// Google Drive backup.
// - Small "ops" files hold only the changes since the last backup (incremental).
// - A full "snapshot" file is added about once a week so a restore never needs hundreds of files.
// - Files live in a visible Drive folder called "BatchBook Backup", created by this app (drive.file scope).
const Sync = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FOLDER = 'BatchBook Backup';
  const WEEK = 7 * 864e5;
  let token = null, tokenExp = 0;

  const clientId = () => localStorage.getItem('bb_gclient') || '';
  const setClientId = (v) => localStorage.setItem('bb_gclient', (v || '').trim());
  const hasToken = () => token && Date.now() < tokenExp;

  function loadGsi() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = res;
      s.onerror = () => rej(new Error('Could not load Google sign-in. Check your internet connection.'));
      document.head.appendChild(s);
    });
  }

  async function auth() {
    if (hasToken()) return;
    if (!clientId()) throw new Error('Add your Google client ID in Settings first.');
    if (!navigator.onLine) throw new Error('You are offline. Try again when connected.');
    await loadGsi();
    await new Promise((res, rej) => {
      const c = google.accounts.oauth2.initTokenClient({
        client_id: clientId(),
        scope: SCOPE,
        callback: (r) => {
          if (r.error) return rej(new Error('Google sign-in failed: ' + (r.error_description || r.error)));
          token = r.access_token;
          tokenExp = Date.now() + (Number(r.expires_in || 3600) - 60) * 1000;
          res();
        },
        error_callback: (e) => rej(new Error('Google sign-in was closed or blocked (' + (e.type || 'error') + ').')),
      });
      c.requestAccessToken({ prompt: token ? '' : 'consent' });
    });
  }

  async function api(url, opts = {}) {
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
    if (r.status === 401) { token = null; throw new Error('Google session expired. Tap Sync again.'); }
    if (!r.ok) throw new Error('Google Drive error ' + r.status + ': ' + (await r.text()).slice(0, 160));
    return r;
  }

  async function folderId() {
    const cached = await DB.metaGet('driveFolder');
    if (cached) {
      const ok = await fetch('https://www.googleapis.com/drive/v3/files/' + cached + '?fields=id,trashed', { headers: { Authorization: 'Bearer ' + token } });
      if (ok.ok && !(await ok.json()).trashed) return cached;
    }
    const q = encodeURIComponent(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const found = await (await api('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id)')).json();
    let id = found.files && found.files[0] && found.files[0].id;
    if (!id) {
      const made = await (await api('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
      })).json();
      id = made.id;
    }
    await DB.metaSet('driveFolder', id);
    return id;
  }

  async function upload(name, obj, folder) {
    const b = 'bb' + Math.random().toString(36).slice(2);
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name, parents: [folder], mimeType: 'application/json' }) +
      `\r\n--${b}\r\nContent-Type: application/json\r\n\r\n` + JSON.stringify(obj) + `\r\n--${b}--`;
    await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body,
    });
  }

  async function deviceId() {
    let d = await DB.metaGet('deviceId');
    if (!d) { d = Math.random().toString(36).slice(2, 8); await DB.metaSet('deviceId', d); }
    return d;
  }

  async function pending() {
    return (await DB.opsSince((await DB.metaGet('syncedSeq')) || 0)).length;
  }

  // Send everything that changed since the last backup.
  async function push() {
    await auth();
    const folder = await folderId();
    const from = (await DB.metaGet('syncedSeq')) || 0;
    const ops = await DB.opsSince(from);
    const dev = await deviceId();
    const lastSnap = (await DB.metaGet('lastSnapshot')) || 0;
    let sent = 0;
    if (ops.length) {
      const to = ops[ops.length - 1].seq;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await upload(`ops_${stamp}_${dev}_${from + 1}-${to}.json`, { device: dev, ops }, folder);
      await DB.metaSet('syncedSeq', to);
      sent = ops.length;
    }
    if (!lastSnap || Date.now() - lastSnap > WEEK) {
      const docs = await DB.exportAll();
      await upload(`snapshot_${new Date().toISOString().slice(0, 10)}_${dev}.json`, { device: dev, at: Date.now(), docs }, folder);
      await DB.metaSet('lastSnapshot', Date.now());
    }
    await DB.metaSet('lastSync', Date.now());
    return sent;
  }

  async function listFiles(folder) {
    const q = encodeURIComponent(`'${folder}' in parents and trashed=false`);
    let out = [], page = '';
    do {
      const r = await (await api(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1000&fields=nextPageToken,files(id,name)${page}`)).json();
      out = out.concat(r.files || []);
      page = r.nextPageToken ? '&pageToken=' + r.nextPageToken : '';
    } while (page);
    return out;
  }
  const download = async (id) => (await api('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media')).json();

  // Rebuild the local database from Drive: newest snapshot, then every ops file. Newer record wins.
  async function restore() {
    await auth();
    const folder = await folderId();
    const files = await listFiles(folder);
    const snaps = files.filter((f) => f.name.startsWith('snapshot_')).sort((a, b) => a.name.localeCompare(b.name));
    const opsFiles = files.filter((f) => f.name.startsWith('ops_')).sort((a, b) => a.name.localeCompare(b.name));
    if (!snaps.length && !opsFiles.length) throw new Error('No backup found in Google Drive yet.');
    let docs = [];
    if (snaps.length) docs = (await download(snaps[snaps.length - 1].id)).docs || [];
    let ops = [];
    for (const f of opsFiles) ops = ops.concat((await download(f.id)).ops || []);
    ops.sort((a, b) => a.ts - b.ts);
    await DB.applyRemote(docs, ops);
    await DB.metaSet('lastSync', Date.now());
    return { snapshots: snaps.length, opsFiles: opsFiles.length };
  }

  return { clientId, setClientId, hasToken, push, restore, pending, auth };
})();
