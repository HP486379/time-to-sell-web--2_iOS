import WidgetKit
import SwiftUI

struct WidgetSummaryResponse: Decodable {
    let score: Double
    let judgment: String
    let updated_at: String
}

struct TimeToSellEntry: TimelineEntry {
    let date: Date
    let score: Double
    let judgment: String
    let updatedAtText: String
    let isError: Bool
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> TimeToSellEntry {
        TimeToSellEntry(date: Date(), score: 80.0, judgment: "HOLD", updatedAtText: "--:--", isError: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (TimeToSellEntry) -> ()) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TimeToSellEntry>) -> ()) {
        fetchSummary { entry in
            let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func fetchSummary(completion: @escaping (TimeToSellEntry) -> Void) {
        guard let url = URL(string: "https://time-to-sell-web-ios.onrender.com/api/widget/summary?index_type=sp500") else {
            completion(TimeToSellEntry(date: Date(), score: 0, judgment: "ERROR", updatedAtText: "URLエラー", isError: true))
            return
        }

        let task = URLSession.shared.dataTask(with: url) { data, _, error in
            if error != nil {
                completion(TimeToSellEntry(date: Date(), score: 0, judgment: "ERROR", updatedAtText: "通信エラー", isError: true))
                return
            }

            guard let data = data,
                  let decoded = try? JSONDecoder().decode(WidgetSummaryResponse.self, from: data) else {
                completion(TimeToSellEntry(date: Date(), score: 0, judgment: "ERROR", updatedAtText: "解析エラー", isError: true))
                return
            }

            let formatter = ISO8601DateFormatter()
            let updated = formatter.date(from: decoded.updated_at) ?? Date()
            let timeFormatter = DateFormatter()
            timeFormatter.dateFormat = "HH:mm"

            completion(
                TimeToSellEntry(
                    date: Date(),
                    score: decoded.score,
                    judgment: decoded.judgment,
                    updatedAtText: timeFormatter.string(from: updated),
                    isError: false
                )
            )
        }
        task.resume()
    }
}

struct TimeToSellWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Link(destination: URL(string: "timetosell://dashboard")!) {
            VStack(alignment: .leading, spacing: 8) {
                Text("S&P500")
                    .font(.headline)
                if entry.isError {
                    Text("データ取得失敗")
                        .font(.subheadline)
                        .foregroundColor(.red)
                } else {
                    Text(String(format: "%.1f", entry.score))
                        .font(.system(size: family == .systemSmall ? 32 : 38, weight: .bold))
                    Text(entry.judgment)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("更新: \(entry.updatedAtText)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .padding()
        }
    }
}

struct TimeToSellWidget: Widget {
    let kind: String = "TimeToSellWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TimeToSellWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("売り時くん")
        .description("S&P500スコアと判定を表示します")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#Preview(as: .systemSmall) {
    TimeToSellWidget()
} timeline: {
    TimeToSellEntry(date: Date(), score: 79.5, judgment: "HOLD", updatedAtText: "10:30", isError: false)
}
