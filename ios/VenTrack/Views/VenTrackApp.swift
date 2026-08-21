import SwiftUI
import UIKit

@main
struct VenTrackApp: App {
    @StateObject private var app = AppState()
    @StateObject private var store = Store()

    init() { Chrome.apply() }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .environmentObject(store)
                .tint(Tok.accent)
                .task {
                    // Housekeeping, and it runs HERE rather than in AppState's
                    // initializer because this task starts after the first
                    // frame. Writing UserDefaults and scheduling notifications
                    // is not much work, but none of it has any business
                    // happening between launch and something being on screen.
                    app.pruneExpiredSaves()

                    // AppState owns every gate; Store owns StoreKit. This is
                    // the one wire between them, set before the first refresh
                    // so no answer is missed.
                    store.onChange = { unlocked, resolved in
                        app.applyEntitlement(unlocked: unlocked, resolved: resolved)
                    }
                    await store.refresh()
                    // Fetched early so the price is already in hand whenever a
                    // gate is hit, rather than the sheet opening on a button
                    // with no price on it.
                    await store.loadProduct()
                }
        }
    }
}

/// iPhone only. There was a separate regular size class layout here, a three
/// pane iPad shell, and it has been removed rather than left switched off: it
/// was the least exercised part of the app, and shipping it would have meant
/// maintaining a second layout and supplying a second set of App Store
/// screenshots for it. `TARGETED_DEVICE_FAMILY` in `project.rb` is now `1` to
/// match, so the App Store listing is iPhone only and Apple stops asking.
///
/// It is in the history if it is ever wanted back, and the size class is the
/// right thing to branch on when that day comes, since Split View and Stage
/// Manager hand an app a compact width on an iPad too.
struct RootView: View {
    @EnvironmentObject var app: AppState

    /// THE ONLY LAYOUT BRANCH IN THE APP, and it needs to stay that way.
    ///
    /// One decision, at the top, so there is exactly one place to look when a
    /// layout turns up at the wrong size. Every screen below this point is size
    /// class agnostic, which is what makes Split View, Slide Over and Stage
    /// Manager correct without any of them being thought about individually.
    ///
    /// It is also what made this work tractable. The compact path is the app
    /// that already shipped, so the job was adding a regular path beside it
    /// rather than making twelve screens adaptive.
    ///
    /// Regular does NOT mean iPad and compact does NOT mean iPhone. An iPad in
    /// Slide Over is compact, an iPad in a half width Split View is compact,
    /// and both should be getting the phone layout. Branching on the idiom
    /// instead of the size class is the classic way to produce a two column
    /// layout squeezed into a third of a screen.
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        Group {
            if !app.onboarded {
                // Onboarding is one column at any width. It is a first run
                // sequence rather than a place you navigate, so a sidebar
                // pointing at destinations you have not reached yet would be
                // offering navigation to nowhere.
                OnboardingView()
            } else if sizeClass == .regular {
                PadRootView()
            } else {
                MainTabView()
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
        // The one unlock sheet for everything reachable from the four tabs.
        // Presented here rather than per screen because a gate can fire from a
        // row inside a lazy list, and a sheet attached to every row is how you
        // get one that presents the wrong thing or nothing at all. The two
        // screens that are themselves sheets carry their own.
        .paywall($app.unlockPrompt)
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
    ///
    /// Main actor because `UITabBar.appearance()` is a class method on a UIView
    /// subclass, and those are main-actor isolated in the SDK. The only caller
    /// is `VenTrackApp.init()`, which is already on the main actor by way of the
    /// `App` protocol, so the annotation costs nothing.
    @MainActor static func apply() {
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

    /// Glass for the cards that float over the map: the tray's carousel cards
    /// and the callout above a tapped pin. These used to be flat `Tok.panel`,
    /// which read as slabs dropped on the map rather than as part of it.
    ///
    /// Material supplies the blur, the tint supplies the colour, same as every
    /// other sheet of glass here. The tint stays at the solved 0.88: against a
    /// pale stretch of map, `muted` sits at 4.73:1 and clears the bar, while
    /// `faint` would fall to 3.62:1 and `accent` to 3.87:1. That is exactly why
    /// the rule above says nothing quieter than `muted` goes on glass, and why
    /// the overlines on these two cards moved off `faint` when they moved onto
    /// it. In practice the map follows the app's colour scheme, so the backdrop
    /// is dark under a dark theme, but the tint is not sized for the average
    /// case.
    func cardGlass(cornerRadius: CGFloat) -> some View {
        self.background {
            ZStack {
                RoundedRectangle(cornerRadius: cornerRadius).fill(.ultraThinMaterial)
                RoundedRectangle(cornerRadius: cornerRadius).fill(Tok.glass)
            }
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
    /// When set, the strip names this place instead of the app.
    ///
    /// The feed uses it once its own large title has scrolled out of sight, so
    /// there is always something on screen saying which town the listings are
    /// for. Deliberately the SAME row rather than a second bar that appears:
    /// the logo and the town name are both one line of 15pt text next to a 34pt
    /// button, so swapping them changes nothing about the strip's height and
    /// nothing below it moves. That is the entire point. A bar that changes
    /// size pushes the feed around underneath it, and no amount of easing makes
    /// being shoved feel deliberate.
    var place: String?

    @EnvironmentObject var app: AppState
    @State private var showSettings = false

    var body: some View {
        HStack(spacing: 8) {
            if let place {
                Text(place)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Tok.text)
                    .lineLimit(1)
                    .accessibilityLabel("Showing events for \(place)")
            } else {
                VenTrackLogoView(size: 18)
                Text("VenTrack")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Tok.text)
            }
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
