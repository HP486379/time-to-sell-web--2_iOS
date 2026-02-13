import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://time-to-sell-web-ios.onrender.com";

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/dashboard`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text>データ取得失敗</Text>
      </View>
    );
  }

  const score = data.scores?.total ?? "-";
  const label = data.label ?? "-";

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>売り時くん</Text>

      {/* Index Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>対象インデックス</Text>

        <View style={styles.indexBox}>
          <Text style={styles.indexText}>S&P500</Text>
          <Text style={styles.indexSub}>S&P500（円建て）</Text>
        </View>

        <Text style={styles.apiText}>API: {API_BASE}</Text>
      </View>

      {/* Score Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>総合スコア部（統合判断）</Text>

        <Text style={styles.score}>{score}</Text>

        <Text style={styles.label}>ラベル: {label}</Text>

        <Text style={styles.note}>
          総合スコアは常に scores.total を表示し、期間タブに影響されません。
        </Text>
      </View>

      {/* Timeline */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>時間軸カード（参考）</Text>

        <View style={styles.tabRow}>
          <Text style={styles.tab}>短期</Text>
          <Text style={styles.tab}>中期</Text>
          <Text style={[styles.tab, styles.tabActive]}>長期</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f5f6f8",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#3b6cb7",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  cardTitle: {
    fontSize: 16,
    marginBottom: 12,
    fontWeight: "600",
  },

  indexBox: {
    backgroundColor: "#f0f0f0",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },

  indexText: {
    fontSize: 20,
    fontWeight: "bold",
  },

  indexSub: {
    fontSize: 14,
    color: "#888",
  },

  apiText: {
    marginTop: 8,
    fontSize: 12,
    color: "#888",
  },

  score: {
    fontSize: 48,
    fontWeight: "bold",
  },

  label: {
    marginTop: 8,
    fontSize: 16,
  },

  note: {
    marginTop: 8,
    fontSize: 12,
    color: "#888",
  },

  tabRow: {
    flexDirection: "row",
    marginTop: 8,
  },

  tab: {
    marginRight: 8,
    padding: 8,
    backgroundColor: "#eee",
    borderRadius: 8,
  },

  tabActive: {
    backgroundColor: "#3b6cb7",
    color: "#fff",
  },
});
