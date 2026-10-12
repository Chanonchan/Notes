import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

export async function copyText(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

/**
 * Opens the system share sheet. Browsers without the Web Share API fall back
 * to copying; returns 'copied' in that case so the UI can say so.
 */
export async function shareText(text: string, title: string): Promise<'shared' | 'copied' | 'dismissed'> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title, text });
        return 'shared';
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return 'dismissed';
      }
    }
    await copyText(text);
    return 'copied';
  }
  const res = await Share.share({ message: text, title });
  return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
}
