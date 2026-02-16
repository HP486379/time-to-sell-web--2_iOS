import { useMemo } from 'react'
import { Dimensions, View } from 'react-native'
import { LineChart } from 'react-native-chart-kit'

import type { PricePoint } from '../../../shared/types/evaluate'

import type { ViewKey } from '../constants/view'
import { VIEW_DAYS } from '../constants/view'

type Props = {
  points: PricePoint[]
  viewKey: ViewKey
  darkMode: boolean
}

export function PriceTrendChart({ points, viewKey, darkMode }: Props) {
  const width = Dimensions.get('window').width - 40

  const filtered = useMemo(() => {
    if (points.length === 0) return []
    const count = VIEW_DAYS[viewKey]
    return points.slice(Math.max(0, points.length - count))
  }, [points, viewKey])

  const step = Math.max(1, Math.floor(filtered.length / 4))
  const labels = filtered.map((p, i) => (i % step === 0 ? p.date.slice(5) : ''))

  const data = {
    labels,
    datasets: [
      {
        data: filtered.map((p) => p.close),
        color: () => '#3B82F6',
        strokeWidth: 2,
      },
      {
        data: filtered.map((p) => p.ma20 ?? p.close),
        color: () => '#10B981',
        strokeWidth: 1,
      },
      {
        data: filtered.map((p) => p.ma60 ?? p.close),
        color: () => '#F59E0B',
        strokeWidth: 1,
      },
      {
        data: filtered.map((p) => p.ma200 ?? p.close),
        color: () => '#EF4444',
        strokeWidth: 1,
      },
    ],
    legend: ['Price', 'MA20', 'MA60', 'MA200'],
  }

  return (
    <View>
      <LineChart
        data={data}
        width={width}
        height={220}
        yAxisLabel=""
        chartConfig={{
          backgroundGradientFrom: darkMode ? '#111827' : '#FFFFFF',
          backgroundGradientTo: darkMode ? '#111827' : '#FFFFFF',
          decimalPlaces: 0,
          color: (opacity = 1) => (darkMode ? `rgba(229,231,235,${opacity})` : `rgba(31,41,55,${opacity})`),
          labelColor: (opacity = 1) =>
            darkMode ? `rgba(209,213,219,${opacity})` : `rgba(55,65,81,${opacity})`,
          propsForDots: { r: '0' },
          propsForBackgroundLines: {
            stroke: darkMode ? '#1F2937' : '#E5E7EB',
          },
        }}
        bezier
        withInnerLines
        withVerticalLabels
        withHorizontalLabels
        style={{ borderRadius: 12 }}
      />
    </View>
  )
}
