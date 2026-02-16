import { Pressable, StyleSheet, Text, View } from 'react-native'

type Option<T extends string> = { label: string; value: T }

type Props<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (next: T) => void
  darkMode: boolean
}

export function SegmentedControl<T extends string>({ options, value, onChange, darkMode }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <Pressable
            key={opt.value}
            style={[styles.tab, active ? styles.tabActive : darkMode ? styles.tabDark : styles.tabLight]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.text, active ? styles.textActive : darkMode ? styles.textDark : styles.textLight]}>
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  tabActive: { backgroundColor: '#2563EB' },
  tabDark: { backgroundColor: '#1F2937' },
  tabLight: { backgroundColor: '#E5E7EB' },
  text: { fontWeight: '600' },
  textActive: { color: '#FFFFFF' },
  textDark: { color: '#D1D5DB' },
  textLight: { color: '#4B5563' },
})
