import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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

export function DashboardScreen() {
  const colorScheme = useColorScheme()
  const darkMode = colorScheme === 'dark'
  const [viewKey, setViewKey] = useState<ViewKey>('long')
  const [indexType, setIndexType] = useState<IndexType>('SP500')
  const [status, setStatus] = useState<EvalStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<EvaluateResponse | null>(null)

  const cardBg = darkMode ? '#111827' : '#FFFFFF'
  const textColor = darkMode ? '#F3F4F6' : '#111827'
  const subColor = darkMode ? '#9CA3AF' : '#4B5563'

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
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'データ取得に失敗しました')
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: darkMode ? '#030712' : '#F3F4F6' }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={fetchEvaluate} />}
    >
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.label, { color: subColor }]}>対象インデックス</Text>
        <Picker selectedValue={indexType} onValueChange={(v) => setIndexType(v as IndexType)}>
          {Object.entries(INDEX_LABELS).map(([value, label]) => (
            <Picker.Item key={value} label={label} value={value} />
          ))}
        </Picker>
        <Text style={{ color: subColor, fontSize: 12 }}>API: {API_BASE}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>総合スコア部（統合判断）</Text>
        <Text style={[styles.totalScore, { color: textColor }]}>{response?.scores.total?.toFixed(1) ?? '--'}</Text>
        <Text style={{ color: subColor }}>ラベル: {response?.scores.label ?? '計算待ち'}</Text>
        <Text style={[styles.box, { color: subColor }]}>総合スコアは常に scores.total を表示し、期間タブに影響されません。</Text>
      </View>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>時間軸カード（参考）</Text>
        <View style={styles.tabs}>
          {tabOrder.map((key) => (
            <Pressable
              key={key}
              style={[styles.tab, viewKey === key && styles.activeTab]}
              onPress={() => setViewKey(key)}
            >
              <Text style={{ color: viewKey === key ? '#FFFFFF' : subColor }}>{VIEW_LABELS[key]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: textColor, marginBottom: 8 }}>期間スコア: {periodScore?.toFixed(1) ?? '--'}</Text>
        <Text style={{ color: subColor, marginBottom: 8 }}>{periodDescription}</Text>
        <Text style={{ color: textColor }}>内訳</Text>
        <Text style={{ color: subColor }}>Technical: {periodBreakdown?.scores.technical?.toFixed(1) ?? '--'}</Text>
        <Text style={{ color: subColor }}>Macro: {periodBreakdown?.scores.macro?.toFixed(1) ?? '--'}</Text>
        <Text style={{ color: subColor }}>Event adj: {periodBreakdown?.scores.event_adjustment?.toFixed(1) ?? '--'}</Text>
        <Text style={{ color: textColor, marginTop: 8 }}>指標</Text>
        <Text style={{ color: subColor }}>d: {periodBreakdown?.technical_details.d?.toFixed(2) ?? '--'}</Text>
        <Text style={{ color: subColor }}>T_base: {periodBreakdown?.technical_details.T_base?.toFixed(2) ?? '--'}</Text>
        <Text style={{ color: subColor }}>T_trend: {periodBreakdown?.technical_details.T_trend?.toFixed(2) ?? '--'}</Text>
        <Text style={{ color: subColor }}>
          macro_M: {(periodBreakdown?.macro_details.macro_M ?? periodBreakdown?.macro_details.M)?.toFixed(2) ?? '--'}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>価格 + MA20/MA60/MA200 チャート</Text>
        {response?.price_series?.length ? (
          <PriceTrendChart points={response.price_series} viewKey={viewKey} darkMode={darkMode} />
        ) : (
          <Text style={{ color: subColor }}>価格データがありません。</Text>
        )}
      </View>

      {status === 'loading' && (
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <ActivityIndicator />
          <Text style={{ color: subColor, marginTop: 8 }}>データ取得中...</Text>
        </View>
      )}
      {(status === 'degraded' || status === 'error') && (
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={{ color: '#EF4444', fontWeight: '700' }}>{status === 'degraded' ? 'degraded' : 'error'}</Text>
          <Text style={{ color: subColor }}>{error ?? response?.reasons?.join(' / ') ?? 'エラーが発生しました。'}</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 14, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB' },
  label: { fontSize: 13, marginBottom: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  totalScore: { fontSize: 36, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#E5E7EB' },
  activeTab: { backgroundColor: '#2563EB' },
  box: { marginTop: 8, fontSize: 12 },
})
