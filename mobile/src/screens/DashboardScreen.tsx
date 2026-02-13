import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { Picker } from '@react-native-picker/picker'

import { API_BASE, evaluateIndex } from '../../../shared/api'
import { INDEX_LABELS, type IndexType } from '../../../shared/types'
import type { EvaluateRequest, EvaluateResponse } from '../../../shared/types/evaluate'

import { PriceTrendChart } from '../components/PriceTrendChart'
import { VIEW_LABELS, type ViewKey } from '../constants/view'

type EvalStatus = 'loading' | 'ready' | 'degraded' | 'error'

const defaultRequest: EvaluateRequest = {
  total_quantity: 77384,
  avg_cost: 21458,
  index_type: 'SP500',
  score_ma: 200,
}

const tabOrder: ViewKey[] = ['short', 'mid', 'long']

type DisplayMode = 'easy' | 'pro'

export function DashboardScreen() {
  const systemScheme = useColorScheme()
  const [darkOverride, setDarkOverride] = useState<boolean | null>(null)
  const darkMode = darkOverride ?? (systemScheme === 'dark')

  const [displayMode, setDisplayMode] = useState<DisplayMode>('easy')
  const [viewKey, setViewKey] = useState<ViewKey>('long')
  const [indexType, setIndexType] = useState<IndexType>('SP500')

  const [status, setStatus] = useState<EvalStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<EvaluateResponse | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const colors = useMemo(() => {
    return {
      pageBg: darkMode ? '#0B1220' : '#EEF2F7',
      panelBg: darkMode ? '#0F172A' : '#F5F7FB',
      cardBg: darkMode ? '#0B1220' : '#FFFFFF',
      border: darkMode ? '#23324A' : '#D7DEE8',
      text: darkMode ? '#E5E7EB' : '#0F172A',
      sub: darkMode ? '#AAB4C5' : '#4B5563',
      muted: darkMode ? '#91A0B8' : '#6B7280',
      blue: '#2F6BFF',
      blueSoft: darkMode ? '#1E3A8A' : '#DCE8FF',
      tabBg: darkMode ? '#0B1220' : '#FFFFFF',
      tabBorder: darkMode ? '#23324A' : '#D7DEE8',
      warningBg: darkMode ? '#0B1220' : '#FFFFFF',
    }
  }, [darkMode])

  const fetchEvaluate = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const next = await evaluateIndex({
        ...defaultRequest,
        index_type: indexType,
      })
      setResponse(next)
      setStatus(next.status === 'ready' ? 'ready' : next.status === 'degraded' ? 'degraded' : 'error')
      setLastUpdatedAt(new Date())
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'データ取得に失敗しました')
      setLastUpdatedAt(new Date())
    }
  }, [indexType])

  useEffect(() => {
    fetchEvaluate()
  }, [fetchEvaluate])

  const periodBreakdown = response?.period_breakdowns?.[viewKey]
  const periodScore = response?.period_scores?.[viewKey]

  const periodDescription =
    viewKey === 'short'
      ? '短期（1ヶ月）目線の売却タイミング評価'
      : viewKey === 'mid'
        ? '中期（6ヶ月）目線の売却タイミング評価'
        : '長期（1年）目線の売却タイミング評価'

  const lastUpdatedText = useMemo(() => {
    if (!lastUpdatedAt) return '--:--'
    const hh = String(lastUpdatedAt.getHours()).padStart(2, '0')
    const mm = String(lastUpdatedAt.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }, [lastUpdatedAt])

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.pageBg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={fetchEvaluate} />}
    >
      {/* ===== Web版ヘッダー領域（再現） ===== */}
      <View style={[styles.hero, { backgroundColor: colors.panelBg, borderColor: colors.border }]}>
        <Text style={[styles.heroTitle, { color: colors.blue }]}>売り時くん</Text>
        <Text style={[styles.heroSub, { color: colors.sub }]}>テクニカル・マクロ・イベントの三軸で売り時スコアを可視化</Text>

        {/* “メイン画面 / バックテスト画面” タブ（見た目再現） */}
        <View style={[styles.topTabsWrap, { borderColor: colors.tabBorder, backgroundColor: colors.tabBg }]}>
          <Pressable style={[styles.topTab, styles.topTabActive, { borderColor: colors.tabBorder }]}>
            <Text style={[styles.topTabText, { color: colors.text }]}>メイン画面</Text>
          </Pressable>
          <Pressable style={[styles.topTab, { borderColor: colors.tabBorder }]}>
            <Text style={[styles.topTabText, { color: colors.muted }]}>バックテスト画面</Text>
          </Pressable>
        </View>

        {/* 表示モード + テーマ（見た目再現） */}
        <View style={styles.rowBetween}>
          <View style={styles.modeRow}>
            <Text style={[styles.modeLabel, { color: colors.sub }]}>表示モード</Text>
            <View style={[styles.modeSegWrap, { borderColor: colors.tabBorder, backgroundColor: colors.tabBg }]}>
              <Pressable
                onPress={() => setDisplayMode('easy')}
                style={[
                  styles.modeSeg,
                  displayMode === 'easy' && { backgroundColor: colors.blueSoft, borderColor: colors.blue },
                ]}
              >
                <Text style={{ color: displayMode === 'easy' ? colors.text : colors.muted, fontWeight: '700' }}>
                  かんたん
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDisplayMode('pro')}
                style={[
                  styles.modeSeg,
                  displayMode === 'pro' && { backgroundColor: colors.blueSoft, borderColor: colors.blue },
                ]}
              >
                <Text style={{ color: displayMode === 'pro' ? colors.text : colors.muted, fontWeight: '700' }}>
                  プロ向け
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.themeRow}>
            <Text style={{ color: colors.muted, fontSize: 18 }}>☀️</Text>
            <Switch
              value={darkMode}
              onValueChange={(v) => setDarkOverride(v)}
              thumbColor={darkMode ? '#111827' : '#FFFFFF'}
            />
            <Text style={{ color: colors.muted, fontSize: 18 }}>🌙</Text>
          </View>
        </View>

        {/* 注意書き（Web版っぽく） */}
        <View style={[styles.notice, { backgroundColor: colors.warningBg, borderColor: colors.border }]}>
          <Text style={[styles.noticeText, { color: colors.sub }]}>
            ⚠️ 本サービスは投資助言ではありません。表示されるスコアは参考情報であり、最終的な投資判断はご自身の責任で行ってください。
          </Text>
          <Text style={[styles.noticeText, { color: colors.sub, marginTop: 6 }]}>
            ※ ページ更新や条件切り替え時、最新データの取得・計算のため表示が反映されるまで数秒かかる場合があります。
          </Text>
        </View>
      </View>

      {/* ===== 対象インデックス（Web版の青枠っぽく） ===== */}
      <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.sub }]}>対象インデックス</Text>

        <View style={[styles.pickerFrame, { borderColor: colors.blue, backgroundColor: colors.cardBg }]}>
          <Picker selectedValue={indexType} onValueChange={(v) => setIndexType(v as IndexType)}>
            {Object.entries(INDEX_LABELS).map(([value, label]) => (
              <Picker.Item key={value} label={label} value={value} />
            ))}
          </Picker>
        </View>

        <View style={styles.updateRow}>
          <Text style={[styles.updatedAt, { color: colors.sub }]}>最終更新: {lastUpdatedText}</Text>
          <Pressable onPress={fetchEvaluate} style={[styles.refreshBtn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 16 }}>↻</Text>
          </Pressable>
        </View>

        {/* “ちっさく出てた” API 表示：さらに目立たせない */}
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>API: {API_BASE}</Text>
      </View>

      {/* ===== 以降：中身は現状ロジックを維持（カード見た目だけWeb寄せ） ===== */}
      <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Text style={[styles.h2, { color: colors.text }]}>総合スコア部（統合判断）</Text>
        <Text style={[styles.bigScore, { color: colors.text }]}>{response?.scores.total?.toFixed(1) ?? '--'}</Text>
        <Text style={{ color: colors.sub, marginTop: 4 }}>ラベル: {response?.scores.label ?? '計算待ち'}</Text>
        <Text style={[styles.noteSmall, { color: colors.sub }]}>
          総合スコアは常に scores.total を表示し、期間タブに影響されません。
        </Text>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Text style={[styles.h2, { color: colors.text }]}>時間軸カード（参考）</Text>

        <View style={styles.tabs}>
          {tabOrder.map((key) => {
            const active = viewKey === key
            return (
              <Pressable
                key={key}
                style={[
                  styles.tabPill,
                  { backgroundColor: active ? colors.blue : (darkMode ? '#1F2937' : '#E7ECF3') },
                ]}
                onPress={() => setViewKey(key)}
              >
                <Text style={{ color: active ? '#FFFFFF' : colors.sub, fontWeight: '700' }}>{VIEW_LABELS[key]}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={{ color: colors.text, marginBottom: 6, fontWeight: '800' }}>
          期間スコア: {periodScore?.toFixed(1) ?? '--'}
        </Text>
        <Text style={{ color: colors.sub, marginBottom: 10 }}>{periodDescription}</Text>

        {displayMode === 'pro' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '800', marginTop: 6 }}>内訳</Text>
            <Text style={{ color: colors.sub }}>Technical: {periodBreakdown?.scores.technical?.toFixed(1) ?? '--'}</Text>
            <Text style={{ color: colors.sub }}>Macro: {periodBreakdown?.scores.macro?.toFixed(1) ?? '--'}</Text>
            <Text style={{ color: colors.sub }}>
              Event adj: {periodBreakdown?.scores.event_adjustment?.toFixed(1) ?? '--'}
            </Text>

            <Text style={{ color: colors.text, fontWeight: '800', marginTop: 10 }}>指標</Text>
            <Text style={{ color: colors.sub }}>d: {periodBreakdown?.technical_details.d?.toFixed(2) ?? '--'}</Text>
            <Text style={{ color: colors.sub }}>
              T_base: {periodBreakdown?.technical_details.T_base?.toFixed(2) ?? '--'}
            </Text>
            <Text style={{ color: colors.sub }}>
              T_trend: {periodBreakdown?.technical_details.T_trend?.toFixed(2) ?? '--'}
            </Text>
            <Text style={{ color: colors.sub }}>
              macro_M:{' '}
              {(periodBreakdown?.macro_details.macro_M ?? periodBreakdown?.macro_details.M)?.toFixed(2) ?? '--'}
            </Text>
          </>
        )}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Text style={[styles.h2, { color: colors.text }]}>価格 + MA20/MA60/MA200 チャート</Text>
        {response?.price_series?.length ? (
          <PriceTrendChart points={response.price_series} viewKey={viewKey} darkMode={darkMode} />
        ) : (
          <Text style={{ color: colors.sub }}>価格データがありません。</Text>
        )}
      </View>

      {status === 'loading' && (
        <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <ActivityIndicator />
          <Text style={{ color: colors.sub, marginTop: 8 }}>データ取得中...</Text>
        </View>
      )}

      {(status === 'degraded' || status === 'error') && (
        <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={{ color: '#EF4444', fontWeight: '900' }}>{status === 'degraded' ? 'degraded' : 'error'}</Text>
          <Text style={{ color: colors.sub, marginTop: 6 }}>
            {error ?? response?.reasons?.join(' / ') ?? 'エラーが発生しました。'}
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14 },

  hero: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroTitle: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroSub: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '600',
  },

  topTabsWrap: {
    marginTop: 14,
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  topTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  topTabActive: {},
  topTabText: { fontSize: 15, fontWeight: '800' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeLabel: { fontSize: 14, fontWeight: '700' },
  modeSegWrap: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  modeSeg: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  notice: {
    marginTop: 14,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noticeText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },

  sectionCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: { fontSize: 14, fontWeight: '800', marginBottom: 8 },

  pickerFrame: {
    borderWidth: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  updateRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  updatedAt: { fontSize: 14, fontWeight: '700' },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },

  h2: { fontSize: 20, fontWeight: '900', marginBottom: 10 },
  bigScore: { fontSize: 44, fontWeight: '950' },
  noteSmall: { marginTop: 10, fontSize: 12, fontWeight: '700' },

  tabs: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tabPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
})
