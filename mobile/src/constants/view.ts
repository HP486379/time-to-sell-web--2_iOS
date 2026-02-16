export type ViewKey = 'short' | 'mid' | 'long'

export const VIEW_LABELS: Record<ViewKey, string> = {
  short: '短期',
  mid: '中期',
  long: '長期',
}

export const VIEW_DAYS: Record<ViewKey, number> = {
  short: 30,
  mid: 183,
  long: 365,
}
