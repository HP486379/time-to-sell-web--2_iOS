import React, { useState } from 'react'
import { Card, CardContent, CardHeader, Button, Typography, Stack } from '@mui/material'
import { runBacktest } from '../apis'
import type { BacktestResult } from '../types/apis'
import type { IndexType } from '../types/index'

const DEFAULT_REQUEST = {
  start_date: '2014-01-01',
  end_date: '2024-11-30',
  initial_cash: 1_000_000,
  sell_threshold: 80,
  buy_threshold: 40,
  index_type: 'SP500' as const,
  score_ma: 200,
}

const currencyFmt = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
})

const formatCurrency = (v: unknown) => {
  const num =
    typeof v === 'number'
      ? v
      : typeof v === 'string'
      ? Number(v)
      : NaN
  return Number.isFinite(num) ? currencyFmt.format(num) : '-'
}

const formatPct = (v: unknown) => {
  const num =
    typeof v === 'number'
      ? v
      : typeof v === 'string'
      ? Number(v)
      : NaN
  return Number.isFinite(num) ? `${num.toFixed(2)} %` : '-'
}

export const BacktestSummaryCard: React.FC<{ indexType: IndexType }> = ({ indexType }) => {
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await runBacktest({ ...DEFAULT_REQUEST, index_type: indexType })
      setResult(res)
    } catch (e: any) {
      console.error(e)
      setError(e.message ?? 'バックテストに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const summary = result?.summary && typeof result.summary === 'object' ? result.summary : result
  const finalAsset = summary?.final_asset ?? summary?.final_value
  const buyAndHoldAsset = summary?.buy_and_hold_asset ?? summary?.buy_and_hold_final
  const totalReturn = summary?.total_return ?? summary?.total_return_pct
  const maxDrawdown = summary?.max_drawdown ?? summary?.max_drawdown_pct

  return (
    <Card>
      <CardHeader
        title="バックテスト成績"
        subheader="期間: 2014-01-01 〜 2024-11-30 / 初期資金: ¥1,000,000"
        action={
          <Button variant="contained" size="small" onClick={handleRun} disabled={loading}>
            {loading ? '計算中...' : 'バックテスト実行'}
          </Button>
        }
      />
      <CardContent>
        {error && (
          <Typography color="error" sx={{ mb: 1 }}>
            {error}
          </Typography>
        )}

        {result ? (
          <Stack spacing={0.5}>
            <Typography variant="body2">
              最終資産: <strong>{formatCurrency(finalAsset)}</strong>
            </Typography>
            <Typography variant="body2">
              単純ホールド: <strong>{formatCurrency(buyAndHoldAsset)}</strong>
            </Typography>
            <Typography variant="body2">
              トータルリターン: <strong>{formatPct(totalReturn)}</strong>
            </Typography>
            <Typography variant="body2">
              最大ドローダウン: <strong>{formatPct(maxDrawdown)}</strong>
            </Typography>
            <Typography variant="body2">
              売買回数:{' '}
              <strong>{typeof summary?.trade_count === 'number' ? `${summary.trade_count} 回` : '-'}</strong>
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            「バックテスト実行」を押すと、この売り時ルールで過去10年の成績を表示します。
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export default BacktestSummaryCard
