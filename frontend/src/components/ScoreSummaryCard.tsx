import {
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Stack,
  Box,
  alpha,
  useTheme,
  Tooltip,
  Divider,
  Button,
  Alert,
  Chip,
  Skeleton,
} from '@mui/material'
import type { TooltipTexts } from '../tooltipTexts'
import { getScoreZoneText } from '../utils/alertState'

type EvalStatus = 'loading' | 'ready' | 'degraded' | 'error' | 'refreshing'

interface ScoreSummaryCardProps {
  scores?: {
    technical: number
    macro: number
    event_adjustment: number
    total: number
    label: string
    period_total?: number
  }
  periodTotal?: number
  technical?: {
    d: number
    T_base: number
    T_trend: number
    T_conv_adj?: number
    convergence?: { side?: 'down_convergence' | 'up_convergence' | 'neutral' }
    multi_ma?: {
      dev10?: number | null
      dev50?: number | null
      dev200?: number | null
      level?: number
      label?: string
      text?: string
    }
  }
  macro?: { p_r: number; p_cpi: number; p_vix: number; M: number }
  highlights?: { icon: string; text: string }[]
  zoneText?: string
  expanded?: boolean
  onShowDetails?: () => void
  viewLabel?: string
  viewTooltip?: string
  tooltips: TooltipTexts
  status?: EvalStatus
  statusMessage?: string
  onRetry?: () => void
  isRetrying?: boolean
}

function ScoreSummaryCard({
  scores,
  technical,
  macro,
  highlights = [],
  zoneText,
  expanded,
  onShowDetails,
  viewLabel = '短期目線',
  viewTooltip,
  tooltips,
  status = 'ready',
  statusMessage,
  onRetry,
  isRetrying = false,
  periodTotal,
}: ScoreSummaryCardProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const gradientStart = isDark ? '#101726' : alpha(theme.palette.primary.light, 0.2)
  const gradientEnd = isDark ? '#0c1b34' : alpha(theme.palette.secondary.light, 0.16)
  const showConfirmed = status === 'ready' || status === 'refreshing'
  const totalScore = scores?.total
  const zoneTextValue = zoneText ?? getScoreZoneText(showConfirmed ? totalScore : undefined)
  const showHighlights = highlights.length > 0
  const showDetailsToggle = Boolean(onShowDetails) && expanded !== undefined
  const periodScore = periodTotal
  const convergenceSide = technical?.convergence?.side
  const convergenceAdj = technical?.T_conv_adj ?? 0
  const showConvergenceBadge =
    convergenceSide !== undefined &&
    convergenceSide !== 'neutral' &&
    Math.abs(convergenceAdj) >= 0.5
  const convergenceLabel =
    convergenceSide === 'down_convergence' ? '🔸 天井圏・調整兆し' : '🔹 底打ち・反発兆し'
  const convergenceTooltip =
    convergenceSide === 'down_convergence'
      ? '上昇の勢いが弱まり、価格が長期平均（200日線）に近づく動きが出始めています。\n※この兆しはスコアに反映されています。'
      : '下落の勢いが弱まり、価格が長期平均（200日線）に近づく動きが出始めています。\n※この兆しはスコアに反映されています。'
  const multiMa = technical?.multi_ma
  const multiMaLevel = multiMa?.level ?? 0
  const showMultiMaBadge = showConfirmed && multiMaLevel >= 1

  return (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`,
        border: isDark ? '1px solid rgba(255,255,255,0.04)' : `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          {status === 'degraded' && (
            <Alert
              severity="warning"
              action={
                onRetry ? (
                  <Button color="inherit" size="small" onClick={onRetry}>
                    再取得
                  </Button>
                ) : undefined
              }
            >
              <Typography variant="subtitle2" component="div">
                ⚠ 一部データ取得中
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {statusMessage ?? '価格履歴の取得が未完了のため、現在のスコアは参考値です。'}
              </Typography>
              {isRetrying && (
                <Typography variant="caption" color="text.secondary">
                  再試行中…
                </Typography>
              )}
            </Alert>
          )}
          {status === 'error' && (
            <Alert
              severity="error"
              action={
                onRetry ? (
                  <Button color="inherit" size="small" onClick={onRetry}>
                    再取得
                  </Button>
                ) : undefined
              }
            >
              <Typography variant="subtitle2" component="div">
                ❌ データ取得に失敗しました
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {statusMessage ?? '時間をおいて再取得してください。'}
              </Typography>
            </Alert>
          )}
          <Tooltip title={tooltips.score.total} arrow>
            <Typography variant="overline" color="text.secondary" component="div">
              総合スコア
            </Typography>
          </Tooltip>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            {status === 'loading' ? (
              <Skeleton variant="text" width={120} height={44} />
            ) : (
              <Typography variant="h3" color="primary.main" fontWeight={700}>
                {showConfirmed && totalScore !== undefined ? totalScore.toFixed(1) : '--'}
              </Typography>
            )}
            {showMultiMaBadge && (
              <Tooltip title={multiMa?.text ?? ''} arrow>
                <Chip
                  size="small"
                  variant="outlined"
                  label={multiMa?.label ?? ''}
                  sx={{ fontSize: '0.7rem' }}
                />
              </Tooltip>
            )}
            {showConvergenceBadge && (
              <Box
                title={convergenceTooltip}
                sx={(theme) => ({
                  px: 1,
                  py: 0.25,
                  borderRadius: 999,
                  fontSize: '0.7rem',
                  lineHeight: 1.2,
                  border: `1px solid ${alpha(theme.palette.text.primary, 0.2)}`,
                  bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.04),
                  color: theme.palette.text.secondary,
                })}
              >
                {convergenceLabel}
              </Box>
            )}
            {status === 'refreshing' && <Chip size="small" color="info" label="更新中…" />}
          </Stack>
          <Typography variant="overline" color="text.secondary" component="div">
            出口接近度
          </Typography>
          <Tooltip title={tooltips.score.label} arrow>
            <Typography variant="subtitle1" color="text.secondary" component="div">
              {showConfirmed ? scores?.label ?? '計算待ち' : status === 'degraded' ? '未確定' : '計算中'}
            </Typography>
          </Tooltip>
          <Typography variant="body2" color="text.secondary">
            {status === 'loading' ? '⏳ 計算中…' : zoneTextValue}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Tooltip title={viewTooltip ?? ''} arrow>
              <Typography variant="overline" color="text.secondary" component="div">
                {viewLabel}での評価
              </Typography>
            </Tooltip>
            {status === 'loading' ? (
              <Skeleton variant="text" width={80} />
            ) : (
              <Typography variant="body1" color="text.primary">
                {showConfirmed && periodScore !== undefined ? periodScore.toFixed(1) : '--'}
              </Typography>
            )}
          </Stack>

          <Stack spacing={1}>
            <LabelBar
              label="テクニカル"
              tooltip={tooltips.score.technical}
              value={showConfirmed ? scores?.technical : undefined}
              color="primary"
            />
            <LabelBar
              label="マクロ"
              tooltip={tooltips.score.macro}
              value={showConfirmed ? scores?.macro : undefined}
              color="secondary"
            />
            <LabelBar
              label="イベント補正"
              tooltip={tooltips.score.event}
              value={showConfirmed ? scores?.event_adjustment : undefined}
              color="error"
            />
          </Stack>

          {showHighlights && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.background.default, 0.35),
                border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
              }}
            >
              <Tooltip title={tooltips.simple.points} arrow>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  今日のポイント
                </Typography>
              </Tooltip>
              <Stack spacing={1}>
                {highlights.map((highlight, idx) => (
                  <Stack direction="row" spacing={1} alignItems="flex-start" key={`${highlight.icon}-${idx}`}>
                    <Typography variant="body1" component="span" aria-hidden>
                      {highlight.icon}
                    </Typography>
                    <Typography variant="body2" component="span" color="text.secondary">
                      {highlight.text}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {technical && macro && (
            <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={1}>
              <DetailItem label="乖離率 d" tooltip={tooltips.score.d} value={`${technical.d}%`} />
              <DetailItem label="T_base" tooltip={tooltips.score.T_base} value={technical.T_base} />
              <DetailItem label="T_trend" tooltip={tooltips.score.T_trend} value={technical.T_trend} />
              <DetailItem label="マクロ M" tooltip={tooltips.score.macroM} value={macro.M} />
            </Box>
          )}
          {showDetailsToggle && (
            <>
              <Divider />
              <Button variant="outlined" color="inherit" onClick={onShowDetails} sx={{ alignSelf: 'flex-start' }}>
                {expanded ? '閉じる' : 'くわしく見る ≫'}
              </Button>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

function LabelBar({
  label,
  tooltip,
  value,
  color,
}: {
  label: string
  tooltip: string
  value?: number
  color: 'primary' | 'secondary' | 'error'
}) {
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={0.5}>
        <Tooltip title={tooltip} arrow>
          <Typography variant="body2" color="text.secondary" component="div">
            {label}
          </Typography>
        </Tooltip>
        <Typography variant="body2" color={`${color}.light`}>
          {value !== undefined ? value.toFixed(1) : '--'}
        </Typography>
      </Box>
      <LinearProgress variant="determinate" value={value ? Math.min(Math.max(value, 0), 100) : 0} color={color} />
    </Box>
  )
}

function DetailItem({ label, tooltip, value }: { label: string; tooltip: string; value: number | string }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  return (
    <Box
      bgcolor={
        isDark
          ? 'rgba(255,255,255,0.04)'
          : alpha(theme.palette.text.primary, 0.04)
      }
      p={1}
      borderRadius={1}
    >
      <Tooltip title={tooltip} arrow>
        <Typography variant="caption" color="text.secondary" component="div">
          {label}
        </Typography>
      </Tooltip>
      <Typography variant="body1">{value}</Typography>
    </Box>
  )
}

export default ScoreSummaryCard
