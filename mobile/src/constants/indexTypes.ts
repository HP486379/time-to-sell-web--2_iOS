export const FREE_INDEX_TYPES = ['SP500'] as const

export type FreeIndexType = (typeof FREE_INDEX_TYPES)[number]

export const DEFAULT_FREE_INDEX_TYPE: FreeIndexType = FREE_INDEX_TYPES[0]
