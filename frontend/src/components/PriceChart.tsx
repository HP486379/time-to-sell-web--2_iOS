import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { Tooltip as MuiTooltip } from '@mui/material'
import type { PricePoint } from '../../../shared/types/evaluate'
import type { TooltipTexts } from '../tooltipTexts'
import { useAppLanguage } from '../i18n'

type LegendLabels = {
  close?: string
  closeUsd?: string
  ma20?: string
  ma60?: string
  ma200?: string
}

type Props = {
  priceSeries: Array<PricePoint & { closeUsd?: number }>
  simple?: boolean
  tooltips: TooltipTexts
  legendLabels?: LegendLabels
}

const chartText = {
  ja: {
    date: '日付',
    close: '終値',
    closeUsd: 'ドル建て（終値）',
  },
  en: {
    date: 'Date',
    close: 'Close',
    closeUsd: 'USD-based close',
  },
} as const

function PriceChart({ priceSeries, simple = false, tooltips, legendLabels }: Props) {
  const language = useAppLanguage()
  const text = chartText[language]

  if (!priceSeries.length) {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={[]}></LineChart>
      </ResponsiveContainer>
    )
  }

  const hasCloseUsd = priceSeries.some((p) => p.closeUsd !== undefined)
  const closeLabel = legendLabels?.close ?? text.close
  const closeUsdLabel = legendLabels?.closeUsd ?? text.closeUsd

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={priceSeries} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          tickFormatter={(d) => (typeof d === 'string' ? d.slice(5) : d)}
          minTickGap={20}
        />
        <YAxis tick={{ fill: '#9ca3af' }} domain={['auto', 'auto']} />
        <RechartsTooltip contentStyle={{ background: '#0b1224', border: '1px solid #334155' }} labelFormatter={(l) => `${text.date}: ${l}`} />
        {!simple && (
          <Legend
            formatter={(value) => {
              const map: Record<string, string> = {
                [closeLabel]: legendLabels?.close ?? tooltips.chart.close,
                [closeUsdLabel]: legendLabels?.closeUsd ?? closeUsdLabel,
                MA20: legendLabels?.ma20 ?? tooltips.chart.ma20,
                MA60: legendLabels?.ma60 ?? tooltips.chart.ma60,
                MA200: legendLabels?.ma200 ?? tooltips.chart.ma200,
              }
              return (
                <MuiTooltip title={map[String(value)] ?? ''} arrow>
                  <span>{String(value)}</span>
                </MuiTooltip>
              )
            }}
          />
        )}
        <Line type="monotone" dataKey="close" stroke="#7dd3fc" strokeWidth={2} dot={false} name={closeLabel} />
        {hasCloseUsd && (
          <Line
            type="monotone"
            dataKey="closeUsd"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            name={closeUsdLabel}
          />
        )}
        <Line type="monotone" dataKey="ma20" stroke="#a78bfa" strokeWidth={2} dot={false} name="MA20" />
        <Line type="monotone" dataKey="ma60" stroke="#34d399" strokeWidth={2} dot={false} name="MA60" />
        <Line type="monotone" dataKey="ma200" stroke="#f59e0b" strokeWidth={2} dot={false} name="MA200" />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default PriceChart
