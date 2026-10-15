import { Ionicons } from '@expo/vector-icons';
import { Children, Fragment, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** `#RRGGBB` + alpha → `#RRGGBBAA`, for tinted icon tiles. */
export const tint = (hex: string, alpha = 0.16) =>
  /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : hex;

/** Big page title with an optional control on the right. */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
        {subtitle ? <Text style={{ color: t.muted, fontSize: 15, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Small uppercase label above a group, with optional text on the right. */
export function GroupLabel({
  children,
  right,
  dot,
  action,
}: {
  children: ReactNode;
  right?: ReactNode;
  dot?: string;
  /** Small text button on the right, e.g. "+ Add". */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
}) {
  const t = useTheme();
  return (
    <View style={styles.labelRow}>
      {dot ? <View style={[styles.labelDot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.label, { color: t.muted }]} numberOfLines={1}>
        {children}
      </Text>
      {right ? <Text style={[styles.labelRight, { color: t.muted }]}>{right}</Text> : null}
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={action.accessibilityLabel ?? action.label}>
          <Text style={[styles.labelAction, { color: t.primary }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Rounded card holding rows, with hairline dividers between them. */
export function ListGroup({ children, style, inset = 62 }: { children: ReactNode; style?: StyleProp<ViewStyle>; inset?: number }) {
  const t = useTheme();
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.group, { backgroundColor: t.card, borderColor: t.border }, style]}>
      {items.map((child, i) => (
        <Fragment key={child.key ?? i}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: t.border, marginLeft: inset }]} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

/** Square icon tile at the start of a row. */
export function IconTile({ icon, color, bg, onPress, label }: { icon: IconName; color: string; bg?: string; onPress?: () => void; label?: string }) {
  const t = useTheme();
  const tile = (
    <View style={[styles.tile, { backgroundColor: bg ?? t.chip }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
  );
  if (!onPress) return tile;
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
      {tile}
    </Pressable>
  );
}

export function ListRow({
  icon,
  iconColor,
  iconBg,
  leading,
  title,
  titleLines,
  subtitle,
  below,
  value,
  right,
  onPress,
  onLongPress,
  chevron,
  destructive,
  accessibilityLabel,
  accessibilityHint,
}: {
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  /** Custom leading element instead of an icon tile. */
  leading?: ReactNode;
  title: string;
  /** Max title lines; unlimited by default so entry text is never cut. */
  titleLines?: number;
  subtitle?: string;
  /** Extra content under the subtitle (e.g. a progress bar). */
  below?: ReactNode;
  /** Short muted text on the right (e.g. the current setting). */
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Defaults to shown when the row is tappable. */
  chevron?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const showChevron = chevron ?? !!onPress;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.chip : 'transparent' }]}
    >
      {leading ?? (icon ? <IconTile icon={icon} color={iconColor ?? (destructive ? t.danger : t.primary)} bg={iconBg} /> : null)}
      <View style={styles.body}>
        <Text style={[styles.rowTitle, { color: destructive ? t.danger : t.text }]} numberOfLines={titleLines}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: t.muted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {below}
      </View>
      {value ? (
        <Text style={[styles.value, { color: t.muted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {showChevron ? <Ionicons name="chevron-forward" size={20} color={t.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 8, paddingHorizontal: 4 },
  labelDot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
  labelRight: { fontSize: 14 },
  labelAction: { fontSize: 15, fontWeight: '700' },
  group: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 },
  tile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  rowSub: { fontSize: 13, lineHeight: 18 },
  value: { fontSize: 15, maxWidth: 140 },
});
