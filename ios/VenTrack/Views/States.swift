import SwiftUI
// For Timer.publish, which the loading state's clock is built on. SwiftUI does
// not re-export Combine, so without this the file does not build.
import Combine

// The three states the feed can be in other than "here are your events".
//
// They used to be functional and characterless. They now speak the way the
// audience does, and each one offers the single action that fixes it.
//
// Note on colour: the primary action here is `accentFill` under a white label,
// which is the pairing that token exists for. `activeBg` is deliberately not
// used. A hardcoded white on `activeBg` is invisible on the dark theme, and it
// has caused four separate bugs in this codebase already.

/// The wait, said out loud.
///
/// The API runs on a free instance that sleeps when idle, and a cold wake takes
/// anywhere from thirty seconds to a minute before the first byte comes back.
/// Skeleton cards alone do not survive that: after about ten seconds of quiet
/// pulsing a person concludes the app is broken and kills it, which is the
/// worst possible outcome for a wait that was going to end on its own.
///
/// So the state says what is happening and roughly how long it has been going.
/// Three parts, in the order they answer the questions a person actually asks:
///
///   A LINE THAT CHANGES. "Finding what is on near you" is true for the first
///   few seconds; past that it is not the answer any more, and the copy moves
///   on to naming the wait rather than repeating itself. A status line that
///   never changes is indistinguishable from a frozen one.
///
///   A BAR. Eased asymptotically toward 95 per cent over the cold start window,
///   never arriving, because there is no progress signal to report: the request
///   is one round trip that either lands or does not. It carries NO percentage
///   figure, deliberately. The bar saying "still going, and here is roughly how
///   long" is true. A specific "63%" would be a fabricated number about work we
///   cannot see, and this app does not do that anywhere else either.
///
///   THE SKELETONS. Laid out in the real card's geometry, so the feed does not
///   jump when it arrives.
///
/// The filter controls above all of this stay live throughout, so a person can
/// change their mind while it loads rather than waiting to be allowed to.
struct LoadingState: View {
    /// Named in the copy once the wait gets long enough to need specifics.
    /// A parameter rather than an environment read, matching EmptyState, so
    /// this view can be dropped anywhere without an AppState behind it.
    var place: String = ""
    var count: Int = 4

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var elapsed: Double = 0
    @State private var progress: Double = 0

    /// Ten a second, which is what it takes for the bar to move rather than
    /// step.
    ///
    /// Static, and that matters. As an instance property it would be rebuilt
    /// every time the struct is, which here is ten times a second, and every
    /// rebuild hands `onReceive` a publisher it has not seen before and makes
    /// it tear down the subscription and start again. A timer cancelled and
    /// restarted every tenth of a second is a timer that may never reach its
    /// own interval. One shared publisher has no such problem, and autoconnect
    /// still means it only runs while something is subscribed, which is only
    /// ever while this view is on screen.
    private static let tick = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: S.s3) {
                status
                LazyVStack(spacing: S.s3) {
                    ForEach(0..<count, id: \.self) { _ in
                        SkeletonCard(animates: !reduceMotion)
                    }
                }
            }
            .padding(.top, S.s5)
            .padding(.bottom, 90)
        }
        .allowsHitTesting(false)
        .onReceive(Self.tick) { _ in advance() }
    }

    private var status: some View {
        VStack(alignment: .leading, spacing: S.s2) {
            Text(caption)
                .font(F.callout)
                .foregroundStyle(Tok.text)
                // Crossfades between stages instead of snapping, which is the
                // difference between "it moved on" and "it glitched".
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: caption)
            bar
            Text(subcaption)
                .font(F.footnote)
                .foregroundStyle(Tok.muted)
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: subcaption)
        }
        .padding(.horizontal, S.s5)
        .padding(.bottom, S.s2)
        // One element, read once, rather than three fragments VoiceOver has to
        // be swiped through. updatesFrequently is what tells VoiceOver to
        // re-read it as the stages change.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(caption)
        .accessibilityValue(subcaption)
        .accessibilityAddTraits(.updatesFrequently)
    }

    private var bar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Tok.panel2)
                Capsule()
                    .fill(Tok.accent)
                    // A minimum width so the bar reads as a bar from the first
                    // frame rather than appearing out of nothing.
                    .frame(width: max(10, geo.size.width * progress))
            }
        }
        .frame(height: 4)
        .accessibilityHidden(true)
    }

    /// Eases toward 95 per cent and never reaches it. The constants put it
    /// around two thirds of the way along at fifteen seconds and close to the
    /// ceiling at forty five, which is the shape of a real cold start on this
    /// backend. It does not need to reach the end: the feed replaces this whole
    /// view the moment the response lands, and on a warm instance that happens
    /// before the bar has visibly moved.
    private func advance() {
        elapsed += 0.1
        let ceiling = 0.95
        let step = (ceiling - progress) * 0.007
        if reduceMotion {
            progress = min(ceiling, progress + step)
        } else {
            withAnimation(.linear(duration: 0.1)) {
                progress = min(ceiling, progress + step)
            }
        }
    }

    // The stages. Each one is true for the window it covers, and none of them
    // repeats the one before, because a line that says the same thing at forty
    // seconds as it did at two has stopped being information.

    private var caption: String {
        if elapsed < 6 { return "Finding what is on near you" }
        if elapsed < 20 { return "Waking the server up" }
        if elapsed < 45 { return "Nearly there" }
        return "Still going"
    }

    private var subcaption: String {
        if elapsed < 6 { return "Connecting" }
        if elapsed < 20 { return "The first load of the day can take up to a minute" }
        if elapsed < 45 { return mergingLine }
        // Said plainly rather than hidden, because by this point the person is
        // deciding whether to give up, and they deserve the real answer: it is
        // slow, it has not failed, and if it does fail this screen will say so
        // rather than sitting here.
        return "Slower than usual. If it cannot get through it will say so."
    }

    private var mergingLine: String {
        let town = place.trimmingCharacters(in: .whitespacesAndNewlines)
        return town.isEmpty ? "Merging the listings" : "Merging the listings for \(town)"
    }
}

/// A card's geometry with the words taken out.
///
/// The measurements are the row card's own, not approximations of it: same 68pt
/// thumbnail at the same radius, same paddings, same 18pt corner and hairline,
/// same 20pt gutter. That is the whole job of a skeleton. One that is roughly
/// the right shape makes the feed jump when the real cards land, which reads as
/// a second loading step rather than as the end of the first.
///
/// Flat `panel2` blocks pulsing between 0.55 and 1. No shimmer sweep: that was
/// a gradient.
private struct SkeletonCard: View {
    var animates: Bool = true
    @State private var lit = false

    var body: some View {
        HStack(alignment: .top, spacing: S.s3) {
            RoundedRectangle(cornerRadius: R.thumb)
                .fill(Tok.panel2)
                .frame(width: 68, height: 68)
            VStack(alignment: .leading, spacing: S.s1) {
                bar(0.30, 9)       // overline
                bar(0.92, 14)      // title, first line
                bar(0.58, 14)      // title, second line
                bar(0.46, 11)      // venue
                bar(0.38, 9)       // footer
            }
            Spacer(minLength: 44)  // the distance column
        }
        .opacity(lit ? 1 : 0.55)
        .animation(animates
                   ? Animation.easeInOut(duration: 0.75).repeatForever(autoreverses: true)
                   : nil,
                   value: lit)
        .padding(.leading, S.s4)
        .padding(.trailing, S.s2)
        .padding(.vertical, S.s4)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: R.card))
        .overlay(RoundedRectangle(cornerRadius: R.card).stroke(Tok.hairline, lineWidth: 1))
        .padding(.horizontal, S.s5)
        .onAppear { if animates { lit = true } }
        .accessibilityHidden(true)
    }

    /// Widths are a fraction of whatever the card ends up being, so the
    /// skeleton holds its proportions at every width.
    private func bar(_ fraction: CGFloat, _ height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: height / 2)
            .fill(Tok.panel2)
            .frame(height: height)
            .frame(maxWidth: .infinity, alignment: .leading)
            .scaleEffect(x: fraction, anchor: .leading)
    }
}

/// Nothing matched. The body names the town and the fix, and there are two ways
/// out: clear the filters, or widen to the whole week.
struct EmptyState: View {
    @EnvironmentObject var app: AppState

    /// The town named in the body copy. Defaults to whatever the feed was
    /// built for.
    var place: String
    /// The widening shortcut. Defaults to switching the range to this week.
    var widen: (() -> Void)?
    /// The primary action, clearing the filters back to everything.
    let reset: () -> Void

    init(place: String = "", widen: (() -> Void)? = nil, reset: @escaping () -> Void) {
        self.place = place
        self.widen = widen
        self.reset = reset
    }

    var body: some View {
        StateBlock(symbol: "waveform.path.ecg",
                   title: "Quiet round here tonight",
                   message: message) {
            HStack(spacing: 10) {
                StateButton(title: "Clear filters", kind: .primary, action: reset)
                StateButton(title: "Try this week", kind: .secondary, action: widenAction)
            }
        }
    }

    private var message: String {
        let town = place.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = town.isEmpty ? app.placeName : town
        return "Nothing matches those filters in \(name). Widen the dates, or drop a category, and the list fills up again."
    }

    private func widenAction() {
        if let widen = widen {
            widen()
            return
        }
        app.range = .week
        Task { await app.load() }
    }
}

/// The listings could not be reached. Saved events are unaffected, and saying
/// so out loud is the point: there is no account here, everything lives on the
/// device, so a dead network cannot take anything away.
struct ErrorState: View {
    /// The underlying failure. Kept so callers do not have to change, and so it
    /// reaches VoiceOver, but it is not printed: a URLSession description is
    /// not something to put in front of somebody.
    var message: String
    let retry: () -> Void

    init(message: String = "", retry: @escaping () -> Void) {
        self.message = message
        self.retry = retry
    }

    var body: some View {
        StateBlock(symbol: "antenna.radiowaves.left.and.right.slash",
                   title: "Lost the signal",
                   message: copy) {
            StateButton(title: "Try again", kind: .primary, action: retry)
        }
        .accessibilityHint(message)
    }

    private var copy: String {
        "We could not reach the listings just now. Your saved events are still here, they live on this device."
    }
}

// MARK: - Shared furniture

/// A quiet mark, a title, a line of body copy and whatever actions the state
/// offers. Every state uses it, so the three of them cannot drift apart.
private struct StateBlock<Actions: View>: View {
    let symbol: String
    let title: String
    let message: String
    let actions: Actions

    init(symbol: String, title: String, message: String,
         @ViewBuilder actions: () -> Actions) {
        self.symbol = symbol
        self.title = title
        self.message = message
        self.actions = actions()
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            ZStack {
                RoundedRectangle(cornerRadius: 22).fill(Tok.panel2)
                Image(systemName: symbol)
                    .font(.system(size: 30, weight: .regular))
                    .foregroundStyle(Tok.muted)
            }
            .frame(width: 92, height: 92)
            .accessibilityHidden(true)
            Text(title)
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(Tok.text)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 20)
            Text(message)
                .font(.system(size: 14))
                .lineSpacing(4)
                .foregroundStyle(Tok.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            actions
                .padding(.top, 22)
            Spacer(minLength: 0)
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 32)
        .padding(.bottom, 70)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct StateButton: View {
    enum Kind { case primary, secondary }

    let title: String
    let kind: Kind
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14.5, weight: .bold))
                .foregroundStyle(kind == .primary ? Color.white : Tok.text)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(fill, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    /// `accentFill`, not `accent`, because a white label sits on it. And not
    /// `activeBg`, which would need `activeFg` rather than white.
    private var fill: Color { kind == .primary ? Tok.accentFill : Tok.panel }
    private var border: Color { kind == .primary ? Color.clear : Tok.hairline }
}
