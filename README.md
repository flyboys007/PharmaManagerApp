# BatchBook (prototype PWA)

Production manager app for an API plant: batches with a stage-by-stage pipeline, reactors by block, shifts and attendance,
month calendar and 6-month reactor timeline, work permits and solvent transfers. Three themes. Excel/CSV import.

Bottom bar: Home, Batches, Reactors, Shifts, Calendar.
Setup (slider icon on Home): one menu to add and edit Products, Reactors, Stages and Blocks.
Each product picks its stages; every batch shows that product's pipeline and moves stage by stage.

All data lives **on the phone** (IndexedDB). Backup to **Google Drive** copies only what changed.
Sample data (made-up names and batches) loads on first open. Settings > "Reset to sample data" reloads it.

This is a prototype. Do not use it for real GMP batch records until IT and QA have reviewed it.

## 1. Put it online (needed for install on a phone: HTTPS)

Easiest: GitHub Pages.
1. Create a repo and upload everything in this folder (keep the folder structure).
2. Repo Settings > Pages > Deploy from branch (main, root).
3. Open https://YOUR-NAME.github.io/REPO/ on the phone.

Alternatives: Netlify drag-and-drop, or any static web host with HTTPS.
Testing on a computer only: run `python3 -m http.server 8000` here and open http://localhost:8000.

## 2. Install on the phone
- Android Chrome: menu (three dots) > Install app.
- iPhone Safari: Share > Add to Home Screen. Open it from the home screen icon after that.

It works offline after the first load.

## 3. Turn on Google Drive backup (one-time, about 10 minutes)
1. Go to console.cloud.google.com and create a project.
2. APIs and Services > Library > enable **Google Drive API**.
3. OAuth consent screen: User type External, add your Gmail as a Test user, add scope `.../auth/drive.file`.
4. Credentials > Create credentials > OAuth client ID > Web application.
   Authorized JavaScript origins: your site address only, e.g. `https://YOUR-NAME.github.io` (no path, no trailing slash).
5. Copy the Client ID. In the app: Settings > Google client ID > paste > Back up now > sign in and allow.

How backup works: each backup uploads one small "ops" file with only the changes since last time, plus a full
"snapshot" file about once a week, into a Drive folder called "BatchBook Backup".
Restore (Settings > Restore from Google Drive) loads the latest snapshot and then replays all change files.
Newer edits win if the same record changed on two phones.

The app only sees files it created (drive.file scope), never the rest of your Drive.

## Files
index.html, styles.css  – shell and themes
app.js                  – screens and actions
db.js                   – local database and change log
sync.js                 – Google Drive backup and restore
importer.js             – Excel/CSV import and checks
seed.js                 – sample data
sw.js, manifest.webmanifest, icons/ – offline and install
lib/xlsx.full.min.js    – SheetJS (Excel reader), bundled so import works offline
