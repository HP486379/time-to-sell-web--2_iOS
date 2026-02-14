import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native'

import { evaluateIndex } from '../../../shared/api'
import type { EvaluateRequest, EvaluateResponse } from '../../../shared/types/evaluate'

type EvalStatus = 'loading' | 'ready' | 'degraded' | 'error'
type ScreenTab = 'dashboard' | 'backtest'
type DisplayMode = 'simple' | 'pro'

const defaultRequest: EvaluateRequest = {
  total_quantity: 77384,
  avg_cost: 21458,
  index_type: 'SP500',
  score_ma: 200,
}

function segmentButton(active: boolean, darkMode: boolean) {
  if (active) return [styles.segmentButton, styles.segmentButtonActive]
  return [styles.segmentButton, darkMode ? styles.segmentButtonDark : styles.segmentButtonLight]
}

type DisplayMode = 'easy' | 'pro'

export function DashboardScreen() {
  const darkMode = useColorScheme() === 'dark'
  const [status, setStatus] = useState<EvalStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<EvaluateResponse | null>(null)
  const [screenTab, setScreenTab] = useState<ScreenTab>('dashboard')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('simple')

  const textColor = darkMode ? '#F3F4F6' : '#111827'
  const subColor = darkMode ? '#9CA3AF' : '#6B7280'

  const fetchEvaluate = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const next = await evaluateIndex(defaultRequest)
      setResponse(next)
      setStatus(next.status === 'ready' ? 'ready' : next.status === 'degraded' ? 'degraded' : 'error')
      setLastUpdatedAt(new Date())
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'データ取得に失敗しました')
      setLastUpdatedAt(new Date())
    }
  }, [])

  useEffect(() => {
    fetchEvaluate()
  }, [fetchEvaluate])

  const longBreakdown = response?.period_breakdowns?.long
  const longScore = response?.period_scores?.long

  const characterMessage = useMemo(() => {
    const total = response?.scores.total ?? 0
    if (total >= 75) return '利確を前向きに検討する局面です。'
    if (total >= 55) return '様子見しつつ分割売却を検討しましょう。'
    return 'ホールド優勢です。焦らず条件を待ちましょう。'
  }, [response?.scores.total])

  return (
    <View style={[styles.root, darkMode ? styles.rootDark : styles.rootLight]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={fetchEvaluate} />}
      >
        <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
          <Text style={[styles.headerTitle, { color: textColor }]}>売り時くん</Text>
          <Text style={[styles.headerSubtitle, { color: subColor }]}>テクニカル・マクロ・イベントの三軸で売り時スコアを可視化</Text>
        </View>

        <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
          <View style={styles.segmentRow}>
            <Pressable style={segmentButton(screenTab === 'dashboard', darkMode)} onPress={() => setScreenTab('dashboard')}>
              <Text style={styles.segmentText}>メイン画面</Text>
            </Pressable>
            <Pressable style={segmentButton(screenTab === 'backtest', darkMode)} onPress={() => setScreenTab('backtest')}>
              <Text style={styles.segmentText}>バックテスト画面</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
          <View style={styles.segmentRow}>
            <Pressable style={segmentButton(displayMode === 'simple', darkMode)} onPress={() => setDisplayMode('simple')}>
              <Text style={styles.segmentText}>かんたん</Text>
            </Pressable>
            <Pressable style={segmentButton(displayMode === 'pro', darkMode)} onPress={() => setDisplayMode('pro')}>
              <Text style={styles.segmentText}>プロ向け</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
          <Text style={[styles.blockTitle, { color: textColor }]}>注意</Text>
          <Text style={{ color: subColor, fontSize: 12 }}>
            本アプリは投資判断の参考情報であり、売買を推奨するものではありません。最終判断はご自身で行ってください。
          </Text>
        </View>

        <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
          <Text style={[styles.blockTitle, { color: textColor }]}>長期目線の内訳</Text>

          <View style={styles.barRow}><Text style={[styles.barLabel, { color: subColor }]}>Technical</Text><Text style={{ color: subColor }}>{longBreakdown?.scores.technical?.toFixed(1) ?? '--'}</Text></View>
          <View style={[styles.barTrack, darkMode ? styles.barTrackDark : styles.barTrackLight]}><View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, longBreakdown?.scores.technical ?? 0))}%`, backgroundColor: '#3B82F6' }]} /></View>

          <View style={styles.barRow}><Text style={[styles.barLabel, { color: subColor }]}>Macro</Text><Text style={{ color: subColor }}>{longBreakdown?.scores.macro?.toFixed(1) ?? '--'}</Text></View>
          <View style={[styles.barTrack, darkMode ? styles.barTrackDark : styles.barTrackLight]}><View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, longBreakdown?.scores.macro ?? 0))}%`, backgroundColor: '#10B981' }]} /></View>

          <View style={styles.barRow}><Text style={[styles.barLabel, { color: subColor }]}>Event</Text><Text style={{ color: subColor }}>{longBreakdown?.scores.event_adjustment?.toFixed(1) ?? '--'}</Text></View>
          <View style={[styles.barTrack, darkMode ? styles.barTrackDark : styles.barTrackLight]}><View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, longBreakdown?.scores.event_adjustment ?? 0))}%`, backgroundColor: '#F59E0B' }]} /></View>

          <View style={styles.kpiGrid}>
            <View style={[styles.kpiBox, darkMode ? styles.kpiDark : styles.kpiLight]}><Text style={[styles.kpiLabel, { color: subColor }]}>d</Text><Text style={[styles.kpiValue, { color: textColor }]}>{longBreakdown?.technical_details.d?.toFixed(2) ?? '--'}</Text></View>
            <View style={[styles.kpiBox, darkMode ? styles.kpiDark : styles.kpiLight]}><Text style={[styles.kpiLabel, { color: subColor }]}>T_base</Text><Text style={[styles.kpiValue, { color: textColor }]}>{longBreakdown?.technical_details.T_base?.toFixed(2) ?? '--'}</Text></View>
            <View style={[styles.kpiBox, darkMode ? styles.kpiDark : styles.kpiLight]}><Text style={[styles.kpiLabel, { color: subColor }]}>T_trend</Text><Text style={[styles.kpiValue, { color: textColor }]}>{longBreakdown?.technical_details.T_trend?.toFixed(2) ?? '--'}</Text></View>
            <View style={[styles.kpiBox, darkMode ? styles.kpiDark : styles.kpiLight]}><Text style={[styles.kpiLabel, { color: subColor }]}>macro_M</Text><Text style={[styles.kpiValue, { color: textColor }]}>{(longBreakdown?.macro_details.macro_M ?? longBreakdown?.macro_details.M)?.toFixed(2) ?? '--'}</Text></View>
          </View>
        </View>

        <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
          <Text style={[styles.blockTitle, { color: textColor }]}>長期スコア</Text>
          <Text style={[styles.scoreValue, { color: textColor }]}>{longScore?.toFixed(1) ?? '--'}</Text>
          <Text style={{ color: subColor }}>総合: {response?.scores.total?.toFixed(1) ?? '--'} / {response?.scores.label ?? '計算待ち'}</Text>
        </View>

        <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
          <Text style={[styles.blockTitle, { color: textColor }]}>キャラクター</Text>
          <Text style={styles.characterEmoji}>🤖</Text>
          <Text style={{ color: subColor }}>{characterMessage}</Text>
        </View>

        {status === 'loading' && (
          <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
            <ActivityIndicator />
            <Text style={{ color: subColor, marginTop: 8 }}>データ取得中...</Text>
          </View>
        )}

        {(status === 'degraded' || status === 'error') && (
          <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
            <Text style={styles.errorTitle}>{status === 'degraded' ? 'degraded' : 'error'}</Text>
            <Text style={{ color: subColor }}>{error ?? response?.reasons?.join(' / ') ?? 'エラーが発生しました。'}</Text>
          </View>
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

      <Pressable style={styles.fab} onPress={fetchEvaluate}>
        <Text style={styles.fabText}>↻</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootDark: { backgroundColor: '#030712' },
  rootLight: { backgroundColor: '#F3F4F6' },
  content: { padding: 16, gap: 12, paddingBottom: 96 },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDark: { backgroundColor: '#111827', borderColor: '#374151' },
  cardLight: { backgroundColor: '#FFFFFF', borderColor: '#D1D5DB' },
  headerTitle: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  headerSubtitle: { fontSize: 13, lineHeight: 18 },
  blockTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentButton: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flex: 1, alignItems: 'center' },
  segmentButtonActive: { backgroundColor: '#4F46E5' },
  segmentButtonDark: { backgroundColor: '#1F2937' },
  segmentButtonLight: { backgroundColor: '#E5E7EB' },
  segmentText: { color: '#FFFFFF', fontWeight: '700' },
  barRow: { marginTop: 4, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 12 },
  barTrack: { height: 8, borderRadius: 8, overflow: 'hidden', marginBottom: 6 },
  barTrackDark: { backgroundColor: '#374151' },
  barTrackLight: { backgroundColor: '#E5E7EB' },
  barFill: { height: '100%' },
  kpiGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiBox: { width: '48%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10 },
  kpiDark: { backgroundColor: '#0F172A', borderColor: '#334155' },
  kpiLight: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  kpiLabel: { fontSize: 12 },
  kpiValue: { fontSize: 16, fontWeight: '700' },
  scoreValue: { fontSize: 42, fontWeight: '800' },
  characterEmoji: { fontSize: 36, marginBottom: 8 },
  errorTitle: { color: '#EF4444', fontWeight: '700', marginBottom: 6 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: { color: '#FFF', fontSize: 24, fontWeight: '700' },
})
