import SwiftUI

/// Everything the user bookmarked, grouped by day under an uppercase overline,
/// with a reminder switch under each card. There is no account: this list lives
/// on the device, and the subtitle says so out loud rather than leaving the
/// user to wonder where it went after a reinstall.
struct SavedView: View {
    @EnvironmentObject var app: AppState
    @State private var selected: Event?

    /// One day's worth of saved events. `savedUpcoming` is already in date
    /// order, so grouping in the order it hands them over keeps the days in
    /// order too, with no second sort.
    private struct DayGroup: Identifiable {
        let day: String
        let events: [Event]
        var id: String { day }
    }

    var body: some View {
        ZStack {
            Tok.bg.ignoresSafeArea()
            content
        }
        .safeAreaInset(edge: .top, spacing: 0) { chrome }
        .sheet(item: $selected) { EventDetailView(event: $0) }
    }

    private var chrome: some View {
        VStack(alignment: .leading, spacing: 11) {
            BrandStrip()
            VStack(alignment: .leading, spacing: 2) {
                Text("Saved")
                    .font(.system(size: 27, weight: .bold))
                    .kerning(-0.8)
                    .foregroundStyle(Tok.text)
                Text(countLine)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Tok.muted)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
        }
        .padding(.bottom, 11)
        .topGlass(heavy: true)
    }

    @ViewBuilder private var content: some View {
        if app.savedUpcoming.isEmpty {
            emptyState
        } else {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(groups) { group in
                        Text(group.day.uppercased())
                            .font(.system(size: 10.5, weight: .bold))
                            .kerning(0.85)
                            .foregroundStyle(Tok.faint)
                            .padding(.top, 18)
                            .padding(.bottom, 9)
                        ForEach(group.events) { e in
                            Button { selected = e } label: { EventCard(event: e) }
                                .buttonStyle(.plain)
                            reminderRow(e)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "bookmark")
                .font(.system(size: 34))
                .foregroundStyle(Tok.muted)
            Text("Nothing saved yet")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Tok.text)
            Text("Tap the bookmark on any event and it is kept here, on this device.")
                .font(.system(size: 13.5))
                .foregroundStyle(Tok.muted)
        }
        .multilineTextAlignment(.center)
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// A real switch with a name, not a tappable row that only looks like one.
    /// Two hours is the lead time the notification is actually scheduled with,
    /// so the label says exactly what will happen.
    private func reminderRow(_ e: Event) -> some View {
        Toggle(isOn: Binding(get: { app.reminders.contains(e.id) },
                             set: { _ in app.toggleReminder(e) })) {
            Text("Remind me two hours before")
                .font(.system(size: 13))
                .foregroundStyle(Tok.muted)
        }
        .tint(Tok.accentFill)
        .padding(.horizontal, 4)
        .padding(.top, 11)
        .padding(.bottom, 16)
        .accessibilityLabel("Remind me two hours before \(e.title) starts")
    }

    private var countLine: String {
        let n = app.savedUpcoming.count
        guard n > 0 else { return "Nothing kept on this device yet" }
        return "\(n) \(n == 1 ? "event" : "events"), kept on this device"
    }

    private var groups: [DayGroup] {
        var order: [String] = []
        var byDay: [String: [Event]] = [:]
        for e in app.savedUpcoming {
            let key = dayLabel(e.startDate)
            if byDay[key] == nil {
                order.append(key)
                byDay[key] = []
            }
            byDay[key]?.append(e)
        }
        return order.map { DayGroup(day: $0, events: byDay[$0] ?? []) }
    }

    /// "Today", "Tomorrow", then "Saturday, 26/7". The numeric tail is there
    /// because a list of weekday names alone stops being readable once it runs
    /// past a week.
    private func dayLabel(_ d: Date?) -> String {
        guard let d else { return "Date to be announced" }
        let cal = Calendar.current
        let days = cal.dateComponents([.day],
                                      from: cal.startOfDay(for: .now),
                                      to: cal.startOfDay(for: d)).day ?? 0
        if days <= 0 { return "Today" }
        if days == 1 { return "Tomorrow" }
        let gb = Locale(identifier: "en_GB")
        let weekday = d.formatted(.dateTime.weekday(.wide).locale(gb))
        let date = d.formatted(.dateTime.day().month(.numeric).locale(gb))
        return "\(weekday), \(date)"
    }
}
