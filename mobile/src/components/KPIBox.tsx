import { StyleSheet, Text, View } from 'react-native'

type Props = {
  label: string
  value: string
  darkMode: boolean
}

export function KPIBox({ label, value, darkMode }: Props) {
  return (
    <View style={[styles.box, darkMode ? styles.dark : styles.light]}>
      <Text style={[styles.label, darkMode ? styles.labelDark : styles.labelLight]}>{label}</Text>
      <Text style={[styles.value, darkMode ? styles.valueDark : styles.valueLight]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flex: 1, borderRadius: 10, padding: 10, borderWidth: StyleSheet.hairlineWidth },
  dark: { backgroundColor: '#0F172A', borderColor: '#334155' },
  light: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  label: { fontSize: 12, marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '700' },
  labelDark: { color: '#9CA3AF' },
  labelLight: { color: '#6B7280' },
  valueDark: { color: '#F3F4F6' },
  valueLight: { color: '#111827' },
})
