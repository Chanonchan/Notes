import { Alert, Platform } from 'react-native';

/** Alert.alert with buttons is a no-op on web; fall back to the browser dialogs. */
export function confirmDestructive(title: string, message: string, actionLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: actionLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

export function showError(title: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
