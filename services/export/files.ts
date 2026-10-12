import { Platform, Share } from 'react-native';

/**
 * Hands a text file to the user. On phones (web) this opens the share sheet
 * with the file attached, so it can go to Files, AirDrop, email…; browsers
 * without that fall back to a normal download. Native apps share the text.
 */
export async function saveTextFile(filename: string, text: string, mime: string): Promise<'shared' | 'downloaded' | 'dismissed'> {
  if (Platform.OS !== 'web') {
    const res = await Share.share({ message: text, title: filename });
    return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
  }
  const file = new File([text], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'dismissed';
      // Fall through to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/** Lets the user pick a file and returns its text (web only; null if cancelled/unsupported). */
export function pickTextFile(): Promise<string | null> {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/plain';
    input.style.display = 'none';
    let settled = false;
    const done = (v: string | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(v);
    };
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return done(null);
      f.text().then(done, () => done(null));
    };
    // Some browsers fire "cancel" when the picker is dismissed.
    input.addEventListener('cancel', () => done(null));
    document.body.appendChild(input);
    input.click();
  });
}

export const canPickFiles = Platform.OS === 'web';

/** Whether the browser promised to keep our storage (null = unknown / not a browser). */
export async function isStoragePersistent(): Promise<boolean | null> {
  if (Platform.OS !== 'web') return true; // Native app storage isn't evicted.
  try {
    if (!navigator.storage?.persisted) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/** True when running as an installed home-screen app rather than in a browser tab. */
export function isInstalledApp(): boolean {
  if (Platform.OS !== 'web') return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return !!nav.standalone || window.matchMedia?.('(display-mode: standalone)').matches;
}

export function backupFilename(ext: 'json' | 'txt'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `daylog-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.${ext}`;
}
