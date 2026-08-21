import SwiftUI

/// Layout constants for regular width, and nothing else.
///
/// Additive to `Theme.swift`. `Tok`, `R`, `S`, `F` and `Family` are identical on
/// both devices: a 17pt body is a 17pt body on an iPad, because type scales with
/// Dynamic Type rather than with screen size. The only token that differs at
/// regular width is the outer gutter, which is why it lives here rather than
/// becoming a second set of values inside `S`.
///
/// Nothing in this file is used at compact width. See `RootView`.
enum Pad {

    // MARK: Column widths
    //
    // Given to NavigationSplitView as ideal widths. The sidebar is narrower in
    // portrait because there is less to go round and the content column is the
    // one that suffers first.

    static let sidebarMin: CGFloat = 288
    static let sidebarIdeal: CGFloat = 300
    static let sidebarMax: CGFloat = 320

    static let detailMin: CGFloat = 380
    static let detailIdeal: CGFloat = 420

    /// The map's list column. Held narrow on purpose: the map is the thing that
    /// benefits from area, so every extra point goes to it.
    static let mapListMin: CGFloat = 320
    static let mapListIdeal: CGFloat = 340

    // MARK: The grid

    /// DO NOT LOWER THIS.
    ///
    /// At around 280 a second column fits on a 13 inch with the detail pane
    /// open, and the card breaks: the 68pt thumbnail plus the distance column
    /// squeeze the text block until the footer loses its price and its source.
    /// The two ranking axes have to stay legible at every width, so the floor
    /// holds and a wide single column is capped instead. That trade is the whole
    /// argument of section 3 of the handoff, and it is the trap the sibling app
    /// fell into on its own iPad grid.
    static let gridMin: CGFloat = 340

    /// Above this a single column stops being a card and becomes a thumbnail on
    /// the left, a distance on the right, and a lake in between.
    static let gridMax: CGFloat = 520

    static let gridGap: CGFloat = 20

    /// The outer gutter at regular width. `S.s5` reads as generous at 390pt and
    /// as cramped at 1024pt. Nothing inside a card changes.
    static func gutter(width: CGFloat) -> CGFloat {
        width >= 1300 ? S.s7 : S.s6
    }

    /// The narrowest window that can hold all three columns honestly.
    ///
    /// Derived rather than chosen, which is the point: a sidebar, a content
    /// column wide enough for one card at the floor, a detail pane at its
    /// minimum, and a gutter between and either side. Anything narrower is a
    /// three column layout pretending, and what it produces is a squeezed
    /// detail pane and a content column below the width its own cards need.
    ///
    /// It works out at 1092, which lands exactly where it should. Both iPad
    /// landscapes clear it (1194 and 1366) and both portraits do not (834 and
    /// 1024). So portrait pushes the detail like the phone, and landscape keeps
    /// the pane, and neither is a special case anybody had to name.
    static var paneMinimum: CGFloat {
        sidebarIdeal + gridMin + detailMin + 3 * S.s6
    }

    /// How many columns fit in the measure actually left after the sidebar and
    /// the detail pane, rather than in the screen width. Always at least one.
    static func columns(measure: CGFloat) -> Int {
        max(1, Int((measure + gridGap) / (gridMin + gridGap)))
    }

    /// One column's width, capped at `gridMax`.
    static func columnWidth(measure: CGFloat) -> CGFloat {
        let n = CGFloat(columns(measure: measure))
        return min(gridMax, (measure - (n - 1) * gridGap) / n)
    }

    /// The grid's total width, so a caller can centre it when the cap has made
    /// it narrower than the measure. This is what makes the 13 inch case with
    /// the detail pane open read as a column rather than as a stretched row.
    static func gridWidth(measure: CGFloat) -> CGFloat {
        let n = CGFloat(columns(measure: measure))
        return n * columnWidth(measure: measure) + (n - 1) * gridGap
    }
}

/// The four destinations, which are tabs at compact width and sidebar rows at
/// regular width.
///
/// An enum rather than the `Int` that `AppState.tab` uses, because a sidebar
/// selection binding wants something with a name, and because `tag(0)` reading
/// as "Discover" only works if you already know. `AppState.tab` stays as it is:
/// it is what `TabView` binds to and what deep links set, and changing it would
/// touch every screen for no gain.
enum Destination: Int, CaseIterable, Identifiable, Hashable {
    case discover = 0
    case map = 1
    case saved = 2
    case search = 3

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .discover: "Discover"
        case .map: "Map"
        case .saved: "Saved"
        case .search: "Search"
        }
    }

    /// The same symbols the tab bar uses, so the two layouts do not disagree
    /// about what a destination looks like.
    var symbol: String {
        switch self {
        case .discover: "house"
        case .map: "map"
        case .saved: "bookmark"
        case .search: "magnifyingglass"
        }
    }
}
