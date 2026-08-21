import SwiftUI
import MapKit
import CoreLocation

// The Map destination at regular width, as two views rather than one screen.
//
// The phone's map is a single view because a phone has one screen: the map, the
// search field, the preview card and the tray of events all have to share it,
// and the tray earns its keep by collapsing so the map can be browsed. Given a
// real second column none of that trade exists any more, so this file is the
// phone screen taken apart at its natural seam. `PadMapList` is the content
// column, `PadMapPane` is the detail, and neither knows anything about the
// other beyond the selection they share.
//
// THE BOTTOM TRAY DOES NOT COME TO IPAD, AND MUST NOT BE REBUILT HERE.
//
// It is worth saying why, because a tray is the obvious thing to port and it
// would compile perfectly well. The tray exists to buy back map area by going
// away; a persistent column never took the map's area in the first place. It
// shows four to six events at once instead of one and a peek, it needs no
// gesture and no open/closed state, and there is no moment where the thing you
// are reading is covering the thing you are reading it about. Every argument
// for the tray is an argument about sharing one screen. There is no shared
// screen here.
//
// The two way binding is the one the phone already has. Selecting a row sets
// `selectedID`, which is what `EventMapKit` reads to centre and grow the pin;
// tapping a pin writes the same property back, which is what the list reads to
// mark the row and scroll it into view. One property, both directions, no
// second mechanism.

/// What both columns agree is "on the map".
///
/// The list and the pins have to be the same set of events or the header lies,
/// so the filter and the cap live in one place rather than being written twice
/// and drifting apart. Both numbers are the phone's: `visibleEvents` is already
/// category filtered, an event with no coordinate cannot be drawn, and 250 is
/// the ceiling the phone map holds itself to.
private enum PadMapRules {
    /// MKMapView clusters natively so the map itself would survive more, but
    /// the cap is not really about the map: it is about not building a lazy
    /// stack of several thousand cards next to it for a list nobody scrolls to
    /// the bottom of.
    static let maxPins = 250

    static func mapped(_ events: [Event]) -> [Event] {
        Array(events.filter(\.hasCoordinate).prefix(maxPins))
    }
}

// MARK: - The list column

/// Everything currently on the map, as a column beside it.
///
/// Compact cards, which is the whole reason this fits: no thumbnail column
/// means the title gets the full measure, and four to six rows stay readable in
/// 340pt where a row card would have about 190pt left for a 20pt title after
/// its 68pt thumbnail and its distance column.
struct PadMapList: View {
    @Binding var selectedID: String?
    @EnvironmentObject var app: AppState

    /// The one sheet left on this screen.
    ///
    /// Section 4 of the handoff presents `EventDetailView` as a pane rather
    /// than a sheet, and that is right for the feed, where the third column is
    /// free to hold it. On the map the detail column is the map, so there is no
    /// pane to put an event in and a sheet is the only route to the full
    /// listing. Both columns keep their own, because both are usable on their
    /// own and neither should depend on the other having been built.
    @State private var detail: Event?

    private var events: [Event] { PadMapRules.mapped(app.visibleEvents) }

    var body: some View {
        ScrollViewReader { proxy in
            ZStack {
                Tok.bg.ignoresSafeArea()
                list
            }
            // The other half of the binding. A pin tapped out on the far side
            // of the map selects a row that may be forty rows down, and a
            // selection you cannot see is not a selection.
            //
            // No anchor on purpose: `scrollTo` with no anchor moves the minimum
            // needed to bring the row into view, so a row that is already on
            // screen does not move at all. Centring it instead would mean every
            // tap in the list yanked the list out from under the finger that
            // tapped it.
            .onChange(of: selectedID) { _, id in
                guard let id else { return }
                withAnimation(.easeInOut(duration: 0.22)) { proxy.scrollTo(id) }
            }
        }
        // Stated here so the column carries its own measure. The map is the
        // thing that benefits from area, so this holds narrow and every extra
        // point of the window goes to the pane. A parent split view is free to
        // override it.
        .navigationSplitViewColumnWidth(min: Pad.mapListMin, ideal: Pad.mapListIdeal)
        .sheet(item: $detail) { EventDetailView(event: $0) }
    }

    private var list: some View {
        ScrollView {
            // Cards carry their own horizontal gutter, exactly as they do in
            // the feed, so the header below has to match it rather than the
            // stack imposing one on both.
            LazyVStack(alignment: .leading, spacing: S.s3) {
                header
                if events.isEmpty {
                    emptyLine
                } else {
                    ForEach(events) { row($0) }
                }
            }
            .padding(.top, S.s3)
            .padding(.bottom, S.s6)
        }
    }

    // MARK: Header

    /// The phone's tray header, given the room a column has and the tray did
    /// not. There it is one 12.5pt line squeezed between the map and the cards;
    /// here the label and the count separate into an overline and a heading,
    /// which is the same information read at a glance instead of scanned for.
    private var header: some View {
        VStack(alignment: .leading, spacing: S.s1) {
            Text("IN VIEW")
                .font(F.caption)
                .kerning(0.77)
                .foregroundStyle(Tok.faint)
            Text(countLine)
                .font(F.headline)
                .foregroundStyle(Tok.text)
        }
        .padding(.horizontal, S.s5)
        .padding(.bottom, S.s1)
        // One utterance rather than two, so VoiceOver says "in view, 8 events"
        // and moves on to the first card.
        .accessibilityElement(children: .combine)
    }

    private var countLine: String {
        events.count == 1 ? "1 event" : "\(events.count) events"
    }

    /// Not the full `EmptyState`, which is a headline, a symbol and two buttons
    /// built for a screen of its own. In a 340pt column beside a live map that
    /// would be a wall where a sentence will do, and the remedies it offers
    /// (clear the filters, widen the dates) live in the feed's own controls
    /// rather than here.
    private var emptyLine: some View {
        Text("None of these events carry a location, so there is nothing to put on the map.")
            .font(F.callout)
            .foregroundStyle(Tok.muted)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, S.s5)
    }

    // MARK: Rows

    private func row(_ e: Event) -> some View {
        let isSelected = selectedID == e.id
        return Button { tap(e) } label: {
            EventCard(event: e, style: .compact)
                .overlay { selectionRing(on: isSelected) }
        }
        // The feed's button style: opacity on press, never scale. A column of
        // rows where every row grows and shrinks under the pointer reads as
        // unstable, and that is as true beside a map as it is in the feed.
        .buttonStyle(PressableRow())
        // Pointer support. A trackpad on an iPad expects the row under the
        // cursor to say so before it is clicked.
        .hoverEffect(.highlight)
        // Explicit, so `scrollTo` above has something stable to aim at even
        // when the feed reorders under it.
        .id(e.id)
        .accessibilityLabel(rowLabel(e))
        .accessibilityHint(isSelected ? "Opens the event" : "Shows this event on the map")
        .accessibilityAddTraits(isSelected ? AccessibilityTraits.isSelected : [])
    }

    /// Selection is monochrome, per the token note: `activeBg` and never the
    /// accent, so red goes on meaning "this is on today" in the overline three
    /// rows down rather than being spent on which row you are looking at.
    ///
    /// A ring rather than a fill because the card already owns its fill, and
    /// inset by the card's own gutter because the overlay covers the padded
    /// frame rather than the box drawn inside it.
    @ViewBuilder private func selectionRing(on selected: Bool) -> some View {
        if selected {
            RoundedRectangle(cornerRadius: R.card)
                .stroke(Tok.activeBg, lineWidth: 2)
                .padding(.horizontal, S.s5)
        }
    }

    /// Selecting moves the map, and that is all a first tap does: the point of
    /// two columns is that you can look at the pin without losing the list.
    /// Tapping the row that is already selected has nothing left to move,
    /// though, and a tap that does visibly nothing reads as a broken row, so
    /// the second one opens the event.
    private func tap(_ e: Event) {
        if selectedID == e.id { detail = e } else { selectedID = e.id }
    }

    /// Spelled out rather than left to the card's own text.
    ///
    /// The card reads well enough element by element, but as a single row label
    /// it would arrive as a bare title with the two things a person is actually
    /// choosing on, when it is and how far away it is, left to be hunted for.
    /// Same two ranking axes the card draws, in the same order.
    private func rowLabel(_ e: Event) -> String {
        var parts = [e.title, Fmt.when(e.startDate).text]
        if let venue = e.venue, !venue.isEmpty { parts.append(venue) }
        if e.distanceKm != nil { parts.append("\(Fmt.distance(e.distanceKm)) away") }
        return parts.joined(separator: ", ")
    }
}

// MARK: - The detail column

/// The map, filling the pane.
///
/// Three pieces of chrome and nothing else: the area search, the locate button
/// and the preview card for whatever is selected. What is missing compared with
/// the phone is the tray and the scrim beneath it, and the scrim goes because
/// the tray does. It was there to keep the tray's cards legible over a pale
/// stretch of map; with no cards on the map there is nothing to hold contrast
/// for, and a permanent dark band along the bottom of a large map is just a
/// band.
struct PadMapPane: View {
    @Binding var selectedID: String?
    @EnvironmentObject var app: AppState

    /// Bumped by the locate button. `EventMapKit` watches the value rather than
    /// taking a closure, so a recenter is a change of state and survives the
    /// view being rebuilt mid tap.
    @State private var recenterTick = 0
    /// The centre of whatever the map is showing, reported back by the map.
    /// This is what "Search this area" acts on.
    @State private var visibleCentre: CLLocationCoordinate2D?
    @State private var searchingArea = false
    /// See the note on the same property in `PadMapList`. The map is the detail
    /// column, so a listing opened from here has nowhere to go but a sheet.
    @State private var detail: Event?

    private var events: [Event] { PadMapRules.mapped(app.visibleEvents) }

    var body: some View {
        ZStack(alignment: .top) {
            // UIKit MKMapView wrapper, for the reason given in EventMapView:
            // SwiftUI's `Map` trips a Metal multisample assertion that freezes
            // the app on the current SDK. Nothing about that is device
            // specific, so the iPad uses the same wrapper.
            //
            // `onTapArea` is left at its default no-op, which is what its own
            // doc comment sanctions for this caller. A tapped pin already
            // writes `selectedID` back through the binding, and a tapped
            // cluster already zooms into itself; the callback exists to fill a
            // tray, and there is no tray to fill. A cluster on iPad therefore
            // zooms, and the list beside it narrows as the region does.
            EventMapKit(events: events,
                        selectedID: $selectedID,
                        showsUser: app.locAuthorized,
                        userCoordinate: app.origin,
                        recenterTick: recenterTick,
                        onRegionChange: { centre in visibleCentre = centre })
                .ignoresSafeArea()

            controls

            // The preview card survives to iPad where the tray does not, and
            // the difference is worth stating: it is anchored to one selection
            // rather than being a standing list, it costs its own footprint and
            // nothing more, and it is the only thing on this column that gets
            // you from a pin to the full listing.
            if let id = selectedID, let e = events.first(where: { $0.id == id }) {
                PiPCard(event: e) { detail = e }
                    // Clear of the controls row: 8 of top padding, a 48pt bar
                    // and 20 of air. Measured against the row below rather than
                    // guessed, so the two never touch at any Dynamic Type size
                    // the bar itself does not grow at.
                    .padding(.top, 76)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.22), value: selectedID)
        .sheet(item: $detail) { EventDetailView(event: $0) }
    }

    // MARK: Controls

    /// One row along the top: the area search on the left, the locate button
    /// hard right. The phone puts locate above the tray at the bottom because
    /// that is where the thumb is; a pane on an iPad has no such corner, so it
    /// sits opposite the search field where the design shows it.
    private var controls: some View {
        HStack(spacing: S.s3) {
            searchButton
            if canClear { clearButton }
            Spacer(minLength: S.s3)
            locateButton
        }
        .padding(.horizontal, S.s4)
        .padding(.top, S.s2)
    }

    /// A button rather than a text field: there is nothing to type, the query
    /// is "wherever I have just dragged to".
    ///
    /// Capped rather than filling the row, because the pane can be a thousand
    /// points wide and a search field that wide reads as a header bar for the
    /// whole screen rather than as a control acting on the region below it.
    private var searchButton: some View {
        Button { Task { await searchThisArea() } } label: {
            HStack(spacing: S.s2) {
                Image(systemName: searchingArea ? "clock" : "magnifyingglass")
                    .font(F.callout)
                    .foregroundStyle(Tok.muted)
                Text(searchingArea ? "Finding this area" : "Search this area")
                    .font(F.callout)
                    .foregroundStyle(searchingArea ? Tok.muted : Tok.text)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, S.s4)
            .frame(height: 48)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: R.button))
            .overlay(RoundedRectangle(cornerRadius: R.button).stroke(Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .frame(maxWidth: 420)
        .disabled(searchingArea || visibleCentre == nil)
        .accessibilityLabel("Search the area the map is showing")
    }

    private var clearButton: some View {
        Button { clearArea() } label: {
            Image(systemName: "xmark")
                .font(F.callout)
                .foregroundStyle(Tok.muted)
                .frame(width: 48, height: 48)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: R.button))
                .overlay(RoundedRectangle(cornerRadius: R.button).stroke(Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Clear the area search")
    }

    /// Recenters on the user when location is granted, and asks for it when it
    /// is not. The second half matters: a locate button that silently does
    /// nothing because permission was refused six weeks ago is worse than no
    /// button, and `tapLocationChip` is the one place that knows whether to
    /// prompt or to open Settings.
    private var locateButton: some View {
        Button {
            if app.locAuthorized {
                recenterTick += 1
            } else {
                app.tapLocationChip()
            }
        } label: {
            Image(systemName: "location.fill")
                .font(F.callout)
                .foregroundStyle(app.locAuthorized ? Tok.accent : Tok.muted)
                // The phone map's own dimensions, kept so the two versions of
                // this button are the same object.
                .frame(width: 46, height: 46)
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().stroke(Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(app.locAuthorized
                            ? "Recenter on my location"
                            : "Use my location")
    }

    // MARK: Search this area

    /// There is no tapped area to clear on iPad, so this is only ever about the
    /// two things that outlive a pan: a town the user searched their way into,
    /// and the current selection.
    private var canClear: Bool {
        app.placeOverride != nil || selectedID != nil
    }

    private func clearArea() {
        selectedID = nil
        if app.placeOverride != nil { Task { await app.clearOverride() } }
    }

    /// Re-centres the whole feed on what the map is showing, exactly as the
    /// phone does. The name comes from the geocoder, on device, so the rest of
    /// the app can still say where the feed is for: the sidebar's town and the
    /// status line both read it.
    @MainActor private func searchThisArea() async {
        guard let centre = visibleCentre, !searchingArea else { return }
        // Another route to a town you are not standing in, so it goes through
        // the same gate as the town list and the address search. Checked before
        // the reverse geocode rather than after: no point spending one on a
        // move that will not happen.
        guard app.unlocked else { app.unlockPrompt = .towns; return }
        searchingArea = true
        let here = CLLocation(latitude: centre.latitude, longitude: centre.longitude)
        let marks = try? await CLGeocoder().reverseGeocodeLocation(
            here, preferredLocale: Locale(identifier: "en_GB"))
        let mark = marks?.first
        let label = mark?.locality
            ?? mark?.subAdministrativeArea
            ?? mark?.administrativeArea
            ?? "This area"
        // The feed is about to be rebuilt around somewhere else, so the pin the
        // list is pointing at is about to stop existing. Dropped first, so the
        // list and the map never disagree even for one frame.
        selectedID = nil
        await app.setOverride(PlaceOverride(kind: .address, label: label, coordinate: centre))
        searchingArea = false
    }
}
