 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/frontend/src/components/DashboardPage.tsx b/frontend/src/components/DashboardPage.tsx
index 592ed73c1d052331471c4e1b18bad26c7646e2b3..8775eb78fdffd0252c82a8058f4460cca154f746 100644
--- a/frontend/src/components/DashboardPage.tsx
+++ b/frontend/src/components/DashboardPage.tsx
@@ -90,50 +90,56 @@ function DashboardPage({ displayMode }: { displayMode: DisplayMode }) {
   const [fundNav, setFundNav] = useState<FundNavResponse | null>(null)
   const [lastRequest, setLastRequest] = useState<EvaluateRequest>(defaultRequest)
   const [indexType, setIndexType] = useState<IndexType>('SP500')
   const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
   const [showDetails, setShowDetails] = useState(false)
   const [startOption, setStartOption] = useState<StartOption>('max')
   const [customStart, setCustomStart] = useState('')
   const [priceDisplayMode, setPriceDisplayMode] = useState<PriceDisplayMode>('normalized')
   const [positionDialogOpen, setPositionDialogOpen] = useState(false)
   const [priceSeriesMap, setPriceSeriesMap] = useState<Partial<Record<IndexType, PricePoint[]>>>({})
 
   // ★ 追加：イベント用 state
   const [events, setEvents] = useState<EventItem[]>([])
   const [isEventsLoading, setIsEventsLoading] = useState(false)
   const [eventsError, setEventsError] = useState<string | null>(null)
 
   const tooltipTexts = useMemo(
     () => buildTooltips(indexType, lastRequest.score_ma),
     [indexType, lastRequest.score_ma],
   )
 
   const response = responses[indexType] ?? null
   const totalScore = response?.scores?.total
   const priceSeries = priceSeriesMap[indexType] ?? []
 
+  const scoreMaToStartOption = (scoreMa: number): StartOption => {
+    if (scoreMa === 20) return '1m'
+    if (scoreMa === 60) return '3m'
+    return '1y'
+  }
+
   const fetchEvaluation = async (
     targetIndex: IndexType,
     payload?: Partial<EvaluateRequest>,
     markPrimary = false,
   ) => {
     try {
       const body = { ...lastRequest, ...(payload ?? {}), index_type: targetIndex }
       if (markPrimary) setError(null)
       const res = await apiClient.post<EvaluateResponse>('/api/evaluate', body)
       setResponses((prev) => ({ ...prev, [targetIndex]: res.data }))
       if (targetIndex === indexType && payload)
         setLastRequest((prev) => ({ ...prev, ...payload, index_type: targetIndex }))
       if (markPrimary) setLastUpdated(new Date())
     } catch (e: any) {
       if (markPrimary) {
         setError(e.message)
       } else {
         console.error('評価の取得に失敗しました', e)
       }
     }
   }
 
   const getPriceHistoryEndpoint = (targetIndex: IndexType) => {
     const map: Record<IndexType, string> = {
       SP500: '/api/sp500/price-history',
@@ -211,50 +217,59 @@ function DashboardPage({ displayMode }: { displayMode: DisplayMode }) {
   const avatarDecision = useMemo(() => decideSellAction(totalScore), [totalScore])
 
   const { chartSeries, totalReturnLabels, legendLabels } = useMemo(
     () =>
       buildChartState({
         indexType,
         priceSeriesMap,
         startOption,
         customStart,
         priceDisplayMode,
       }),
     [indexType, priceSeriesMap, startOption, customStart, priceDisplayMode],
   )
 
   const forexInsight = useMemo(
     () => buildForexInsight(indexType, responses),
     [indexType, responses],
   )
 
   useEffect(() => {
     if (startOption === 'custom' && !customStart && priceSeries.length) {
       setCustomStart(priceSeries[0].date)
     }
   }, [startOption, customStart, priceSeries])
 
+  useEffect(() => {
+    const next = scoreMaToStartOption(lastRequest.score_ma)
+    setStartOption((prev) => {
+      if (prev === next) return prev
+      setCustomStart('')
+      return next
+    })
+  }, [lastRequest.score_ma])
+
   // ★ 追加：価格データの「最新日付」を基準にイベントを取得
   useEffect(() => {
     if (!priceSeries.length) return
 
     const lastPoint = priceSeries[priceSeries.length - 1]
     const lastDateIso = lastPoint?.date
     if (!lastDateIso) return
 
     const run = async () => {
       try {
         setIsEventsLoading(true)
         setEventsError(null)
 
         const data = await fetchEvents(lastDateIso)
         setEvents(data)
         console.log('[EVENT TRACE]', data)
       } catch (e: any) {
         console.error('イベント取得に失敗しました', e)
         setEventsError(e.message ?? 'イベント取得に失敗しました')
       } finally {
         setIsEventsLoading(false)
       }
     }
 
     run()
@@ -363,125 +378,127 @@ function DashboardPage({ displayMode }: { displayMode: DisplayMode }) {
                       expanded={showDetails}
                       tooltips={tooltipTexts}
                     />
                   </Collapse>
                 </Grid>
               </>
             ) : (
               <>
                 <Grid item xs={12} md={7} sx={{ height: '100%' }}>
                   <ScoreSummaryCard
                     scores={response?.scores}
                     technical={response?.technical_details}
                     macro={response?.macro_details}
                     tooltips={tooltipTexts}
                   />
                 </Grid>
                 <Grid item xs={12} md={5} sx={{ height: '100%' }}>
                   <SellTimingAvatarCard decision={avatarDecision} scoreMaDays={scoreMaDays} />
                 </Grid>
               </>
             )}
           </Grid>
         </motion.div>
       </AnimatePresence>
 
-      <Card>
-        <CardContent>
-          <Tooltip title={tooltipTexts.chart.title} arrow>
-            <Typography variant="h6" gutterBottom component="div">
-              {PRICE_TITLE_MAP[indexType]}
-            </Typography>
-          </Tooltip>
-          {totalReturnLabels.length > 0 && (
-            <Stack spacing={0.5} mb={2} mt={-0.5}>
-              {totalReturnLabels.map((label) => (
-                <Typography key={label} variant="body2" color="text.secondary">
-                  {label}
-                </Typography>
-              ))}
-            </Stack>
-          )}
-          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" mb={2}>
-            <FormControl size="small" sx={{ minWidth: 180 }}>
-              <InputLabel id="price-display-mode-label">表示モード</InputLabel>
-              <Select
-                labelId="price-display-mode-label"
-                value={priceDisplayMode}
-                label="表示モード"
-                onChange={(e) => setPriceDisplayMode(e.target.value as PriceDisplayMode)}
-              >
-                <MenuItem value="normalized">正規化</MenuItem>
-                <MenuItem value="actual">実価格</MenuItem>
-              </Select>
-            </FormControl>
-            <FormControl size="small" sx={{ minWidth: 200 }}>
-              <InputLabel id="start-select-label">開始時点</InputLabel>
-              <Select
-                labelId="start-select-label"
-                value={startOption}
-                label="開始時点"
-                onChange={(e) => setStartOption(e.target.value as StartOption)}
-              >
-                <MenuItem value="max">全期間</MenuItem>
-                <MenuItem value="1m">1ヶ月前</MenuItem>
-                <MenuItem value="3m">3ヶ月前</MenuItem>
-                <MenuItem value="6m">6ヶ月前</MenuItem>
-                <MenuItem value="1y">1年前</MenuItem>
-                <MenuItem value="3y">3年前</MenuItem>
-                <MenuItem value="5y">5年前</MenuItem>
-                <MenuItem value="custom">日付を指定</MenuItem>
-              </Select>
-            </FormControl>
-            <TextField
-              label="開始日を指定"
-              type="date"
-              size="small"
-              value={customStart}
-              onChange={(e) => setCustomStart(e.target.value)}
-              disabled={startOption !== 'custom'}
-              InputLabelProps={{ shrink: true }}
-            />
-          </Box>
-          <AnimatePresence mode="wait">
-            <motion.div
-              key={`${startOption}-${customStart}-${displayMode}-${priceDisplayMode}`}
-              variants={chartMotion}
-              initial="initial"
-              animate="animate"
-              exit="exit"
-            >
-              <PriceChart
-                priceSeries={chartSeries}
-                simple={displayMode === 'simple'}
-                tooltips={tooltipTexts}
-                legendLabels={legendLabels}
+      {displayMode === 'pro' && (
+        <Card>
+          <CardContent>
+            <Tooltip title={tooltipTexts.chart.title} arrow>
+              <Typography variant="h6" gutterBottom component="div">
+                {PRICE_TITLE_MAP[indexType]}
+              </Typography>
+            </Tooltip>
+            {totalReturnLabels.length > 0 && (
+              <Stack spacing={0.5} mb={2} mt={-0.5}>
+                {totalReturnLabels.map((label) => (
+                  <Typography key={label} variant="body2" color="text.secondary">
+                    {label}
+                  </Typography>
+                ))}
+              </Stack>
+            )}
+            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" mb={2}>
+              <FormControl size="small" sx={{ minWidth: 180 }}>
+                <InputLabel id="price-display-mode-label">表示モード</InputLabel>
+                <Select
+                  labelId="price-display-mode-label"
+                  value={priceDisplayMode}
+                  label="表示モード"
+                  onChange={(e) => setPriceDisplayMode(e.target.value as PriceDisplayMode)}
+                >
+                  <MenuItem value="normalized">正規化</MenuItem>
+                  <MenuItem value="actual">実価格</MenuItem>
+                </Select>
+              </FormControl>
+              <FormControl size="small" sx={{ minWidth: 200 }}>
+                <InputLabel id="start-select-label">開始時点</InputLabel>
+                <Select
+                  labelId="start-select-label"
+                  value={startOption}
+                  label="開始時点"
+                  onChange={(e) => setStartOption(e.target.value as StartOption)}
+                >
+                  <MenuItem value="max">全期間</MenuItem>
+                  <MenuItem value="1m">1ヶ月前</MenuItem>
+                  <MenuItem value="3m">3ヶ月前</MenuItem>
+                  <MenuItem value="6m">6ヶ月前</MenuItem>
+                  <MenuItem value="1y">1年前</MenuItem>
+                  <MenuItem value="3y">3年前</MenuItem>
+                  <MenuItem value="5y">5年前</MenuItem>
+                  <MenuItem value="custom">日付を指定</MenuItem>
+                </Select>
+              </FormControl>
+              <TextField
+                label="開始日を指定"
+                type="date"
+                size="small"
+                value={customStart}
+                onChange={(e) => setCustomStart(e.target.value)}
+                disabled={startOption !== 'custom'}
+                InputLabelProps={{ shrink: true }}
               />
-            </motion.div>
-          </AnimatePresence>
-        </CardContent>
-      </Card>
+            </Box>
+            <AnimatePresence mode="wait">
+              <motion.div
+                key={`${startOption}-${customStart}-${displayMode}-${priceDisplayMode}`}
+                variants={chartMotion}
+                initial="initial"
+                animate="animate"
+                exit="exit"
+              >
+                <PriceChart
+                  priceSeries={chartSeries}
+                  simple={displayMode === 'simple'}
+                  tooltips={tooltipTexts}
+                  legendLabels={legendLabels}
+                />
+              </motion.div>
+            </AnimatePresence>
+          </CardContent>
+        </Card>
+      )}
 
       {forexInsight && (
         <Card>
           <CardContent>
             <Typography variant="subtitle1" gutterBottom>
               為替インサイト
             </Typography>
             <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
               <Chip label={`スコア差: ${forexInsight.diff.toFixed(1)}pt`} color="info" size="small" />
               <Typography variant="body2" color="text.secondary">
                 {forexInsight.message}
               </Typography>
             </Stack>
           </CardContent>
         </Card>
       )}
 
       <Grid container spacing={3}>
         <Grid item xs={12} md={7}>
           <MacroCards macroDetails={response?.macro_details} tooltips={tooltipTexts} />
         </Grid>
         <Grid item xs={12} md={5}>
           {/* ★ イベント一覧：旧 event_details に加えて /api/events の結果も渡す */}
           <EventList
             eventDetails={response?.event_details}
 
EOF
)
