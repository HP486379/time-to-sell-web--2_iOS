import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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

import { Card } from '../components/Card'
import { FloatingActionButton } from '../components/FloatingActionButton'
import { KPIBox } from '../components/KPIBox'
import { PriceTrendChart } from '../components/PriceTrendChart'
import { ScoreBreakdownBar } from '../components/ScoreBreakdownBar'
import { SegmentedControl } from '../components/SegmentedControl'
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

  const periodDescription = useMemo(() => {
    if (viewKey === 'short') return '短期（1ヶ月）目線の売却タイミング評価'
    if (viewKey === 'mid') return '中期（6ヶ月）目線の売却タイミング評価'
    return '長期（1年）目線の売却タイミング評価'
  }, [viewKey])

  return (
    <View style={[styles.root, { backgroundColor: darkMode ? '#030712' : '#F3F4F6' }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={fetchEvaluate} />}
      >
        <Card darkMode={darkMode}>
          <Text style={[styles.sectionLabel, { color: subColor }]}>対象インデックス</Text>
          <Picker selectedValue={indexType} onValueChange={(v) => setIndexType(v as IndexType)}>
            {Object.entries(INDEX_LABELS).map(([value, label]) => (
              <Picker.Item key={value} label={label} value={value} />
            ))}
          </Picker>
          <Text style={{ color: subColor, fontSize: 12 }}>API: {API_BASE}</Text>
        </Card>

        <Card darkMode={darkMode}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>総合スコア部（統合判断）</Text>
          <Text style={[styles.totalScore, { color: textColor }]}>{response?.scores.total?.toFixed(1) ?? '--'}</Text>
          <Text style={{ color: subColor, marginBottom: 4 }}>ラベル: {response?.scores.label ?? '計算待ち'}</Text>
          <Text style={[styles.helpText, { color: subColor }]}>総合スコアは常に scores.total を表示し、期間タブに影響されません。</Text>
        </Card>

        <Card darkMode={darkMode}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>時間軸カード（参考）</Text>
          <SegmentedControl
            darkMode={darkMode}
            value={viewKey}
            onChange={setViewKey}
            options={tabOrder.map((key) => ({ label: VIEW_LABELS[key], value: key }))}
          />

          <Text style={[styles.periodScore, { color: textColor }]}>期間スコア: {periodScore?.toFixed(1) ?? '--'}</Text>
          <Text style={{ color: subColor, marginBottom: 10 }}>{periodDescription}</Text>

          <ScoreBreakdownBar
            darkMode={darkMode}
            label="Technical"
            value={periodBreakdown?.scores.technical}
            color="#3B82F6"
          />
          <ScoreBreakdownBar darkMode={darkMode} label="Macro" value={periodBreakdown?.scores.macro} color="#10B981" />
          <ScoreBreakdownBar
            darkMode={darkMode}
            label="Event adj"
            value={periodBreakdown?.scores.event_adjustment}
            color="#F59E0B"
          />

          <View style={styles.kpiRow}>
            <KPIBox darkMode={darkMode} label="d" value={periodBreakdown?.technical_details.d?.toFixed(2) ?? '--'} />
            <KPIBox
              darkMode={darkMode}
              label="T_base"
              value={periodBreakdown?.technical_details.T_base?.toFixed(2) ?? '--'}
            />
          </View>
          <View style={styles.kpiRow}>
            <KPIBox
              darkMode={darkMode}
              label="T_trend"
              value={periodBreakdown?.technical_details.T_trend?.toFixed(2) ?? '--'}
            />
            <KPIBox
              darkMode={darkMode}
              label="macro_M"
              value={((periodBreakdown?.macro_details.macro_M ?? periodBreakdown?.macro_details.M)?.toFixed(2) ?? '--') as string}
            />
          </View>
        </Card>

        <Card darkMode={darkMode}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>価格 + MA20/MA60/MA200 チャート</Text>
          {response?.price_series?.length ? (
            <PriceTrendChart points={response.price_series} viewKey={viewKey} darkMode={darkMode} />
          ) : (
            <Text style={{ color: subColor }}>価格データがありません。</Text>
          )}
        </Card>

        {status === 'loading' && (
          <Card darkMode={darkMode}>
            <ActivityIndicator />
            <Text style={{ color: subColor, marginTop: 8 }}>データ取得中...</Text>
          </Card>
        )}
        {(status === 'degraded' || status === 'error') && (
          <Card darkMode={darkMode}>
            <Text style={styles.errorTitle}>{status === 'degraded' ? 'degraded' : 'error'}</Text>
            <Text style={{ color: subColor }}>{error ?? response?.reasons?.join(' / ') ?? 'エラーが発生しました。'}</Text>
          </Card>
        )}
      </ScrollView>

      <FloatingActionButton onPress={fetchEvaluate} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 90 },
  sectionLabel: { fontSize: 13, marginBottom: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  totalScore: { fontSize: 36, fontWeight: '800' },
  helpText: { fontSize: 12 },
  periodScore: { marginBottom: 6, fontWeight: '700' },
  kpiRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  errorTitle: { color: '#EF4444', fontWeight: '700' },
})
