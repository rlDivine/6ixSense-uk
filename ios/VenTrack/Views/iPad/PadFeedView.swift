import SwiftUI

/// Discover, as the content column of the split view.
///
/// The phone's `DiscoverView` and this file are the same feed with two
/// differences, and it is worth naming them because everything else is shared
/// on purpose:
///
///   THE CARDS ARE A GRID rather than a column, because a `.row` card at 1000pt
///   is a thumbnail on the left, a distance on the right, and a lake in between.
///   The grid has a floor and a ceiling, and the column count falls out of the
///   width actually left after the sidebar and the detail pane.
///
///   TAPPING SELECTS rather than presents. On iPad the detail is a pane that is
///   already on screen, so a card's job is to change what is in it. That is the
///   single biggest thing the iPad layout buys: comparing two events costs
///   nothing, where on the phone it means closing one sheet and opening another.
///
/// What is NOT here: the large title. The town lives in the sidebar at regular
/// width, because it applies to every destination rather than to this screen,
/// and a feed that repeated it would say the same thing twice. See the note on
/// `FeedControls`, which is the half the two layouts share.
struct PadFeedView: View {
    /// Which event the detail pane is showing. `Event.id` is a String, and the
    /// binding carries the id rather than the `Event` so the pane survives a
    /// reload replacing every value in `app.events` with an equal one.
    @Binding var selectedID: String?

    @EnvironmentObject var app: AppState

    var body: some View {
        ZStack {
            // Painted once, out here, so the geometry reader below is only ever
            // measuring. A column with no ground of its own borrows the
            // system's, which is not this app's near-neutral.
            Tok.bg.ignoresSafeArea()

            // THE MEASURE IS THIS COLUMN, NOT THE SCREEN. Everything about the
            // grid depends on that distinction: the same 13 inch iPad is a two
            // column feed with the detail pane closed and a one column feed with
            // it open, and the screen width is identical in both cases.
            GeometryReader { geo in
                let gutter = Pad.gutter(width: windowWidth ?? geo.size.width)
                let measure = max(0, geo.size.width - gutter * 2)
                content(measure: measure, gutter: gutter)
            }
        }
    }

    // MARK: The gutter, and why it is not measured from this column
    //
    // `Pad.gutter` asks about the DISPLAY, not the column: it is the margin that
    // reads as generous at 390pt and cramped at 1024, and the thing it is judging
    // is how big the device feels, which does not change when a pane opens.
    // Measured from the column instead, a 13 inch with the detail pane open
    // would quietly step down to the 11 inch margin halfway through a session,
    // and the two sizes would never agree on their own margin.
    //
    // The window rather than the screen, because in Split View multitasking the
    // app owns a slice of the display and the slice is what it is laying out in.

    /// One definition, in `Pad`, because `PadRootView` needs the same number to
    /// pick the layout and two readings of the window would be two things to
    /// keep in step. Nil during previews and snapshotting, where the caller
    /// falls back to the column: wrong by at most one step of the scale, and
    /// never wrong enough to be worth crashing over.
    private var windowWidth: CGFloat? { Pad.windowWidth }

    // MARK: Which screen

    /// Which of the four screens the column is showing. Worked out in one place
    /// rather than inline, matching `DiscoverView`, so the two cannot drift on
    /// what counts as empty.
    ///
    /// The type is `Screen` and the generic below is `Content` for the same
    /// reason it is on the phone: `S` is the spacing scale, and a type parameter
    /// of that name shadows it for a whole function body without a warning.
    private enum Screen {
        case loading
        case failed(String)
        case empty
        case feed
    }

    private var screen: Screen {
        if app.loading && app.events.isEmpty { return .loading }
        if let err = app.errorMessage, app.events.isEmpty { return .failed(err) }
        if app.visibleEvents.isEmpty { return .empty }
        return .feed
    }

    @ViewBuilder private func content(measure: CGFloat, gutter: CGFloat) -> some View {
        switch screen {
        case .loading:
            stateScreen(gutter: gutter) { LoadingState(place: app.placeName) }
        case .failed(let err):
            stateScreen(gutter: gutter) { ErrorState(message: err) { Task { await app.load() } } }
        case .empty:
            // `widen` is left at its default, which is exactly "try this week".
            // Widening stops at the free window when locked, so the button
            // always does what it says rather than opening a purchase sheet.
            stateScreen(gutter: gutter) {
                EmptyState(place: app.placeName) {
                    app.category = "All"
                    app.range = app.unlocked ? .all : .week
                    Task { await app.load() }
                }
            }
        case .feed:
            feed(measure: measure, gutter: gutter)
        }
    }

    // MARK: The feed

    /// The controls, the section header, the cards and the gate, in one vertical
    /// scroll view.
    ///
    /// The filters are the first rows IN the scroll rather than pinned above it,
    /// exactly as on the phone. They go away because they are scrolled away and
    /// come back because they are scrolled back, which costs no state, no
    /// gesture reading and no animation. See the long note on `DiscoverView` for
    /// the three pinned versions that lost to a changing top inset.
    private func feed(measure: CGFloat, gutter: CGFloat) -> some View {
        let events = app.visibleEvents
        let rest = Array(events.dropFirst())

        return ScrollView {
            LazyVStack(alignment: .leading, spacing: S.s3) {
                FeedControls(gutter: gutter)
                FeedSectionHeader(gutter: gutter)

                // The cards, as one block that can be centred as a unit. The
                // feature and the grid have to move together: aligning the
                // feature to the measure and the grid to its own capped width
                // would leave the top card overhanging everything under it.
                VStack(spacing: Pad.gridGap) {
                    if let feature = events.first {
                        card(feature, style: .feature)
                    }
                    grid(rest, measure: measure)
                }
                .frame(width: Pad.gridWidth(measure: measure))
                // CENTRED WHEN THE CEILING BITES. `Pad.gridWidth` equals the
                // measure whenever the columns divide it exactly, so this frame
                // does nothing at all in the ordinary case. It earns its keep on
                // a 13 inch with the detail pane open: 572pt is one column, one
                // column is capped at 520, and the 52pt left over belongs on
                // both sides rather than trailing off the right. That is the
                // difference between a column and a stretched row.
                .frame(maxWidth: .infinity, alignment: .center)

                FreeWindowGate(gutter: gutter)
            }
            .padding(.top, S.s3)
            .padding(.bottom, S.s6)
        }
        .refreshable { await app.load() }
    }

    /// The remaining events, in as many columns as the measure actually holds.
    ///
    /// The arithmetic is all in `Pad`, and it is worth restating what it means
    /// here. `Pad.columns` divides the measure by a 340pt floor: 452pt is one
    /// column, 832pt is two, and 1012pt is still two because a third would need
    /// 1068. `Pad.columnWidth` then caps each column at 520, above which a
    /// single card stops being a card. The floor is NOT negotiable: at around
    /// 280 a second column fits on a 13 inch and the card breaks, losing its
    /// price and its source out of the footer, which are two of the facts a
    /// person is actually comparing.
    ///
    /// Fixed columns rather than adaptive ones, because the count and the width
    /// have already been solved above and `.adaptive` would solve them again to
    /// a different answer.
    private func grid(_ events: [Event], measure: CGFloat) -> some View {
        let width = Pad.columnWidth(measure: measure)
        let columns = Array(
            repeating: GridItem(.fixed(width), spacing: Pad.gridGap, alignment: .top),
            count: Pad.columns(measure: measure)
        )
        return LazyVGrid(columns: columns, alignment: .center, spacing: Pad.gridGap) {
            ForEach(events) { event in
                card(event, style: .row)
            }
        }
    }

    /// One card, as a selection rather than a presentation.
    ///
    /// `tray: true` on every card, and it is doing two jobs at once because the
    /// card names them with one flag. The one that is required: the container
    /// owns the horizontal gutter, so the card does not add its own 20pt inside
    /// a column that has already been sized to the point. The one that comes
    /// along with it: the title reserves both its lines whether or not it needs
    /// them. In a grid that is exactly right, since two cards side by side with
    /// ragged bottoms is the thing it exists to prevent. In the one column case
    /// it costs a blank line under a short title, which is the cheaper of the
    /// two mistakes.
    private func card(_ event: Event, style: EventCardStyle) -> some View {
        let isSelected = selectedID == event.id
        return Button {
            selectedID = event.id
        } label: {
            EventCard(event: event, style: style, tray: true)
                // SELECTION IS NOT THE ACCENT. Red means "this is on today" and
                // nothing else, and a selected card in a feed of twenty would
                // spend that meaning in one tap. So selection is the card's own
                // hairline, made loud: same radius, same path, 2pt of `muted`
                // laid straight over the 1pt border that is already there.
                // Stroked rather than inset so it replaces that hairline instead
                // of doubling it, and the point that falls outside the frame
                // lands in the 20pt grid gap where there is nothing to nibble.
                .overlay(
                    RoundedRectangle(cornerRadius: R.card)
                        .stroke(isSelected ? Tok.muted : Color.clear, lineWidth: 2)
                )
        }
        .buttonStyle(PressableRow())
        // The card is a rounded rectangle, so its hit region and its pointer
        // highlight should be too. Without this both are the bounding box and
        // the highlight shows square corners on a round card.
        .contentShape(RoundedRectangle(cornerRadius: R.card))
        .hoverEffect(.highlight)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: The other three screens

    /// One of the three non-feed screens, with the filter controls kept above
    /// it.
    ///
    /// The controls have to stay usable while the feed is loading or empty. An
    /// empty state whose only remedy is a control the empty state itself removed
    /// is a dead end, and a loading screen that will not let you change your
    /// mind until it finishes is just a slower one.
    ///
    /// These do not scroll. Every row above the state is a definite height, so
    /// the rest of the column belongs to the state and saying so leaves nothing
    /// for the layout to work out.
    @ViewBuilder private func stateScreen<Content: View>(
        gutter: CGFloat,
        @ViewBuilder _ body: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: S.s3) {
            FeedControls(gutter: gutter)
            body().frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(.top, S.s3)
    }
}
