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

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(destination: destination)
                .navigationSplitViewColumnWidth(
                    min: Pad.sidebarMin,
                    ideal: Pad.sidebarIdeal,
                    max: Pad.sidebarMax)
        } content: {
            content
        } detail: {
            detail
        }
        // Balanced rather than prominent: at regular width the sidebar and the
        // content column are both permanently useful, and prominentDetail
        // collapses them in portrait, which is the one orientation where the
        // sidebar toggle matters most.
        .navigationSplitViewStyle(.balanced)
        // The map is the one destination whose detail is not an event, so a
        // selection carried into it would draw an event pane behind a map that
        // has nothing to do with it. Clearing on the way in is simpler than
        // teaching the detail column about destinations.
        .onChange(of: app.tab) { _, _ in
            if destination.wrappedValue == .map { selectedID = nil }
        }
    }

    @ViewBuilder private var content: some View {
        switch destination.wrappedValue {
        case .discover:
            PadFeedView(selectedID: $selectedID)
        case .map:
            PadMapList(selectedID: $selectedID)
                .navigationSplitViewColumnWidth(
                    min: Pad.mapListMin,
                    ideal: Pad.mapListIdeal,
                    max: Pad.mapListIdeal)
        case .saved:
            SavedView(padSelection: $selectedID)
        case .search:
            SearchView(padSelection: $selectedID)
        }
    }

    /// The map takes the detail column on its own destination, because the map
    /// is the thing that benefits from area and an event pane would be the
    /// smaller half of a screen given to a map.
    @ViewBuilder private var detail: some View {
        if destination.wrappedValue == .map {
            PadMapPane(selectedID: $selectedID)
        } else {
            DetailPane(selectedID: selectedID)
                .navigationSplitViewColumnWidth(
                    min: Pad.detailMin,
                    ideal: Pad.detailIdeal,
                    max: .infinity)
        }
    }
}
