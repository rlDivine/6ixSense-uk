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
struct LoadingState: View {
    var count: Int = 5

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                ForEach(0..<count, id: \.self) { _ in
                    SkeletonCard()
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 90)
        }
        .allowsHitTesting(false)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Finding what is on near you")
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
