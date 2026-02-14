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
    <View style={{ flex: 1 }}>
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
      {/* ===== 以降：Web版に寄せた“見た目の中身” ===== */}
      <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Text style={[styles.h2, { color: colors.text }]}>総合スコア部（統合判断）</Text>

        <View style={styles.scoreRow}>
          <Text style={[styles.bigScore, { color: colors.text }]}>{response?.scores.total?.toFixed(1) ?? '--'}</Text>
        </View>

        <Text style={{ color: colors.sub, marginTop: 4 }}>ラベル: {response?.scores.label ?? '計算待ち'}</Text>
        <Text style={[styles.noteSmall, { color: colors.sub }]}>
          総合スコアは常に scores.total を表示し、期間タブに影響されません。
        </Text>
      </View>

      {/* ===== 時間軸カード（短期/中期/長期） ===== */}
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
                <Text style={{ color: active ? '#FFFFFF' : colors.sub, fontWeight: '800' }}>{VIEW_LABELS[key]}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Webの “長期目線の内訳” の箱っぽい表現 */}
        {displayMode === 'pro' && periodBreakdown?.scores && (
          <View style={[styles.breakdownWrap, { borderColor: colors.border, backgroundColor: darkMode ? '#0B1220' : '#F7F7F7' }]}>
            <Text style={[styles.breakdownTitle, { color: colors.text }]}>
              {viewKey === 'short' ? '短期目線の内訳' : viewKey === 'mid' ? '中期目線の内訳' : '長期目線の内訳'}
            </Text>

            <View style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.sub }]}>テクニカル</Text>
              <View style={[styles.barTrack, { backgroundColor: darkMode ? '#1F2937' : '#DDE7F5' }]}>
                <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, periodBreakdown.scores.technical ?? 0))}%`, backgroundColor: '#2F6BFF' }]} />
              </View>
              <Text style={[styles.barValue, { color: '#2F6BFF' }]}>{(periodBreakdown.scores.technical ?? 0).toFixed(1)}</Text>
            </View>

            <View style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.sub }]}>マクロ</Text>
              <View style={[styles.barTrack, { backgroundColor: darkMode ? '#1F2937' : '#E9D9FF' }]}>
                <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, periodBreakdown.scores.macro ?? 0))}%`, backgroundColor: '#7C3AED' }]} />
              </View>
              <Text style={[styles.barValue, { color: '#7C3AED' }]}>{(periodBreakdown.scores.macro ?? 0).toFixed(1)}</Text>
            </View>

            <View style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.sub }]}>イベント補正</Text>
              <View style={[styles.barTrack, { backgroundColor: darkMode ? '#1F2937' : '#FAD6D6' }]}>
                <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, periodBreakdown.scores.event_adjustment ?? 0))}%`, backgroundColor: '#EF4444' }]} />
              </View>
              <Text style={[styles.barValue, { color: '#EF4444' }]}>{(periodBreakdown.scores.event_adjustment ?? 0).toFixed(1)}</Text>
            </View>

            {/* KPI 2x2（Webの小箱） */}
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiBox, { backgroundColor: darkMode ? '#111827' : '#EEEEEE' }]}>
                <Text style={[styles.kpiLabel, { color: colors.sub }]}>乖離率 d</Text>
                <Text style={[styles.kpiValue, { color: colors.text }]}>{periodBreakdown?.technical_details?.d != null ? `${(periodBreakdown.technical_details.d * 100).toFixed(1)}%` : '--'}</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: darkMode ? '#111827' : '#EEEEEE' }]}>
                <Text style={[styles.kpiLabel, { color: colors.sub }]}>T_base</Text>
                <Text style={[styles.kpiValue, { color: colors.text }]}>{periodBreakdown?.technical_details?.T_base?.toFixed(2) ?? '--'}</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: darkMode ? '#111827' : '#EEEEEE' }]}>
                <Text style={[styles.kpiLabel, { color: colors.sub }]}>T_trend</Text>
                <Text style={[styles.kpiValue, { color: colors.text }]}>{periodBreakdown?.technical_details?.T_trend?.toFixed(2) ?? '--'}</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: darkMode ? '#111827' : '#EEEEEE' }]}>
                <Text style={[styles.kpiLabel, { color: colors.sub }]}>マクロ M</Text>
                <Text style={[styles.kpiValue, { color: colors.text }]}>
                  {(periodBreakdown?.macro_details?.macro_M ?? periodBreakdown?.macro_details?.M)?.toFixed(2) ?? '--'}
                </Text>
              </View>
            </View>
          </View>
        )}

        <Text style={{ color: colors.text, marginTop: 10, fontWeight: '900' }}>
          期間スコア: {periodScore?.toFixed(1) ?? '--'}
        </Text>
        <Text style={{ color: colors.sub, marginTop: 4 }}>{periodDescription}</Text>
      </View>

      {/* ===== Webの “長期目線スコア” の説明ブロック ===== */}
      <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Text style={[styles.h2, { color: colors.text }]}>
          {viewKey === 'short' ? '短期目線スコア:' : viewKey === 'mid' ? '中期目線スコア:' : '長期目線スコア:'}{' '}
          <Text style={{ color: colors.blue }}>{periodScore?.toFixed(1) ?? '--'}</Text>
        </Text>

        <Text style={[styles.paragraph, { color: colors.sub }]}>
          {viewKey === 'short'
            ? '短期目線では、直近の値動きと過熱感を重視します。'
            : viewKey === 'mid'
              ? '中期目線では、トレンドの持続性と勢いを重視します。'
              : '長期目線では、過去の平均水準や構造的な割高・割安感を重視します。'}
        </Text>
        <Text style={[styles.paragraph, { color: colors.sub }]}>
          {viewKey === 'long'
            ? '「今は歴史的に見てどの位置か？」という俯瞰の視点です。'
            : '期間が変わると、見るべき景色が変わります。'}
        </Text>
        <Text style={[styles.paragraph, { color: colors.sub }]}>
          {viewKey === 'long'
            ? 'ここでの判断は、天井圏か、まだ余地があるかを確認する意味合いになります。'
            : '短期のノイズに引っ張られないよう、期間を切り替えて確認してください。'}
        </Text>
      </View>

      {/* ===== キャラクターカード（画像は後で差し替え） ===== */}
      <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.border, paddingBottom: 22 }]}>
        <View style={[styles.characterPlaceholder, { backgroundColor: darkMode ? '#111827' : '#F3F4F6', borderColor: colors.border }]}>
          <Text style={{ color: colors.muted, fontWeight: '800' }}>（キャラクター画像エリア）</Text>
        </View>
        <Text style={{ color: colors.sub, textAlign: 'center', marginTop: 10, fontWeight: '700' }}>スコアに応じて表示が変わります</Text>
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

      <Pressable
        onPress={() => {
          // TODO: マイポジ試算（任意）の導線は次フェーズで実装
        }}
        style={[styles.fab, { backgroundColor: '#7C3AED' }]}
      >
        <Text style={styles.fabText}>マイポジ試算（任意）</Text>
      </Pressable>
    </View>
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

  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },

  breakdownWrap: {
    marginTop: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  breakdownTitle: { fontSize: 18, fontWeight: '900', marginBottom: 10 },

  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  barLabel: { width: 86, fontSize: 16, fontWeight: '700' },
  barTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden', marginHorizontal: 10 },
  barFill: { height: 8, borderRadius: 999 },
  barValue: { width: 58, textAlign: 'right', fontSize: 18, fontWeight: '900' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  kpiBox: { width: '48%', borderRadius: 12, padding: 12 },
  kpiLabel: { fontSize: 14, fontWeight: '700' },
  kpiValue: { marginTop: 6, fontSize: 26, fontWeight: '900' },

  paragraph: { fontSize: 16, lineHeight: 24, marginTop: 10, fontWeight: '600' },

  characterPlaceholder: {
    height: 260,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 22,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },

})
