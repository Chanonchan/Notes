# DayLog

A personal work log for your phone: record what you did in a few seconds, then review it by day, week or month. Built with React Native + Expo (TypeScript). Everything stays on your phone in SQLite: there's no account and no server.

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
| `services/` | Pure logic: dates, topic suggestion, summary (coming in milestone 4), notifications, export |
| `hooks/`    | `useDb`/`useQuery`/`useMutation`, data hooks, theme |
| `types/`    | Domain and navigation types |
| `__tests__/` | Jest tests. The DB tests run the real migrations on Node's built-in SQLite |
