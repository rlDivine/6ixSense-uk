import SwiftUI

/// The iPad layout: a sidebar where the tab bar was, a content column that
/// lists, and a detail column that shows the one thing you picked.
///
/// That shape is not decoration. It is what iPadOS users already know from
/// Mail, Notes, Files and Photos, and it is what makes an iPad worth using for
/// this app, because the app is a ranking of events by distance and imminence
/// and the activity it supports is comparing them. Comparing is easier when the
/// list stays on screen beside what you selected.
///
/// The tab bar is replaced, not reshaped. A sidebar of four rows is not a
/// vertical tab bar; it is the navigation, and the destinations happen to be
/// the same four.
struct PadRootView: View {
    @EnvironmentObject var app: AppState

    /// Mirrors `AppState.tab` rather than replacing it.
    ///
    /// `tab` is an Int because that is what `TabView` binds to at compact
    /// width, and it is what anything else setting a destination already
    /// writes to. Keeping one source of truth and projecting it into a named
    /// enum here means a destination set from anywhere lands correctly in both
    /// layouts, and that switching between them across a Split View drag does
    /// not lose where you were.
    private var destination: Binding<Destination> {
        Binding(
            get: { Destination(rawValue: app.tab) ?? .discover },
            set: { app.tab = $0.rawValue }
        )
    }

    /// The selection the detail pane draws. Held here rather than inside each
    /// content view, because it is the split view's state: it survives changing
    /// destination, which is what lets somebody look at an event, glance at the
    /// map, and come back to it still selected.
    @State private var selectedID: String?

    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    /// The pushed detail, in the narrow layout. Empty means the list is showing.
    ///
    /// A path rather than a Bool, because NavigationStack owns the back button
    /// and the swipe from the edge, and both of those write here. Trying to
    /// drive a push from `selectedID` alone leaves the two out of step the
    /// moment somebody uses the gesture rather than the button.
    @State private var path: [String] = []

    /// THE SECOND LAYOUT DECISION, and the only one below RootView.
    ///
    /// Three columns need 1092 points to be honest about it. Both iPad
    /// landscapes have that, neither portrait does, so portrait pushes the
    /// detail the way the phone does and landscape keeps it beside the list.
    ///
    /// This is not a rule being bent. The rule is that no SCREEN branches on
    /// size, so that Split View and Stage Manager are correct without being
    /// thought about; every view below here is still size agnostic and is
    /// handed a plain selection binding either way. What differs is only where
    /// the split view puts the detail, which is the split view's own business.
    ///
    /// Portrait was previously given three columns and squeezed them. The
    /// visible symptom was a back button at the top left that did nothing,
    /// because there was a navigation bar with nowhere to go back to.
    var body: some View {
        GeometryReader { geo in
            if geo.size.width >= Pad.paneMinimum {
                wideLayout
            } else {
                narrowLayout
            }
        }
        // The map is the one destination whose detail is not an event, so a
        // selection carried into it would draw an event pane behind a map that
        // has nothing to do with it.
        .onChange(of: app.tab) { _, _ in
            selectedID = nil
            path = []
        }
    }

    // MARK: Wide, landscape: sidebar, list, pane

    private var wideLayout: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(destination: destination)
                .navigationSplitViewColumnWidth(
                    min: Pad.sidebarMin,
                    ideal: Pad.sidebarIdeal,
                    max: Pad.sidebarMax)
        } content: {
            column(selection: $selectedID, hasPane: true)
        } detail: {
            if destination.wrappedValue == .map {
                // The map takes the detail column on its own destination,
                // because the map is what benefits from area and an event pane
                // would be the smaller half of a screen given to a map.
                PadMapPane(selectedID: $selectedID)
            } else {
                DetailPane(selectedID: selectedID)
                    .navigationSplitViewColumnWidth(
                        min: Pad.detailMin,
                        ideal: Pad.detailIdeal,
                        max: .infinity)
            }
        }
        // Balanced rather than prominent: at this width the sidebar and the
        // list are both permanently useful, and prominentDetail buries them.
        .navigationSplitViewStyle(.balanced)
    }

    // MARK: Narrow, portrait: sidebar and one column that pushes

    /// Two columns, and the second one is a stack. Selecting pushes the event
    /// full width and the back button returns, which is what the phone does and
    /// what a portrait iPad has the room for.
    private var narrowLayout: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(destination: destination)
                .navigationSplitViewColumnWidth(
                    min: Pad.sidebarMin,
                    ideal: Pad.sidebarIdeal,
                    max: Pad.sidebarMax)
        } detail: {
            NavigationStack(path: $path) {
                column(selection: pushed, hasPane: false)
                    .navigationDestination(for: String.self) { id in
                        DetailPane(selectedID: id)
                            .navigationBarTitleDisplayMode(.inline)
                            // Two controls at the top left is one too many.
                            //
                            // The split view puts a sidebar toggle in the
                            // detail column's bar, which is right for the list
                            // and wrong the moment something is pushed on top
                            // of it: the toggle and the back chevron sit side
                            // by side as a pair of near identical circles, and
                            // the honest reading of that is two back buttons.
                            //
                            // Removed here rather than everywhere, so the list
                            // keeps its toggle and the sidebar stays reachable
                            // one tap away.
                            .toolbar(removing: .sidebarToggle)
                    }
            }
        }
    }

    /// Selection, expressed as a push.
    ///
    /// Reading from the path as well as writing to it is what keeps the back
    /// button and the edge swipe honest: when either of them pops, this reports
    /// nil without anybody having to notice and clear a separate flag.
    private var pushed: Binding<String?> {
        Binding(
            get: { path.last },
            set: { id in path = id.map { [$0] } ?? [] }
        )
    }

    /// The list for the current destination, given wherever selection should go.
    ///
    /// One function for both layouts, so a screen cannot behave differently in
    /// portrait and landscape by accident. The only thing that changes is the
    /// binding it is handed.
    /// - Parameter hasPane: whether a detail column exists beside this one.
    ///   Only the map cares, and it cares a lot.
    @ViewBuilder private func column(selection: Binding<String?>,
                                     hasPane: Bool) -> some View {
        switch destination.wrappedValue {
        case .discover:
            PadFeedView(selectedID: selection)
        case .map:
            if hasPane {
                // No column width here. PadMapList sets its own, and applying
                // it twice means two modifiers arguing about one number.
                PadMapList(selectedID: selection)
            } else {
                // The PHONE map, deliberately, and this is the one place the
                // two layouts genuinely differ rather than differing in width.
                //
                // PadMapList is one half of a two column screen: a list of what
                // is on the map, with no map. Without the pane beside it, it is
                // a map destination showing no map, which is absurd. The phone
                // map is a complete map screen built for exactly this width,
                // tray and all, and it already ships. Reaching for the built
                // thing beats splitting a screen with nowhere to put the second
                // half.
                EventMapView()
            }
        case .saved:
            SavedView(padSelection: selection)
        case .search:
            SearchView(padSelection: selection)
        }
    }
}
