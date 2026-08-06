import SwiftUI

/// Mandatory first-run onboarding (no account, no skip): intro, then location,
/// then interests. Completing it sets `onboarded`, which the app gates on.
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

                primaryButton
            }
        }
    }

    // MARK: Chrome

    private var topBar: some View {
        HStack {
            if step > 0 {
                Button { withAnimation { step -= 1 } } label: {
                    Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold)).foregroundStyle(Tok.muted)
                }
            }
            Spacer()
            HStack(spacing: 6) {
                ForEach(0...lastStep, id: \.self) { i in
                    Capsule().fill(i == step ? Tok.accent : Tok.hairline)
                        .frame(width: i == step ? 20 : 7, height: 7)
                }
            }
            Spacer()
            // Invisible spacer to balance the back chevron.
            Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold)).opacity(0)
        }
        .padding(.horizontal, 18).padding(.top, 16)
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
            Text(step == lastStep ? "Start exploring" : "Continue")
                .font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(15)
                .background(Tok.accent, in: RoundedRectangle(cornerRadius: 14))
        }
        .padding(.horizontal, 24).padding(.bottom, 22)
    }

    // MARK: Steps

    private var intro: some View {
        VStack(spacing: 0) {
            Spacer()
            ZStack {
                RoundedRectangle(cornerRadius: 40)
                    .fill(Tok.panel)
                    .overlay(RoundedRectangle(cornerRadius: 40).stroke(Tok.hairline, lineWidth: 1))
                PulseLogoView(size: 92)
            }
            .frame(width: 150, height: 150).padding(.bottom, 28)
            Text("Pulse").font(.system(size: 30, weight: .heavy)).foregroundStyle(Tok.text)
            Text("Everything happening around you, anywhere in the UK: gigs, festivals, food, comedy, markets and free events, sorted by what's closest and soonest.")
                .font(.system(size: 15)).foregroundStyle(Tok.muted)
                .multilineTextAlignment(.center).frame(maxWidth: 320).padding(.top, 10)
            Spacer()
        }
        .padding(.horizontal, 24)
    }

    private var locationStep: some View {
        VStack(spacing: 0) {
            Spacer()
            artCircle("location.fill", Tok.link)
            Text("Sorted by what's closest to you").font(.system(size: 24, weight: .heavy))
                .foregroundStyle(Tok.text).multilineTextAlignment(.center).padding(.top, 22)
            Text("Allow location so we can find your nearest town and rank events by distance. It's used only to sort by distance and is never stored.")
                .font(.system(size: 15)).foregroundStyle(Tok.muted)
                .multilineTextAlignment(.center).frame(maxWidth: 320).padding(.top, 10)
            Button { app.requestLocation() } label: {
                Label(app.locAuthorized ? "Location enabled" : "Allow location",
                      systemImage: app.locAuthorized ? "checkmark.circle.fill" : "location.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(app.locAuthorized ? Tok.freeFg : Tok.link)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Tok.panel, in: Capsule())
                    .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
            }
            .padding(.top, 18)
            Spacer()
        }
        .padding(.horizontal, 24)
    }

    private var preferencesStep: some View {
        VStack(spacing: 0) {
            Text("What are you into?").font(.system(size: 24, weight: .heavy)).foregroundStyle(Tok.text)
                .padding(.top, 18)
            Text("Pick a few and we'll tailor your feed to what you like. Leave it blank to see everything.")
                .font(.system(size: 14)).foregroundStyle(Tok.muted)
                .multilineTextAlignment(.center).frame(maxWidth: 320).padding(.top, 8)

            ScrollView {
                let cols = [GridItem(.flexible()), GridItem(.flexible())]
                LazyVGrid(columns: cols, spacing: 10) {
                    ForEach(Preferences.all) { p in
                        let on = app.preferredCategories.contains(p.id)
                        Button { app.togglePreference(p.id) } label: {
                            HStack(spacing: 8) {
                                Text(p.emoji).font(.system(size: 18))
                                Text(p.label).font(.system(size: 13.5, weight: .semibold))
                                    .foregroundStyle(on ? Tok.activeFg : Tok.text).lineLimit(1).minimumScaleFactor(0.8)
                                Spacer(minLength: 0)
                                if on { Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Tok.activeFg) }
                            }
                            .padding(.horizontal, 12).padding(.vertical, 12)
                            .background(on ? Tok.activeBg : Tok.panel, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(on ? Tok.activeBg : Tok.hairline, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 18).padding(.top, 16).padding(.bottom, 8)
            }
        }
    }

    // MARK: Bits

    private func artCircle(_ symbol: String, _ tint: Color) -> some View {
        ZStack {
            Circle().fill(Tok.panel)
                .overlay(Circle().stroke(Tok.hairline, lineWidth: 1))
            Image(systemName: symbol).font(.system(size: 46)).foregroundStyle(tint)
        }
        .frame(width: 130, height: 130)
    }
}
