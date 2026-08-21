import SwiftUI

/// The detail column, and the single biggest thing an iPad version buys.
///
/// On the phone, opening an event covers the feed, so comparing two events
/// means closing one and opening the other and holding the first in your head
/// while you look at the second. Side by side, comparison is free. The whole
/// app is a ranking of events by distance and imminence, so comparing is the
/// activity, and this is the layout that supports it.
///
/// `EventDetailView` is reused unchanged. It was written as a sheet body rather
/// than as a screen with its own chrome, which is exactly what a pane wants, so
/// there is nothing to adapt.
struct DetailPane: View {
    /// The id rather than the event, because the content column owns the
    /// selection and events are replaced wholesale on every refresh. Holding an
    /// `Event` here would pin a stale copy: the price could change under a
    /// reload and the pane would keep showing the old one.
    let selectedID: String?

    /// Whether this is a page that was pushed, rather than a pane sitting
    /// beside the list.
    ///
    /// Pushed, the event needs a way back and the navigation bar is hidden, so
    /// the back button over the hero is the only one and is the same control
    /// the phone uses. As a pane it needs neither, because nothing is covered
    /// and nothing has to be dismissed.
    var pushed: Bool = false

    @EnvironmentObject var app: AppState

    /// Resolved from the live list on every render, so the pane always shows
    /// the current version of the event.
    ///
    /// `savedUpcoming` is searched as well as the feed because an event can be
    /// selected in Saved and then filtered out of the feed, and a bookmarked
    /// event vanishing from its own pane when the feed's filters change would
    /// be indefensible.
    private var event: Event? {
        guard let selectedID else { return nil }
        return app.visibleEvents.first { $0.id == selectedID }
            ?? app.savedUpcoming.first { $0.id == selectedID }
    }

    var body: some View {
        Group {
            if let event {
                EventDetailView(event: event, showsBack: pushed)
            } else {
                DetailEmptyView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Tok.bg)
    }
}

/// What the pane shows before anything is selected.
///
/// New, because the phone has never needed it: on a phone there is no such
/// thing as a detail view with nothing in it. It appears on a cold launch and
/// again whenever a filter change clears the selection.
///
/// Deliberately quiet. This is a resting state that a person will see many
/// times a session, not an empty state that means something has gone wrong, and
/// the difference should be legible. The mark, one line, no illustration and no
/// call to action, because there is nothing wrong to fix and the instruction
/// ("pick one") is obvious from the list sitting next to it.
struct DetailEmptyView: View {
    var body: some View {
        VStack(spacing: S.s4) {
            VenTrackLogoView(size: 40)
                .opacity(0.5)
            Text("Choose an event to see the details")
                .font(F.callout)
                .foregroundStyle(Tok.muted)
                .multilineTextAlignment(.center)
        }
        .padding(S.s7)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("No event selected. Choose one from the list.")
    }
}
