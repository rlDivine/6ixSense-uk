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

    var headline: String {
        switch self {
        case .towns:     "Browse any town in the UK"
        case .dateRange: "Look further ahead"
        case .saving:    "Keep as many events as you like"
        case .reminders: "Get reminded before it starts"
        case .general:   "Unlock VenTrack"
        }
    }

    var lede: String {
        switch self {
        case .towns:
            "VenTrack is free for wherever you are. Unlock it once to switch "
            + "to any of more than 450 towns and cities, or to any address you type."
        case .dateRange:
            "The free app shows the next seven days. Unlock it once to see "
            + "everything upcoming, however far out."
        case .saving:
            "The free app keeps \(AppState.freeSaveLimit) events. Unlock it "
            + "once for as many as you want, with reminders."
        case .reminders:
            "Unlock VenTrack once and it can tell you two hours before "
            + "anything you saved starts."
        case .general:
            "Free for wherever you are. One payment unlocks the rest, for good."
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
    @Environment(\.dismiss) private var dismiss

    let reason: UnlockReason

    private struct Feature: Identifiable {
        let icon: String
        let title: String
        let detail: String
        var id: String { title }
    }

    private let features = [
        Feature(icon: "building.2",
                title: "Every town, not just yours",
                detail: "More than 450 towns and cities across all four nations, plus any address you type."),
        Feature(icon: "calendar",
                title: "The whole calendar",
                detail: "See everything upcoming instead of the next seven days."),
        Feature(icon: "bookmark",
                title: "Unlimited saves and reminders",
                detail: "Keep whatever you like and be told two hours before it starts."),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    VStack(spacing: 12) {
                        ForEach(features) { featureRow($0) }
                    }
                    .padding(.top, 24)

                    if let failure = store.failure { failureNote(failure) }

                    buyButton
                    restoreButton
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
        VStack(alignment: .leading, spacing: 10) {
            VenTrackLogoView(size: 30)
            Text(reason.headline)
                .font(.system(size: 25, weight: .bold))
                .kerning(-0.6)
                .foregroundStyle(Tok.text)
                .fixedSize(horizontal: false, vertical: true)
            Text(reason.lede)
                .font(.system(size: 14.5))
                .foregroundStyle(Tok.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func featureRow(_ f: Feature) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: f.icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Tok.accent)
                .frame(width: 26, height: 26)
            VStack(alignment: .leading, spacing: 3) {
                Text(f.title)
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Tok.text)
                Text(f.detail)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Tok.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(13)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(Tok.hairline, lineWidth: 1))
    }

    private var buyButton: some View {
        Button {
            Task { await store.purchase() }
        } label: {
            HStack(spacing: 8) {
                if store.busy { ProgressView().tint(Tok.activeFg) }
                Text(store.busy ? "Working" : store.priceLabel)
                    .font(.system(size: 15.5, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(Tok.accentFill, in: RoundedRectangle(cornerRadius: 13))
        }
        .buttonStyle(.plain)
        .disabled(store.busy)
        .padding(.top, 22)
    }

    private var restoreButton: some View {
        Button {
            Task { await store.restore() }
        } label: {
            Text("Restore a previous purchase")
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(Tok.link)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        .buttonStyle(.plain)
        .disabled(store.busy)
    }

    private var footnote: some View {
        Text("One payment, not a subscription. It stays unlocked on every device "
             + "signed in to the same Apple Account.")
            .font(.system(size: 12))
            .foregroundStyle(Tok.faint)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
            .padding(.top, 2)
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
