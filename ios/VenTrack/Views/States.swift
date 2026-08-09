import Foundation
import SwiftUI

// The three states the feed can be in other than "here are your events".
//
// They used to be functional and characterless. They now speak the way the
// audience does, and each one offers the single action that fixes it.
//
// Note on colour: the primary action here is `accentFill` under a white label,
// which is the pairing that token exists for. `activeBg` is deliberately not
// used. A hardcoded white on `activeBg` is invisible on the dark theme, and it
// has caused four separate bugs in this codebase already.

/// Only the list becomes skeletons. The filter controls above stay live, so a
/// person can change their mind while it loads rather than waiting to be
/// allowed to. The skeletons are flat `panel2` blocks laid out in the card's own
/// geometry, pulsing opacity between 0.55 and 1 over a second and a half. No
/// shimmer sweep: that was a gradient.
///
/// Above them sits a progress line, because a cold load here is genuinely slow
/// and silence reads as a hang. Three things make it slow, and only the first
/// is ours: the backend sleeps when idle and takes most of a minute to wake,
/// a region nobody has asked for yet is scraped from scratch, and six sources
/// are polled before the first card can be drawn. `EventService` allows 130
/// seconds for exactly this reason. Skeletons alone say "something is coming";
/// they do not say "this is normal, keep waiting", which is the thing a person
/// staring at a blank feed actually needs to know.
struct LoadingState: View {
    @EnvironmentObject var app: AppState
    var count: Int = 5

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                // Read off the state, not captured here: this view is rebuilt
                // constantly while loading, and a start time held in the view
                // would reset the estimate on every rebuild.
                LoadProgress(startedAt: app.loadStartedAt ?? .now)
                    .padding(.bottom, 2)

                ForEach(0..<count, id: \.self) { _ in
                    SkeletonCard()
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 90)
        }
        .allowsHitTesting(false)
    }
}

/// How long this is going to take, said out loud.
///
/// Two rules keep it honest, and both matter more than the animation:
///
///   1. The bar approaches full without arriving. A bar that fills and then
///      sits there is a worse lie than no bar, and we cannot know the finish
///      time: it is a scrape behind a server that may be asleep. The curve is
///      asymptotic, so it is always moving and never claims to be done.
///   2. The countdown never reaches zero. Past the budget it stops naming
///      seconds it cannot promise and explains itself instead.
///
/// The estimate is rounded to five seconds throughout. "About 40 seconds"
/// is a claim we can stand behind; "37 seconds" is not.
private struct LoadProgress: View {
    let startedAt: Date

    /// What a cold load usually costs: roughly 45s of Render waking up, plus
    /// the first scrape. Not a timeout, just the number the copy is pitched at.
    private static let budget: Double = 55

    /// Most loads are a warm cache and land in well under a second. Showing a
    /// countdown for those would be a flash of noise on every pull to refresh,
    /// so nothing appears until a load has proved itself slow.
    private static let quiet: Double = 2

    var body: some View {
        TimelineView(.periodic(from: startedAt, by: 1)) { ctx in
            let elapsed = max(0, ctx.date.timeIntervalSince(startedAt))
            let shown = elapsed >= Self.quiet

            VStack(alignment: .leading, spacing: 9) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(phase(elapsed))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Tok.text)
                    Spacer(minLength: 8)
                    Text(detail(elapsed))
                        .font(.system(size: 12.5))
                        .foregroundStyle(Tok.muted)
                        .monospacedDigit()
                }

                bar(fraction(elapsed))
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 12)
            .background(Tok.panel, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
            .opacity(shown ? 1 : 0)
            .animation(.easeIn(duration: 0.35), value: shown)
            // The row keeps its space from the start so the skeletons do not
            // jump down a beat after the feed appears to have settled.
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(phase(elapsed)). \(detail(elapsed)).")
        }
    }

    /// A flat two-layer bar. No gradient, per the app's own rule, and no
    /// indeterminate sweep: the point is to show that time is passing.
    private func bar(_ f: Double) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Tok.panel2)
                Capsule()
                    .fill(Tok.accentFill)
                    .frame(width: max(6, geo.size.width * f))
            }
        }
        .frame(height: 5)
        .animation(.linear(duration: 1), value: f)
    }

    /// Approaches 1 but never reaches it: at the full budget this is about
    /// 0.92, and it keeps creeping afterwards rather than stalling at the end.
    private func fraction(_ elapsed: Double) -> Double {
        1 - exp(-elapsed / (Self.budget / 2.5))
    }

    /// What the server is actually doing. The middle phase is an inference, but
    /// a safe one: a warm backend answers in under a second, so anything still
    /// going at eight seconds is a machine being started.
    private func phase(_ elapsed: Double) -> String {
        switch elapsed {
        case ..<8:              return "Finding what's on near you"
        case ..<22:             return "Waking the events server"
        case ..<45:             return "Gathering listings"
        case ..<Self.budget:    return "Nearly there"
        default:                return "Still going"
        }
    }

    private func detail(_ elapsed: Double) -> String {
        let left = Self.budget - elapsed
        if left >= 7.5 {
            // Rounded to five seconds: precision we do not have would only
            // make the number look wrong when it slips.
            let rounded = Int((left / 5).rounded()) * 5
            return "about \(rounded) seconds left"
        }
        if left > -20 { return "any moment now" }
        return "the server was asleep, so this first load is slow"
    }
}

private struct SkeletonCard: View {
    @State private var lit = false

    var body: some View {
        HStack(alignment: .top, spacing: 13) {
            RoundedRectangle(cornerRadius: 10)
                .fill(Tok.panel2)
                .frame(width: 84, height: 84)
            VStack(alignment: .leading, spacing: 9) {
                bar(0.34, 9)
                bar(0.92, 13)
                bar(0.58, 13)
                bar(0.5, 9)
            }
            .padding(.top, 2)
            Spacer(minLength: 36)
        }
        .opacity(lit ? 1 : 0.55)
        .animation(.easeInOut(duration: 0.75).repeatForever(autoreverses: true), value: lit)
        .padding(12)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
        .onAppear { lit = true }
        .accessibilityHidden(true)
    }

    /// Widths are a fraction of whatever the card ends up being, so the
    /// skeleton fits an iPad grid cell as well as a phone.
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
                StateButton(title: secondaryTitle, kind: .secondary, action: widenAction)
            }
        }
    }

    /// A distance limit set once in Settings is the easiest filter to forget,
    /// and the one most likely to be the reason nothing is here, so it is named
    /// outright rather than left to be rediscovered.
    private var secondaryTitle: String {
        app.isRadiusFiltered ? "Search further out" : "Try this week"
    }

    private var message: String {
        let town = place.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = town.isEmpty ? app.placeName : town
        if let km = app.effectiveRadiusKm {
            return "Nothing matches those filters within \(Fmt.radius(km)) of \(name). Search further out, widen the dates, or drop a category."
        }
        return "Nothing matches those filters in \(name). Widen the dates, or drop a category, and the list fills up again."
    }

    private func widenAction() {
        if let widen = widen {
            widen()
            return
        }
        // Dropping the radius costs nothing: it filters events already in hand,
        // so the list refills without a request. Widening the dates does need
        // one, so it is only reached once distance is no longer the constraint.
        if app.isRadiusFiltered {
            app.setRadius(nil)
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
