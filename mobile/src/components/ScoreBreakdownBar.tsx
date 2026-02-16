import { StyleSheet, Text, View } from 'react-native'

type Props = {
  label: string
  value?: number
  darkMode: boolean
  color: string
}

export function ScoreBreakdownBar({ label, value, darkMode, color }: Props) {
  const safe = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 0

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.label, darkMode ? styles.textDark : styles.textLight]}>{label}</Text>
        <Text style={[styles.value, darkMode ? styles.textDark : styles.textLight]}>
          {typeof value === 'number' ? value.toFixed(1) : '--'}
        </Text>
      </View>
      <View style={[styles.track, darkMode ? styles.trackDark : styles.trackLight]}>
        <View style={[styles.fill, { width: `${safe}%`, backgroundColor: color }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 12 },
  value: { fontSize: 12, fontWeight: '700' },
  textDark: { color: '#D1D5DB' },
  textLight: { color: '#374151' },
  track: { height: 8, borderRadius: 6, overflow: 'hidden' },
  trackDark: { backgroundColor: '#374151' },
  trackLight: { backgroundColor: '#E5E7EB' },
  fill: { height: '100%', borderRadius: 6 },
})
