import React, { useMemo } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Tooltip,
  Box,
  Divider,
  Skeleton,
  Alert,
} from '@mui/material'
import dayjs from 'dayjs'
import 'dayjs/locale/ja'
import type { EventItem } from '../apis'

// tooltips の厳密な型は知らないので any にしておく
type EventTooltips = any

type Props = {
  // スコア計算側の event_details（E_adj など）※あれば使う
  eventDetails?: any
  // /api/events から取得したイベント一覧
  events?: EventItem[]
  // ローディング・エラー状態
  isLoading?: boolean
  error?: string | null
  // ツールチップ文言
  tooltips?: EventTooltips
}

dayjs.locale('ja')

const EventList: React.FC<Props> = ({ eventDetails, events, isLoading, error, tooltips }) => {
  const title = tooltips?.events?.title ?? '重要イベント'

  const mergedEvents = useMemo(() => {
    if (!events || events.length === 0) return []

    const manual = events.filter((e) => e.source === 'manual')
    const heuristic = events.filter((e) => e.source !== 'manual')

    // 同じ name & date が manual にあるものは heuristic を捨てる
    const isDuplicated = (h: EventItem) =>
      manual.some((m) => m.name === h.name && m.date === h.date)

    const cleanedHeuristic = heuristic.filter((h) => !isDuplicated(h))

    const merged = [...manual, ...cleanedHeuristic]

    // 日付昇順、同じ日なら importance 降順、最後に manual を優先
    return merged.sort((a, b) => {
      const da = dayjs(a.date)
      const db = dayjs(b.date)
      if (da.isBefore(db)) return -1
      if (da.isAfter(db)) return 1
      if (a.importance !== b.importance) return b.importance - a.importance
      if (a.source === b.source) return 0
      return a.source === 'manual' ? -1 : 1
    })
  }, [events])

  const today = dayjs().startOf('day')

  const firstUpcomingIndex = useMemo(() => {
    if (!mergedEvents.length) return -1
    return mergedEvents.findIndex((e) => {
      const d = dayjs(e.date)
      return d.isSame(today, 'day') || d.isAfter(today, 'day')
    })
  }, [mergedEvents, today])

  const eventAdjust = eventDetails?.E_adj ?? null

  const formatDateJp = (d: string) => {
    const t = dayjs(d)
    if (!t.isValid()) return d
    return t.format('YYYY/MM/DD (ddd)')
  }

  const getImportanceChip = (imp: number) => {
    if (imp >= 5) {
      return <Chip size="small" color="error" label="★★★ 超重要" />
    }
    if (imp >= 4) {
      return <Chip size="small" color="warning" label="★★ 重要" />
    }
    if (imp >= 3) {
      return <Chip size="small" color="info" label="★ 注目" />
    }
    return <Chip size="small" variant="outlined" label="参考" />
  }

  const getSourceChip = (source: string) => {
    if (source === 'manual') {
      return (
        <Chip
          size="small"
          color="primary"
          variant="filled"
          label="手動"
        />
      )
    }
    return (
      <Chip
        size="small"
        variant="outlined"
        label="推定"
      />
    )
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Tooltip title={title} arrow>
            <Typography variant="h6" component="div">
              重要イベント
            </Typography>
          </Tooltip>
          {eventAdjust !== null && (
            <Chip
              size="small"
              label={`イベント補正: ${eventAdjust.toFixed(1)} pt`}
              color={eventAdjust <= -3 ? 'error' : eventAdjust >= 3 ? 'success' : 'default'}
            />
          )}
        </Stack>

        {isLoading && (
          <Stack spacing={1.2} mt={1}>
            <Skeleton variant="text" height={24} />
            <Skeleton variant="text" height={24} />
            <Skeleton variant="text" height={24} />
          </Stack>
        )}

        {!isLoading && error && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            イベント情報の取得に失敗しました：{error}
          </Alert>
        )}

        {!isLoading && !error && mergedEvents.length === 0 && (
          <Typography variant="body2" color="text.secondary" mt={1}>
            現在、対象期間（直近1週間〜30日先）に登録されたイベントはありません。
          </Typography>
        )}

        {!isLoading && !error && mergedEvents.length > 0 && (
          <>
            <Stack spacing={1.0} mt={0.5}>
              {mergedEvents.map((ev, index) => {
                const isUpcoming = index === firstUpcomingIndex
                const isPast = dayjs(ev.date).isBefore(today, 'day')

                return (
                  <Box
                    key={`${ev.name}-${ev.date}-${ev.source}-${index}`}
                    sx={(theme) => ({
                      borderRadius: 1.5,
                      px: 1.2,
                      py: 0.8,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      bgcolor: isUpcoming
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(144, 202, 249, 0.12)'
                          : 'rgba(25, 118, 210, 0.06)'
                        : 'transparent',
                      opacity: isPast ? 0.65 : 1,
                    })}
                  >
                    <Box sx={{ minWidth: 110 }}>
                      <Typography variant="body2" sx={{ fontWeight: isUpcoming ? 600 : 400 }}>
                        {formatDateJp(ev.date)}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ fontWeight: isUpcoming ? 600 : 400 }}
                      >
                        {ev.name}
                      </Typography>
                      <Stack direction="row" spacing={0.8} mt={0.4} flexWrap="wrap">
                        {getImportanceChip(ev.importance)}
                        {getSourceChip(ev.source)}
                        {isUpcoming && (
                          <Chip
                            size="small"
                            color="secondary"
                            variant="outlined"
                            label="直近"
                          />
                        )}
                      </Stack>
                    </Box>
                  </Box>
                )
              })}
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="caption" color="text.secondary">
              「手動」はあなたが JSON に登録した正確な日付、「推定」はカレンダー規則から算出したおおよその日付です。
              手動登録されたイベントがある場合は、同じ日付・同じイベント名の推定イベントよりも優先して表示されています。
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default EventList
