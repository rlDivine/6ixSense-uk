import SwiftUI

/// Everything the user bookmarked, grouped by day under an uppercase overline,
/// with a reminder switch under each card. There is no account: this list lives
/// on the device, and the subtitle says so out loud rather than leaving the
/// user to wonder where it went after a reinstall.
struct SavedView: View {
    @EnvironmentObject var app: AppState
    @State private var selected: Event?

    /// Set by the iPad layout, which owns a detail pane and therefore does not
    /// want a sheet. When present, choosing an event reports its id here and
    /// the pane draws it; when nil, this screen presents its own sheet exactly
    /// as it always has on the phone.
    ///
    /// An optional binding rather than a size class check, because this screen
    /// should not know what device it is on. One decision about layout is made
    /// in RootView and nothing below it branches.
    var padSelection: Binding<String?>?


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
        .topChrome()
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
                            Button { choose(e) } label: { EventCard(event: e) }
                                .buttonStyle(PressableRow())
                            reminderRow(e)
                        }
                    }
                    allowanceNote.padding(.top, 6)
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
    ///
    /// Reminders are part of the unlock. When locked the switch is replaced
    /// rather than disabled: a greyed-out switch says "broken", a row that
    /// names its padlock says "this is for sale", and only one of those is
    /// true.
    @ViewBuilder private func reminderRow(_ e: Event) -> some View {
        if app.unlocked {
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
        } else {
            Button { app.unlockPrompt = .reminders } label: {
                HStack(spacing: 7) {
                    LockBadge()
                    Text("Remind me two hours before")
                        .font(.system(size: 13))
                        .foregroundStyle(Tok.muted)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Tok.muted)
                }
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 4)
            .padding(.top, 11)
            .padding(.bottom, 16)
            .accessibilityLabel("Reminders for \(e.title) are part of the paid unlock")
        }
    }

    /// The standing note about the free allowance, under the list. Shown while
    /// locked whether or not the allowance is spent, because knowing the limit
    /// before hitting it is the difference between an offer and a surprise.
    @ViewBuilder private var allowanceNote: some View {
        if !app.unlocked {
            Button { app.unlockPrompt = .saving } label: {
                HStack(alignment: .top, spacing: 9) {
                    Image(systemName: "bookmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Tok.link)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(app.savedIsFull
                             ? "That is all \(AppState.freeSaveLimit) free saves used"
                             : "\(app.savesRemaining) of \(AppState.freeSaveLimit) free saves left")
                            .font(.system(size: 13.5, weight: .semibold))
                            .foregroundStyle(Tok.text)
                        Text("Unlock VenTrack once to keep as many as you like, with reminders.")
                            .font(.system(size: 12))
                            .foregroundStyle(Tok.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                .padding(13)
                .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
        }
    }

    private var countLine: String {
        let n = app.savedUpcoming.count
        guard n > 0 else { return "Nothing kept on this device yet" }
        let noun = n == 1 ? "event" : "events"
        return "\(n) \(noun), kept on this device"
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
        let date = d.formatted(.dateTime.day().month(.defaultDigits).locale(gb))
        return "\(weekday), \(date)"
    }

    /// The one place selection is decided, so the sheet and the pane cannot
    /// drift apart.
    private func choose(_ e: Event) {
        if let padSelection {
            padSelection.wrappedValue = e.id
        } else {
            selected = e
        }
    }

}
