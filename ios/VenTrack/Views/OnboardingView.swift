import SwiftUI

/// Mandatory first-run onboarding (no account, no skip): the value proposition,
/// then location with an honest explanation of why it is being asked for, then
/// interests. Completing it sets `onboarded`, which the app gates on.
///
/// The interest grid used to carry emoji, on the argument that they made twelve
/// cells scannable at a glance. They did, and they also made this the one screen
/// where the interface changed character: an emoji renders in its own font, at
/// its own weight, in colours from someone else's palette, and it ignores tint
/// and Dynamic Type. Every cell now uses an SF Symbol instead, which stays
/// scannable while taking the app's own weight and accent.
struct OnboardingView: View {
    @EnvironmentObject var app: AppState
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var step = 0

    private let lastStep = 2

    var body: some View {
        ZStack(alignment: .top) {
            Tok.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                topBar
                Group {
                    switch step {
                    case 0: intro
                    case 1: locationStep
                    default: preferencesStep
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                pageDots
                primaryButton
            }
        }
    }

    // MARK: Chrome

    private var topBar: some View {
        HStack {
            if step > 0 {
                Button { withAnimation { step -= 1 } } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Tok.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back a step")
            }
            Spacer(minLength: 0)
        }
        .frame(height: 24)
        .padding(.horizontal, 20).padding(.top, 14)
    }

    private var pageDots: some View {
        HStack(spacing: 6) {
            ForEach(0...lastStep, id: \.self) { i in
                Capsule()
                    .fill(i == step ? Tok.accent : Tok.hairline)
                    .frame(width: i == step ? 20 : 7, height: 7)
            }
        }
        .padding(.bottom, 18)
        .accessibilityHidden(true)
    }

    private var primaryButton: some View {
        Button {
            if step < lastStep {
                withAnimation { step += 1 }
                if step == 1 { app.requestLocation() }
            } else {
                app.onboarded = true
            }
        } label: {
            Text(step == lastStep ? "Finish" : "Continue")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Tok.accentFill, in: RoundedRectangle(cornerRadius: R.button))
        }
        .buttonStyle(PressableRow())
        .padding(.horizontal, 24).padding(.bottom, 22)
    }

    // MARK: Steps

    private var intro: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            markTile(size: 150, mark: 92)
                .padding(.bottom, 28)
            Text("VenTrack")
                .font(.system(size: 30, weight: .heavy))
                .foregroundStyle(Tok.text)
            Text("Everything happening around you, anywhere in the UK: gigs, festivals, food, comedy, markets and free events, sorted by what's closest and soonest.")
                .font(.system(size: 15))
                .foregroundStyle(Tok.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
                .padding(.top, 10)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
    }

    private var locationStep: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)
            artTile("location.fill", Tok.link)
            Text("Sorted by what's closest to you")
                .font(.system(size: 24, weight: .heavy))
                .foregroundStyle(Tok.text)
                .multilineTextAlignment(.center)
                .padding(.top, 22)
            Text("Allow location so we can find your nearest town and rank events by distance. It is used only to sort by distance and is never stored.")
                .font(.system(size: 15))
                .foregroundStyle(Tok.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
                .padding(.top, 10)
            Button { app.requestLocation() } label: {
                Label(app.locAuthorized ? "Location enabled" : "Allow location",
                      systemImage: app.locAuthorized ? "checkmark.circle.fill" : "location.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(app.locAuthorized ? Tok.accent : Tok.link)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Tok.panel, in: Capsule())
                    .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .padding(.top, 18)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
    }

    private var preferencesStep: some View {
        VStack(spacing: 0) {
            markTile(size: 96, mark: 56)
                .padding(.top, 8)
            Text("What are you into?")
                .font(.system(size: 27, weight: .bold))
                .kerning(-0.8)
                .foregroundStyle(Tok.text)
                .padding(.top, 20)
            Text("Pick a few and they move up the list. You can change these any time in Settings.")
                .font(.system(size: 14.5))
                .foregroundStyle(Tok.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
                .padding(.top, 8)

            ScrollView {
                LazyVGrid(columns: interestColumns, spacing: S.s3) {
                    ForEach(Preferences.all) { p in interestChip(p) }
                }
                .padding(.horizontal, 18).padding(.top, 16).padding(.bottom, 8)
            }
        }
    }

    // MARK: Bits

    /// Three across normally, two at the accessibility sizes.
    ///
    /// This grid is the screen most at risk from Dynamic Type: twelve cells
    /// three across, each holding a symbol over a label, is already tight at
    /// the default size. At the accessibility sizes a third column forces the
    /// labels to either truncate or shrink past legibility, and shrinking text
    /// to fit is precisely what Dynamic Type exists to stop. Dropping a column
    /// gives each label half again the width instead.
    private var interestColumns: [GridItem] {
        let count = typeSize.isAccessibilitySize ? 2 : 3
        return Array(repeating: GridItem(.flexible(), spacing: S.s3), count: count)
    }

    private func interestChip(_ p: Preference) -> some View {
        let on = app.preferredCategories.contains(p.id)
        return Button { app.togglePreference(p.id) } label: {
            VStack(spacing: 7) {
                Image(systemName: p.symbol)
                    .font(.system(size: 20, weight: .regular))
                    // The interest's own family colour, so the grid previews
                    // the palette the feed will use rather than being a wall of
                    // one accent.
                    .foregroundStyle(on ? Tok.activeFg
                                        : (p.family?.style.color ?? Tok.muted))
                    .frame(height: 24)
                Text(p.label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(on ? Tok.activeFg : Tok.text)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, S.s4).padding(.horizontal, S.s2)
            // panel2 unselected, no border. The bordered cell was part of what
            // made every screen read as a grid of boxes.
            .background(on ? Tok.activeBg : Tok.panel2,
                        in: RoundedRectangle(cornerRadius: R.button))
        }
        .buttonStyle(PressableRow())
        .accessibilityLabel(p.label)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    /// The mark on a flat panel tile. A square rather than a circle, because
    /// that is the shape the home screen icon will be.
    private func markTile(size: CGFloat, mark: CGFloat) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.27)
                .fill(Tok.panel)
                .overlay(RoundedRectangle(cornerRadius: size * 0.27)
                    .stroke(Tok.hairline, lineWidth: 1))
            VenTrackLogoView(size: mark)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private func artTile(_ symbol: String, _ tint: Color) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 36)
                .fill(Tok.panel)
                .overlay(RoundedRectangle(cornerRadius: 36).stroke(Tok.hairline, lineWidth: 1))
            Image(systemName: symbol)
                .font(.system(size: 46))
                .foregroundStyle(tint)
        }
        .frame(width: 130, height: 130)
        .accessibilityHidden(true)
    }
}
