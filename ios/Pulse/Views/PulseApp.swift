import SwiftUI
import UIKit

@main
struct PulseApp: App {
    @StateObject private var app = AppState()

    init() { Chrome.apply() }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .tint(Tok.accent)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var app: AppState
    /// Layout branches on the *size class*, never the device model, so Split
    /// View, Slide Over and Stage Manager get the compact layout automatically
    /// the moment the app is handed a narrow window on an iPad.
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        Group {
            if app.onboarded {
                if horizontalSizeClass == .regular {
                    IPadRootView()
                } else {
                    MainTabView()
                }
            } else {
                OnboardingView()
            }
        }
        .preferredColorScheme(nil) // follow system
    }
}

/// The four destinations. Map used to live behind a floating button on
/// Discover; it is a tab now, and Settings moved to the gear in the brand
/// strip, so the bar reads Discover, Map, Saved, Search and nothing floats
/// over the feed.
struct MainTabView: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        TabView(selection: $app.tab) {
            DiscoverView()
                .tabItem { Label("Discover", systemImage: "house") }.tag(0)
            EventMapView()
                .tabItem { Label("Map", systemImage: "map") }.tag(1)
            SavedView()
                .tabItem { Label("Saved", systemImage: "bookmark") }.tag(2)
            SearchView()
                .tabItem { Label("Search", systemImage: "magnifyingglass") }.tag(3)
        }
        .tint(Tok.accent)
        .task {
            app.requestLocation()   // ask on first launch so the user can grant it
            if app.events.isEmpty { await app.load() }
        }
    }
}

// MARK: - Chrome
//
// The bar, the strips and the trays are glass: a system material rather than a
// flat fill, so the list keeps moving underneath them instead of disappearing
// behind a slab. A material is translucency, not a gradient, so this stays
// inside the no-gradients rule.
//
// Two rules keep it legible. Every sheet of glass carries a hairline on the
// edge where it meets the content, otherwise the boundary vanishes over a pale
// card. And nothing quieter than `Tok.muted` is ever printed on it: the faint
// weight is solved against `panel2`, not against a blur of whatever happens to
// be scrolling past.

enum Chrome {
    /// The tab bar's own glass. UITabBar is UIKit underneath, so the material
    /// goes on through its appearance proxy rather than a SwiftUI modifier.
    static func apply() {
        let bar = UITabBarAppearance()
        bar.configureWithDefaultBackground()
        bar.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterial)
        bar.backgroundColor = .clear
        // The hairline along the top edge, where the glass meets the list.
        bar.shadowColor = UIColor(Tok.hairline)

        for item in [bar.stackedLayoutAppearance,
                     bar.inlineLayoutAppearance,
                     bar.compactInlineLayoutAppearance] {
            item.normal.iconColor = UIColor(Tok.muted)
            item.normal.titleTextAttributes = [.foregroundColor: UIColor(Tok.muted)]
            item.selected.iconColor = UIColor(Tok.accent)
            item.selected.titleTextAttributes = [.foregroundColor: UIColor(Tok.accent)]
        }

        UITabBar.appearance().standardAppearance = bar
        UITabBar.appearance().scrollEdgeAppearance = bar
    }
}

extension View {
    /// Pinned top chrome, drawn in the page colour rather than a material.
    ///
    /// It used to be glass. A system material takes its colour from the system,
    /// not from this palette, so on our slate page it composited to a neutral
    /// grey and the whole strip sat visibly off tone from everything under it.
    /// Nothing scrolls behind the top strip that is worth seeing through it
    /// anyway, so it is now flat `Tok.bg` and the seam is gone. The hairline
    /// stays: with chrome and page the same colour it is the only thing marking
    /// where the pinned strip ends and the scrolling content begins.
    ///
    /// The map tray still uses `bottomGlass`, where translucency earns its keep
    /// because live map tiles pass underneath.
    func topChrome() -> some View {
        self
            .background(alignment: .center) {
                Rectangle().fill(Tok.bg).ignoresSafeArea(edges: .top)
            }
            .overlay(alignment: .bottom) {
                Rectangle().fill(Tok.hairline).frame(height: 1)
            }
    }

    /// Pinned bottom chrome, the map tray. Same treatment, hairline on the top
    /// edge instead, and it deliberately does not reach into the safe area:
    /// the tray sits above the tab bar rather than under the home indicator.
    func bottomGlass(heavy: Bool = false) -> some View {
        self
            .background(alignment: .center) {
                ZStack {
                    Group {
                        if heavy {
                            Rectangle().fill(.regularMaterial)
                        } else {
                            Rectangle().fill(.ultraThinMaterial)
                        }
                    }
                    Rectangle().fill(Tok.glass)
                }
            }
            .overlay(alignment: .top) {
                Rectangle().fill(Tok.hairline).frame(height: 1)
            }
    }
}

/// The strip at the top of Discover, Saved and Search: the mark, the wordmark
/// and the settings gear. Settings is here now rather than in the tab bar, and
/// the gear carries a dot when interests are narrowing the feed, because a
/// filter you cannot see is the one that makes the app look broken.
struct BrandStrip: View {
    @EnvironmentObject var app: AppState
    @State private var showSettings = false

    var body: some View {
        HStack(spacing: 8) {
            PulseLogoView(size: 18)
            Text("Pulse")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Tok.text)
            Spacer(minLength: 8)
            settingsButton
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .sheet(isPresented: $showSettings) { PreferencesView() }
    }

    private var settingsButton: some View {
        Button { showSettings = true } label: {
            Image(systemName: "gearshape.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Tok.muted)
                .frame(width: 34, height: 34)
                .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(Tok.hairline, lineWidth: 1))
                .overlay(alignment: .topTrailing) {
                    if app.isPreferenceFiltered {
                        Circle().fill(Tok.accent)
                            .frame(width: 8, height: 8)
                            .overlay(Circle().stroke(Tok.panel2, lineWidth: 1.5))
                            .offset(x: 2, y: -2)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(settingsLabel)
    }

    private var settingsLabel: String {
        app.isPreferenceFiltered ? "Settings, interests are filtering the feed" : "Settings"
    }
}
