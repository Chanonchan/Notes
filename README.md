# DayLog

A personal work log for your phone: record what you did in a few seconds, then review it by day, week or month. Built with React Native + Expo (TypeScript). Everything stays on your phone in SQLite: there's no account and no server.

## Use it in your phone's browser

**https://chanonchan.github.io/Notes/**

Install it as an app (it then opens full-screen from its own icon, without the browser bar):
- iPhone: open the link in **Safari** → Share → **Add to Home Screen** → Add
- Android: open it in **Chrome** → ⋮ → **Install app** (or Add to Home screen)

Your log is saved on the phone (IndexedDB), so nothing is sent anywhere. On iPhone, the home-screen app keeps its own storage, separate from Safari. Deleting the app or clearing website data deletes the log, so keep a backup: More → Backup & export (Copy backup / Save backup file). The same screen moves data from Safari into the home-screen app (Copy backup in Safari, Paste backup in the app).

`public/` holds the web-app manifest, icons and the HTML template that makes this installable.

Publishing a new version: run `npm run build:web`, then push the contents of `dist/` to the `gh-pages` branch.

## Run it on your phone (Expo Go)

1. Install **Expo Go** from the App Store or Google Play.
2. On your computer, with Node 20+ installed:
   ```bash
   git clone https://github.com/chanonchan/notes.git daylog && cd daylog
   git checkout claude/daylog
   npm install
   npx expo start
   ```
3. Scan the QR code. On iPhone use the Camera app; on Android use the scanner in Expo Go.
   If your phone and computer are on different networks, run `npx expo start --tunnel` instead.

## Develop

```bash
npm test            # unit tests (database layer, topic suggestion, dates)
npm run typecheck   # TypeScript
```

## Project layout

| Folder      | What's inside |
|-------------|----------------|
| `screens/`  | One file per screen |
| `components/` | Reusable UI (topic picker, type selector, entry row, …) |
| `db/`       | `Db` interface, expo-sqlite adapter, migrations, repositories |
| `services/` | Pure logic: dates, topic suggestion, `summary/` (rule-based `Summarizer` + plain-text formatter; swap in an AI summarizer in `summary/index.ts`), sharing |
| `hooks/`    | `useDb`/`useQuery`/`useMutation`, data hooks, theme |
| `types/`    | Domain and navigation types |
| `__tests__/` | Jest tests. The DB tests run the real migrations on Node's built-in SQLite |
