import SwiftUI

/// Which gate sent the user to the unlock sheet. Decides only the opening
/// line, but that line is much of why the sheet converts: someone who just
/// tapped a town wants to read about towns, not a generic feature list.
///
/// A top-level type rather than one nested in the view, because `AppState`
/// holds one to drive the app-wide sheet and has no business reaching into a
/// view's namespace. Identifiable so it can drive `.sheet(item:)`.
enum UnlockReason: Identifiable {
    case towns, dateRange, saving, reminders, general

    var id: String { headline }

    /// The small line above the headline. This is what makes five contexts read
    /// as the next step from whatever the person was just doing, rather than as
    /// one wall they walked into from five directions.
    ///
    /// Takes the town because "London is your free town" has to name the town
    /// the person actually has, or it is describing somebody else's app.
    func eyebrow(place: String) -> String {
        switch self {
        case .saving:    "\(AppState.freeSaveLimit) saves used"
        case .dateRange: "A week ahead is free"
        case .towns:     "\(place) is your free town"
        case .reminders: "Reminders"
        case .general:   "VenTrack"
        }
    }

    var headline: String {
        switch self {
        case .saving:    "Room for everything you fancy"
        case .dateRange: "See further than Friday"
        case .towns:     "Every town in the UK"
        case .reminders: "A nudge two hours before"
        case .general:   "The whole country, all month"
        }
    }

    var lede: String {
        switch self {
        case .towns:
            "Unlock once to switch to any of more than 450 towns and cities, "
            + "or to any address you type."
        case .dateRange:
            "Unlock once to see everything upcoming, however far out, instead "
            + "of the next seven days."
        case .saving:
            "Unlock once to keep as many events as you like, with a reminder "
            + "before each one."
        case .reminders:
            "Unlock once and VenTrack can tell you two hours before anything "
            + "you saved starts."
        case .general:
            "One payment opens every town, the whole calendar, and unlimited "
            + "saves and reminders."
        }
    }

    /// What stays free, named in every context.
    ///
    /// This is the line that stops the gate reading as a crippled app, and it
    /// has to be specific to the gate to be believed: the saves wall promises
    /// nothing already saved disappears, the town wall promises your own town
    /// stays free for good. A generic reassurance here would be worth nothing.
    func closing(place: String) -> String {
        switch self {
        case .saving:
            "Nothing you have already saved goes away, and saving stays free "
            + "up to \(AppState.freeSaveLimit)."
        case .dateRange:
            "The next seven days stay free, in every town you can reach."
        case .towns:
            "\(place) stays free for good, whether or not you unlock."
        case .reminders:
            "Saving events stays free. Only the reminder is part of the unlock."
        case .general:
            "Your own town and the next seven days stay free, always."
        }
    }
}

/// The unlock sheet. Reached from whichever gate the user actually walked into,
/// which is why it takes a `reason` rather than always saying the same thing.
///
/// Deliberately plain. No countdown, no crossed out price, no "most popular"
/// badge on a single product. There is one thing to buy and one price, and the
/// honest presentation of that converts better on a utility than a sales page
/// does.
struct PaywallView: View {
    @EnvironmentObject var store: Store
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss

    let reason: UnlockReason

    private struct Feature: Identifiable {
        let icon: String
        let title: String
        let detail: String
        var id: String { title }
    }

    /// Comparative on purpose. Each row names what the free tier gives and what
    /// the unlock changes, in that order, so the person can see exactly what
    /// they are buying against what they already have rather than reading a
    /// feature list with no baseline.
    private let features = [
        Feature(icon: "building.2",
                title: "More than 450 towns, instead of one",
                detail: "Every town and city across all four nations, plus any address you type."),
        Feature(icon: "calendar",
                title: "The whole month, instead of the free week",
                detail: "Everything upcoming, however far out, rather than the next seven days."),
        Feature(icon: "bookmark",
                title: "Unlimited saves, instead of \(AppState.freeSaveLimit)",
                detail: "Keep whatever you like, and nothing you saved already goes away."),
        Feature(icon: "bell",
                title: "A reminder two hours before",
                detail: "For anything you saved. Off by default, and you choose which."),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    VStack(spacing: 0) {
                        ForEach(features) { featureRow($0) }
                    }
                    .padding(.top, S.s6)

                    if let failure = store.failure { failureNote(failure) }

                    priceBlock
                    buyButton
                    restoreButton
                    closingLine
                    footnote
                }
                .padding(20)
            }
            .background(Tok.bg.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Not now") { dismiss() }.foregroundStyle(Tok.muted)
                }
            }
        }
        .task {
            await store.loadProduct()
        }
        // Close as soon as the purchase lands, so the user is returned to what
        // they were trying to do rather than left on a sheet that now says
        // nothing useful.
        .onChange(of: store.unlocked) { _, nowUnlocked in
            if nowUnlocked { dismiss() }
        }
    }

    // MARK: Pieces

    private var header: some View {
        VStack(alignment: .leading, spacing: S.s2) {
            Text(reason.eyebrow(place: app.placeName).uppercased())
                .font(F.caption)
                .kerning(0.77)
                .foregroundStyle(Tok.faint)
            Text(reason.headline)
                .font(F.display)
                .kerning(-1.1)
                .foregroundStyle(Tok.text)
                .fixedSize(horizontal: false, vertical: true)
            Text(reason.lede)
                .font(F.body)
                .foregroundStyle(Tok.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, S.s1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func featureRow(_ f: Feature) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: f.icon)
                .font(.system(size: 17, weight: .regular))
                .foregroundStyle(Tok.muted)
                .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: S.s1) {
                Text(f.title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Tok.text)
                    .fixedSize(horizontal: false, vertical: true)
                Text(f.detail)
                    .font(F.footnote)
                    .foregroundStyle(Tok.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, S.s3)
        // No card and no border. Four bordered boxes in a stack is the pattern
        // the brief called out by name, and it reads as four things to choose
        // between rather than one list of what the unlock includes.
        .overlay(alignment: .bottom) {
            Rectangle().fill(Tok.hairline).frame(height: 1)
        }
    }

    /// One price, stated plainly and large, then what kind of purchase it is.
    /// No strike through, no "was", no countdown, no fake original price. The
    /// sentence under the button is the promise that it does not renew.
    private var priceBlock: some View {
        VStack(alignment: .leading, spacing: S.s1) {
            Text(store.priceLabel)
                .font(.system(size: 40, weight: .bold))
                .kerning(-1.2)
                .foregroundStyle(Tok.text)
            Text("Once, yours for good")
                .font(F.body)
                .foregroundStyle(Tok.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, S.s6)
    }

    private var buyButton: some View {
        Button {
            Task { await store.purchase() }
        } label: {
            HStack(spacing: 8) {
                if store.busy { ProgressView().tint(.white) }
                Text(store.busy ? "Working" : "Unlock VenTrack")
                    .font(.system(size: 17, weight: .semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(Tok.accentFill, in: RoundedRectangle(cornerRadius: R.button))
        }
        .buttonStyle(PressableRow())
        .disabled(store.busy)
        .padding(.top, S.s4)
    }

    private var restoreButton: some View {
        Button {
            Task { await store.restore() }
        } label: {
            // A peer of Unlock, at the same width and the same height, not a
            // link buried in a footer. Someone who has already paid should not
            // have to hunt for the way to say so.
            Text("Restore a previous purchase")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Tok.text)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Tok.panel2, in: RoundedRectangle(cornerRadius: R.button))
        }
        .buttonStyle(PressableRow())
        .disabled(store.busy)
        .padding(.top, S.s2)
    }

    /// What stays free, in this gate's own terms.
    ///
    /// The single most important line on the sheet after the price. A gate that
    /// only says what you cannot do reads as a crippled app; naming what
    /// remains free, specifically, is what makes the boundary read as honest.
    private var closingLine: some View {
        Text(reason.closing(place: app.placeName))
            .font(F.body)
            .foregroundStyle(Tok.text)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(S.s3)
            .background(Tok.panel2, in: RoundedRectangle(cornerRadius: R.well))
            .padding(.top, S.s5)
    }

    private var footnote: some View {
        Text("One payment, not a subscription. Nothing renews and nothing is "
             + "charged again. It stays unlocked on every device signed in to "
             + "the same Apple Account.")
            .font(F.footnote)
            .foregroundStyle(Tok.faint)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, S.s4)
    }

    private func failureNote(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 9) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Tok.accent)
            Text(message)
                .font(.system(size: 12.5))
                .foregroundStyle(Tok.text)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 12))
        .padding(.top, 16)
        .accessibilityElement(children: .combine)
    }
}

extension View {
    /// Presents the unlock sheet whenever the bound reason is set. Every gate
    /// in the app goes through this so they all open the same sheet the same
    /// way, and setting the reason to nil is what closes it.
    func paywall(_ reason: Binding<UnlockReason?>) -> some View {
        sheet(item: reason) { PaywallView(reason: $0) }
    }
}

/// The small padlock that marks a control as being behind the unlock. Used on
/// the range pill and the town rows so the gate is visible before it is hit,
/// rather than a tap that appears to fail.
struct LockBadge: View {
    var body: some View {
        Image(systemName: "lock.fill")
            .font(.system(size: 9.5, weight: .bold))
            .foregroundStyle(Tok.muted)
            .accessibilityLabel("Part of the paid unlock")
    }
}
