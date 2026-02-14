import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

type Props = {
  children: ReactNode
  darkMode: boolean
}

export function Card({ children, darkMode }: Props) {
  return <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
})
