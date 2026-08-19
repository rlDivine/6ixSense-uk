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
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(15)
                .background(Tok.accentFill, in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
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
                LazyVGrid(columns: interestColumns, spacing: 10) {
                    ForEach(Preferences.all) { p in interestChip(p) }
                }
                .padding(.horizontal, 18).padding(.top, 16).padding(.bottom, 8)
            }
        }
    }

    // MARK: Bits

    private var interestColumns: [GridItem] {
        [GridItem(.flexible(), spacing: 10),
         GridItem(.flexible(), spacing: 10),
         GridItem(.flexible(), spacing: 10)]
    }

    private func interestChip(_ p: Preference) -> some View {
        let on = app.preferredCategories.contains(p.id)
        return Button { app.togglePreference(p.id) } label: {
            VStack(spacing: 7) {
                Image(systemName: p.symbol)
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(on ? Tok.activeFg : Tok.accent)
                    .frame(height: 24)
                Text(p.label)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(on ? Tok.activeFg : Tok.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14).padding(.horizontal, 6)
            .background(on ? Tok.activeBg : Tok.panel, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14)
                .stroke(on ? Tok.activeBg : Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
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
