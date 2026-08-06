import SwiftUI

struct SavedView: View {
    @EnvironmentObject var app: AppState
    @State private var selected: Event?

    var body: some View {
        ZStack {
            Tok.bg.ignoresSafeArea()
            if app.savedUpcoming.isEmpty {
                VStack(spacing: 8) {
                    Text("🔖").font(.system(size: 40))
                    Text("Nothing saved yet").font(.system(size: 17, weight: .bold)).foregroundStyle(Tok.text)
                    Text("Tap the bookmark on any event to save it here.").font(.system(size: 13.5)).foregroundStyle(Tok.muted)
                }.multilineTextAlignment(.center).padding(40)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(groups, id: \.0) { day, evs in
                            Text(day).font(.system(size: 13, weight: .bold)).foregroundStyle(Tok.muted)
                                .padding(.top, 6)
                            ForEach(evs) { e in
                                VStack(spacing: 0) {
                                    Button { selected = e } label: { EventCard(event: e) }.buttonStyle(.plain)
                                    reminderRow(e)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 14).padding(.bottom, 40)
                }
            }
        }
        .safeAreaInset(edge: .top) {
            Text("Saved").font(.system(size: 27, weight: .heavy)).foregroundStyle(Tok.text)
                .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 14).padding(.vertical, 8)
                .background(Tok.bg)
        }
        .sheet(item: $selected) { EventDetailView(event: $0) }
    }

    private func reminderRow(_ e: Event) -> some View {
        HStack {
            Label("Remind me 2h before", systemImage: "bell").font(.system(size: 12.5)).foregroundStyle(Tok.muted)
            Spacer()
            Toggle("", isOn: Binding(get: { app.reminders.contains(e.id) }, set: { _ in app.toggleReminder(e) }))
                .labelsHidden().tint(Tok.accent)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(Tok.panel)
        .overlay(Rectangle().stroke(Tok.hairline, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 0))
        .padding(.top, -2)
    }

    private var groups: [(String, [Event])] {
        let dict = Dictionary(grouping: app.savedUpcoming) { e -> String in
            guard let d = e.startDate else { return "Date TBA" }
            return d.formatted(.dateTime.weekday(.wide).month(.wide).day())
        }
        return dict.sorted { ($0.value.first?.startDate ?? .distantFuture) < ($1.value.first?.startDate ?? .distantFuture) }
    }
}
