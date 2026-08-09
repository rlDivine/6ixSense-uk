import SwiftUI

// MARK: - Client-side range matching
//
// On iPad the feed is always fetched with `range = .all` so the sidebar can show
// a live count for every WHEN row at once. The rows then filter locally.

extension EventService.Range {
    // Bucketed in the device's timezone so "today" and "this weekend" mean
    // the user's, whether they opened the app in Truro or in Thurso.
    fileprivate static let deviceCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        return c
    }()

    /// True when `date` falls inside this range. Undated events only survive `.all`.
    func matches(_ date: Date?, now: Date = .now) -> Bool {
        if self == .all { return true }
        guard let date else { return false }
        let cal = Self.deviceCalendar
        let today = cal.startOfDay(for: now)
        switch self {
        case .all:
            return true
        case .today:
            return cal.isDate(date, inSameDayAs: now)
        case .week:
            guard let end = cal.date(byAdding: .day, value: 7, to: today) else { return false }
            return date >= today && date < end
        case .weekend:
            let weekday = cal.component(.weekday, from: now) - 1      // 0 = Sunday
            let offset = weekday == 0 ? 0 : (6 - weekday + 7) % 7      // days until Saturday
            guard let saturday = cal.date(byAdding: .day, value: offset, to: today),
                  let monday = cal.date(byAdding: .day, value: weekday == 0 ? 1 : 2, to: saturday)
            else { return false }
            return date >= saturday && date < monday
        }
    }
}

extension EventService.Sort {
    /// Local re-sort. The server sorts too, but sorting in-place keeps the iPad
    /// segmented control instant instead of costing a network round-trip.
    func apply(_ events: [Event]) -> [Event] {
        switch self {
        case .nearest:
            return events.sorted {
                ($0.distanceKm ?? .greatestFiniteMagnitude) < ($1.distanceKm ?? .greatestFiniteMagnitude)
            }
        case .soonest:
            return events.sorted { ($0.startDate ?? .distantFuture) < ($1.startDate ?? .distantFuture) }
        }
    }
}

// MARK: - Imminence

enum PadWhen {
    /// True when the event starts today, in the device's own timezone.
    ///
    /// Computed here rather than read off `Fmt.when`, so the three iPad files
    /// depend only on the formatter's plain-string helpers and not on the shape
    /// of a tuple that belongs to the card.
    static func isToday(_ date: Date?) -> Bool {
        guard let date else { return false }
        return EventService.Range.deviceCalendar.isDate(date, inSameDayAs: .now)
    }
}

// MARK: - Grid geometry (handoff section 5)

/// Everything the iPad grid needs in order to lay itself out, derived from the
/// width the grid was actually handed and from nothing else.
///
/// Not the device model, not `UIScreen`, not the size class. On iPadOS the app
/// can be two thirds of the screen in Split View, a floating panel in Slide
/// Over, or any width at all under Stage Manager, and the only honest input is
/// the width the layout system just proposed. A rotation re-proposes a new
/// width and this simply runs again, which is why nothing here needs an
/// orientation observer and why orientation must never be locked.
struct GridMetrics {
    /// Padding either side of the grid, inside the content column.
    static let horizontalPadding: CGFloat = 22
    /// Gap between cells, on both axes.
    static let spacing: CGFloat = 18
    /// Roughly one column per this much available width. Tuned so a 1180pt
    /// landscape iPad lands on three columns with the detail pane closed
    /// (896pt of content) and two with it open (520pt), which is the handoff's
    /// specified behaviour.
    static let widthPerColumn: CGFloat = 300
    /// Below this *cell* width the editorial card (option 1d) stops working: an
    /// 84pt thumbnail plus the 36pt bookmark gutter leaves about 70pt of text,
    /// and the footer drops price and source. At or under it the grid switches
    /// to the index card (option 1f), which spends the whole cell on the title
    /// and the footer and carries a 4pt category spine instead of a photo.
    static let compactCardBelow: CGFloat = 260

    /// The width this was computed from, kept for callers that want to reason
    /// about the column rather than the cell.
    let available: CGFloat
    let columns: Int
    /// The width one card will actually be drawn at. This, not the screen and
    /// not the column, is what decides which card variant the grid uses.
    let cellWidth: CGFloat

    init(available: CGFloat) {
        let w = max(0, available)
        let n = max(1, min(4, Int((w / Self.widthPerColumn).rounded())))
        let usable = max(0, w - Self.horizontalPadding * 2 - Self.spacing * CGFloat(n - 1))
        self.available = w
        self.columns = n
        self.cellWidth = usable / CGFloat(n)
    }

    /// True when the grid should render the index card rather than the
    /// editorial one. Two up beside an open detail pane on a 1180pt iPad gives
    /// a cell of about 229pt and lands here; three up with the pane closed
    /// gives about 272pt and does not.
    var usesCompactCard: Bool { cellWidth < Self.compactCardBelow }

    var gridItems: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: Self.spacing), count: columns)
    }
}

// MARK: - Sidebar primitives (handoff section 5)

/// A sidebar row: 42pt tall inside a 44pt hit area, leading icon or colour dot,
/// title, and an optional live count badge.
///
/// The selected row is `Tok.activeBg` with a `Tok.activeFg` label. It is never
/// a hardcoded white: on dark the selected fill is near white and a white label
/// on it is invisible, which is a bug this file has shipped before.
struct SideRow: View {
    var icon: String? = nil
    var dot: Color? = nil
    let title: String
    var count: Int? = nil
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 11) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 15.5, weight: .semibold))
                        .frame(width: 20)
                } else if let dot {
                    Circle().fill(dot).frame(width: 9, height: 9).frame(width: 20)
                }
                Text(title)
                    .font(.system(size: 15, weight: active ? .bold : .semibold))
                    .lineLimit(1)
                Spacer(minLength: 6)
                if let count {
                    CountBadge(count: count, active: active)
                }
            }
            .foregroundStyle(active ? Tok.activeFg : Tok.text)
            .padding(.horizontal, 12)
            .frame(height: 42)
            .frame(maxWidth: .infinity)
            .background(active ? Tok.activeBg : Color.clear, in: RoundedRectangle(cornerRadius: 11))
            .contentShape(RoundedRectangle(cornerRadius: 11))
            .padding(.vertical, 1)      // 42 + 2 gives the 44pt minimum target
        }
        .buttonStyle(.plain)
        .accessibilityLabel(count == nil ? title : "\(title), \(count!) events")
    }
}

/// The live count on a sidebar row.
///
/// On a selected row the pill flips to a translucent version of the row's own
/// foreground, which on light is white on navy and on dark is near black on
/// near white. Both stay legible, and neither hardcodes a colour.
struct CountBadge: View {
    let count: Int
    var active: Bool = false
    var body: some View {
        Text("\(count)")
            .font(.system(size: 12, weight: .bold))
            .monospacedDigit()
            .foregroundStyle(active ? Tok.activeFg : Tok.muted)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .frame(minWidth: 28)
            .background(active ? Tok.activeFg.opacity(0.22) : Tok.panel2, in: Capsule())
    }
}

/// Uppercase section label above the Sort, When and Category blocks.
/// `Tok.muted` rather than `Tok.faint`, because the sidebar sits on a material
/// and the faintest of the three text weights is not solved against one.
struct SidebarSectionHeader: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10.5, weight: .heavy))
            .kerning(0.85)
            .foregroundStyle(Tok.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 6)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Grid cell

/// One cell of the iPad grid.
///
/// The card itself is `EventCard`, the same component the phone list uses, so
/// there is exactly one card in the app rather than an iPad copy that drifts.
/// `compact` selects the index variant, and the caller decides that from the
/// cell width, never from the device.
///
/// Deliberately not wrapped in a `Button`. `EventCard` carries its own bookmark
/// button, and a control nested inside another control either swallows the
/// inner tap or collapses two accessibility elements into one. The tap gesture
/// sits alongside the bookmark instead, which is how the map rail row already
/// works in this codebase.
struct IPadEventCard: View {
    /// Matches the radius `EventCard` clips itself to, so the selection ring
    /// sits on the card's own edge rather than beside it.
    private static let radius: CGFloat = 14

    let event: Event
    var compact: Bool = false
    var highlighted: Bool = false
    let open: () -> Void

    var body: some View {
        EventCard(event: event, compact: compact)
            .overlay(
                RoundedRectangle(cornerRadius: Self.radius)
                    .stroke(highlighted ? Tok.accent : Color.clear, lineWidth: 2)
            )
            .contentShape(RoundedRectangle(cornerRadius: Self.radius))
            .onTapGesture(perform: open)
            .accessibilityElement(children: .contain)
            .accessibilityAction(named: Text("Open event"), open)
    }
}
