import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { GroupLabel, ListGroup, ListRow, tint } from '../components/List';
import { Button } from '../components/ui';
import { useDb, useQuery } from '../hooks/useDb';
import { useTheme } from '../hooks/useTheme';
import { formatDayLong } from '../services/dates';
import { confirmDestructive, showError } from '../services/dialogs';
import { deleteAllData, exportJson, exportText, importBackup, parseBackup, storageStats, type Backup } from '../services/export';
import { backupFilename, canPickFiles, isInstalledApp, isStoragePersistent, pickTextFile, saveTextFile } from '../services/export/files';
import type { RootScreenProps } from '../types/navigation';

export function BackupScreen(_: RootScreenProps<'Backup'>) {
  const t = useTheme();
  const { db, notifyChanged } = useDb();
  const { data: stats } = useQuery((d) => storageStats(d));
  const { data: persistent } = useQuery(() => isStoragePersistent());
  // Prepared ahead of time: Safari only allows copy/share right after a tap,
  // so there must be no waiting between the tap and the clipboard/share call.
  const { data: json } = useQuery((d) => exportJson(d));
  const { data: plain } = useQuery((d) => exportText(d));
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const installed = isInstalledApp();

  const say = (text: string, ok = true) => setNotice({ text, ok });

  const copyBackup = async () => {
    try {
      await Clipboard.setStringAsync(json ?? (await exportJson(db)));
      say(
        installed
          ? 'Backup copied. Paste it into DayLog wherever you want the data (More → Backup & export → Paste backup).'
          : 'Backup copied. Now open DayLog from your home screen → More → Backup & export → Paste backup.',
      );
    } catch (e) {
      showError('Could not copy', e);
    }
  };

  const saveFile = async () => {
    try {
      const res = await saveTextFile(backupFilename('json'), json ?? (await exportJson(db)), 'application/json');
      if (res === 'downloaded') say('Backup file downloaded.');
      if (res === 'shared') say('Backup file saved.');
    } catch (e) {
      showError('Could not save the file', e);
    }
  };

  const shareText = async () => {
    try {
      await saveTextFile(backupFilename('txt'), plain ?? (await exportText(db)), 'text/plain');
    } catch (e) {
      showError('Could not export', e);
    }
  };

  /** Validates, asks for confirmation, then merges. */
  const restore = (raw: string) => {
    let backup: Backup;
    try {
      backup = parseBackup(raw);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e), false);
      return;
    }
    const when = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString() : 'unknown date';
    confirmDestructive(
      'Add this backup?',
      `${backup.entries.length} entries and ${backup.topics.length} topics (backup from ${when}). ` +
        'They are added to what is already here; nothing is deleted, and entries already here are skipped.',
      'Add',
      async () => {
        try {
          const r = await importBackup(db, backup);
          notifyChanged();
          setPasteOpen(false);
          setPasteText('');
          say(
            `Added ${r.entriesAdded} ${r.entriesAdded === 1 ? 'entry' : 'entries'}` +
              (r.topicsAdded ? ` and ${r.topicsAdded} ${r.topicsAdded === 1 ? 'topic' : 'topics'}` : '') +
              (r.entriesSkipped ? `. ${r.entriesSkipped} were already here.` : '.'),
          );
        } catch (e) {
          showError('Could not add the backup', e);
        }
      },
    );
  };

  const pasteBackup = async () => {
    // Try the clipboard first; fall back to a box to paste into by hand.
    let clip = '';
    try {
      clip = await Clipboard.getStringAsync();
    } catch {
      /* permission denied or unsupported */
    }
    if (clip.trim().startsWith('{') && clip.includes('daylog-backup')) restore(clip);
    else setPasteOpen(true);
  };

  const openFile = async () => {
    const text = await pickTextFile();
    if (text) restore(text);
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ListGroup>
        <ListRow
          icon={persistent === false ? 'warning' : 'shield-checkmark'}
          iconColor={persistent === false ? t.types.blocked : t.types.done}
          iconBg={tint(persistent === false ? t.types.blocked : t.types.done, t.dark ? 0.22 : 0.14)}
          title="Saved on this phone"
          subtitle={[
            stats ? `${stats.entries} ${stats.entries === 1 ? 'entry' : 'entries'} · ${stats.topics} ${stats.topics === 1 ? 'topic' : 'topics'}` : null,
            stats?.firstDay ? `since ${formatDayLong(stats.firstDay)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      </ListGroup>
      <Text style={[styles.foot, { color: t.muted }]}>
        {persistent === false
          ? 'Every change is saved right away. This browser may still clear website data when space runs low, so keep a backup.'
          : 'Every change is saved right away and kept for next time.'}
      </Text>

      {notice ? (
        <View style={[styles.notice, { backgroundColor: tint(notice.ok ? t.types.done : t.types.blocked, t.dark ? 0.25 : 0.12) }]}>
          <Text style={{ color: t.text, fontSize: 15, lineHeight: 21 }}>{notice.text}</Text>
        </View>
      ) : null}

      {Platform.OS === 'web' && !installed ? (
        <View style={[styles.help, { borderColor: t.border }]}>
          <Text style={[styles.helpTitle, { color: t.text }]}>Moving to the home-screen app?</Text>
          <Text style={[styles.helpText, { color: t.muted }]}>
            1. Here in Safari, tap <Text style={{ fontWeight: '700', color: t.text }}>Copy backup</Text>.{'\n'}
            2. Open DayLog from your home screen.{'\n'}
            3. Go to More → Backup & export → <Text style={{ fontWeight: '700', color: t.text }}>Paste backup</Text>.
          </Text>
        </View>
      ) : null}

      <GroupLabel>Back up or move your data</GroupLabel>
      <ListGroup>
        <ListRow icon="copy-outline" title="Copy backup" subtitle="Copies all your entries and topics" onPress={copyBackup} chevron={false} />
        <ListRow icon="download-outline" title="Save backup file" subtitle="To Files, AirDrop, email…" onPress={saveFile} chevron={false} />
      </ListGroup>

      <GroupLabel>Restore</GroupLabel>
      <ListGroup>
        <ListRow icon="clipboard-outline" title="Paste backup" subtitle="Adds entries from a copied backup" onPress={pasteBackup} chevron={false} />
        {canPickFiles ? (
          <ListRow icon="folder-open-outline" title="Open backup file" subtitle="Choose a daylog-….json file" onPress={openFile} chevron={false} />
        ) : null}
      </ListGroup>
      <Text style={[styles.foot, { color: t.muted }]}>Restoring only adds. Nothing already here is changed or deleted.</Text>

      <GroupLabel>Export</GroupLabel>
      <ListGroup>
        <ListRow icon="document-text-outline" title="Export as plain text" subtitle="A readable list of every entry, by day" onPress={shareText} chevron={false} />
      </ListGroup>

      <GroupLabel>Danger zone</GroupLabel>
      <ListGroup>
        <ListRow
          icon="trash-outline"
          iconBg={tint(t.danger, 0.12)}
          title="Delete all data"
          subtitle="Removes every entry and topic from this DayLog"
          destructive
          chevron={false}
          onPress={() =>
            confirmDestructive(
              'Delete all data?',
              `This permanently deletes ${stats?.entries ?? 0} entries and ${stats?.topics ?? 0} topics from this DayLog. ` +
                'Copy a backup first if you might want them back.',
              'Delete all',
              async () => {
                try {
                  await deleteAllData(db);
                  notifyChanged();
                  say('All data deleted. This DayLog is now empty.');
                } catch (e) {
                  showError('Could not delete', e);
                }
              },
            )
          }
        />
      </ListGroup>
      <Text style={[styles.foot, { color: t.muted }]}>
        Your data is never deleted on its own. It is only removed if you tap Delete all data, delete the app from your home screen, or clear
        website data in Settings.
      </Text>

      <Modal visible={pasteOpen} transparent animationType="slide" onRequestClose={() => setPasteOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPasteOpen(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: t.bg }]}>
          <Text style={[styles.sheetTitle, { color: t.text }]}>Paste backup</Text>
          <Text style={{ color: t.muted, marginBottom: 10 }}>Press and hold in the box, tap Paste, then tap Add.</Text>
          <TextInput
            value={pasteText}
            onChangeText={setPasteText}
            multiline
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            placeholder="Paste the backup here"
            placeholderTextColor={t.muted}
            style={[styles.pasteBox, { color: t.text, backgroundColor: t.card, borderColor: t.border }]}
            accessibilityLabel="Backup text"
          />
          <View style={styles.sheetActions}>
            <Button label="Cancel" kind="secondary" onPress={() => setPasteOpen(false)} style={{ flex: 1 }} />
            <Button label="Add" onPress={() => restore(pasteText)} disabled={!pasteText.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  notice: { borderRadius: 14, padding: 14, marginTop: 12 },
  help: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 14, marginTop: 12, gap: 6 },
  helpTitle: { fontSize: 16, fontWeight: '700' },
  helpText: { fontSize: 15, lineHeight: 23 },
  foot: { fontSize: 13, marginTop: 8, paddingHorizontal: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 32 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  pasteBox: { height: 160, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, textAlignVertical: 'top' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
