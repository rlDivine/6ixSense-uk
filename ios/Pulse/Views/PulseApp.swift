import SwiftUI

@main
struct PulseApp: App {
    @StateObject private var app = AppState()

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

struct MainTabView: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        TabView(selection: $app.tab) {
            DiscoverView()
                .tabItem { Label("Discover", systemImage: "house.fill") }.tag(0)
            EventMapView()
                .tabItem { Label("Map", systemImage: "map.fill") }.tag(1)
            SavedView()
                .tabItem { Label("Saved", systemImage: "bookmark.fill") }.tag(2)
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
