import Foundation
import CoreLocation
import SwiftUI
import UIKit
import UserNotifications

@MainActor
final class AppState: NSObject, ObservableObject {
    // Feed
    @Published var events: [Event] = []
    @Published var loading = false
    @Published var errorMessage: String?
    @Published var lastLoad: Date?

    // Navigation
    @Published var tab = 0

    // Controls
    @Published var sort: EventService.Sort = .nearest
    /// Seven days ahead, which is the free window and also a sensible default
    /// for an events app whatever you have paid. "All upcoming" is one tap
    /// away once unlocked. See `Gate` below.
    @Published var range: EventService.Range = .week
    @Published var category: String = "All"
    @Published var search: String = ""

    // Region: which UK town the backend built this feed for. Resolved
    // server-side from `origin`, so a user who opens the app in Leeds gets
    // Leeds events.
    @Published var region: Region?

    /// False once we learn the device is outside the UK. VenTrack covers the UK
    /// only: the backend serves London in that case, and the app says so
    /// instead of labelling those listings "near you".
    @Published var inMarket = true

    // Location
    /// Where the device actually is, from CoreLocation. May be nil.
    @Published var deviceOrigin: CLLocationCoordinate2D?
    @Published var locAuthorized = false
    private let locManager = CLLocationManager()

    /// A place the user picked by hand: a town in Preferences, or an address
    /// typed into the search bar. While this is set, GPS is ignored entirely.
    @Published private(set) var placeOverride: PlaceOverride?

    /// The curated countries offered by the picker, fetched from the backend so
    /// new regions appear without shipping a build.
    @Published var countries: [RegionCountry] = []

    /// The point the feed is built around: the manual override if there is one,
    /// otherwise the device's own location.
    var origin: CLLocationCoordinate2D? { placeOverride?.coordinate ?? deviceOrigin }

    /// True when we have *some* point to sort distances from. Views use this
    /// rather than `origin == nil` so a manual override reads as "located".
    var hasOrigin: Bool { origin != nil }

    // Onboarding gate (mandatory first-run).
    //
    // Deliberately a @Published property backed by UserDefaults rather than
    // @AppStorage. @AppStorage only drives invalidation through DynamicProperty
    // inside a View; in an ObservableObject its setter writes the default
    // without firing objectWillChange, so finishing onboarding did not reliably
    // swap the root view over. It waited for some unrelated published change.
    @Published var onboarded = UserDefaults.standard.bool(forKey: "onboarded") {
        didSet { UserDefaults.standard.set(onboarded, forKey: "onboarded") }
    }

    // Preferences. Only events matching these are shown on Discover and Map.
    @Published var preferredCategories: Set<String> = []

    // Persistence
    @Published var saved: [String: Event] = [:]
    @Published var reminders: Set<String> = []

    // MARK: The gate
    //
    // VenTrack is free to download and genuinely useful without paying: the
    // town you are standing in, every category, every source, the map, and the
    // next seven days. Three things are behind the one-time unlock, and they
    // are the three that only start to matter once you already like it.
    //
    //   1. Any town other than the one you are in. `placeOverride` is the
    //      single funnel for that, whether it came from the town list, the
    //      country row or a typed address.
    //   2. Looking further ahead than seven days, which is `range == .all`.
    //   3. Keeping more than a handful of events, and reminders at all.
    //
    // Saving is not gated outright. A free allowance means the feature can be
    // found and felt before it asks for anything, which converts better than a
    // wall and is a better app besides. Reminders are gated outright because
    // they are the part that needs notification permission and are unambiguously
    // the premium half of Saved.

    /// How many events a free user may keep. Small enough to matter, large
    /// enough that the feature is real rather than a demo.
    ///
    /// `nonisolated` because `UnlockReason.lede` reads it to write the sentence
    /// about the allowance, and that is a plain value type with no actor. A
    /// static `let` of a Sendable type is safe to read from anywhere; without
    /// the keyword it inherits this class's main-actor isolation.
    nonisolated static let freeSaveLimit = 3

    /// Mirrors `Store.unlocked`. Views read this rather than reaching for the
    /// Store, so every gate in the app is one property on one object.
    @Published private(set) var unlocked = false

    /// False until StoreKit has answered once. Nothing that takes something
    /// away from the user may act before this is true, because the value above
    /// starts from a cached guess.
    @Published private(set) var entitlementResolved = false

    /// Whether a saved event still counts as a save.
    ///
    /// THE ONE DEFINITION, and it is one because it used to be two. The Saved
    /// list showed only events that had not finished yet, while the allowance
    /// counted every row in storage. So a bookmark on something that had since
    /// happened quietly held one of the three free slots while being invisible
    /// in the list and therefore impossible to remove: two events on screen,
    /// three saves spent, and the unlock offered on what looked like the third
    /// save rather than the fourth.
    ///
    /// Nothing here may count saves any other way. The list, the counter, the
    /// full check and the gate all go through this.
    ///
    /// Six hours of grace, so an event you saved this morning is still in the
    /// list while you are actually at it.
    static func counts(_ e: Event) -> Bool {
        guard let start = e.startDate else { return true }   // date to be announced
        return start > .now.addingTimeInterval(-6 * 3600)
    }

    /// Saves that have not expired. The number every gate and label uses.
    var liveSaveCount: Int { saved.values.filter(Self.counts).count }

    /// True when the free allowance is spent, so the interface can say so
    /// before the user taps a bookmark that will not take.
    var savedIsFull: Bool { !unlocked && liveSaveCount >= Self.freeSaveLimit }

    /// How many saves are left, for the line under the Saved list.
    var savesRemaining: Int { max(0, Self.freeSaveLimit - liveSaveCount) }

    /// Set by any gate reached from one of the four tabs, and presented once by
    /// `MainTabView`. It lives here rather than in each screen because a gate
    /// can fire from inside a lazily built list row, and attaching a sheet to
    /// every row of a list is how you get a sheet that presents the wrong thing
    /// or nothing at all.
    ///
    /// Screens that are themselves sheets, `EventDetailView` and
    /// `PreferencesView`, keep their own instead: a sheet cannot present
    /// another sheet from a view it is covering.
    @Published var unlockPrompt: UnlockReason?

    /// Called by `Store`. Takes away access only on a definitive answer, never
    /// on the cached guess: acting early would wipe a paying user's chosen town
    /// in the moment between launch and StoreKit replying.
    func applyEntitlement(unlocked isUnlocked: Bool, resolved: Bool) {
        unlocked = isUnlocked
        entitlementResolved = resolved
        guard resolved, !isUnlocked else { return }

        // Locked, definitively. This happens on a refund or a revoked purchase,
        // and on any device that never bought it.
        //
        // Note what is NOT undone here: saved events over the free limit stay
        // saved. Deleting somebody's list because they got a refund would be
        // hostile, and the allowance only governs adding.
        if range == .all {
            range = .week
            Task { await load() }
        }
        if placeOverride != nil {
            Task { await clearOverride() }
        }
    }

    override init() {
        super.init()
        locManager.delegate = self
        locManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        loadPersisted()
        // NOTE: pruneExpiredSaves() is deliberately NOT called here, though it
        // was briefly. This initializer runs while the first frame is being
        // put together, and that method writes UserDefaults and talks to
        // UNUserNotificationCenter. Neither belongs on the path between launch
        // and something appearing on screen. It runs from the root view's
        // task instead, which is after the first render rather than before it.
    }

    // MARK: Location

    /// Explicit ask. Prompts the system dialog when undetermined.
    /// Triggered by onboarding slide 2 and the header location chip.
    /// Safe to call on launch: prompts the first time, fetches if allowed,
    /// does nothing if denied (so it won't yank the user to Settings on launch).
    func requestLocation() {
        switch locManager.authorizationStatus {
        case .notDetermined: locManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways: locManager.requestLocation()
        default: break
        }
    }

    /// Explicit tap on the header location chip. If permission was previously
    /// denied (iOS won't re-prompt), send the user to Settings instead.
    func tapLocationChip() {
        switch locManager.authorizationStatus {
        case .denied, .restricted:
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
        default:
            requestLocation()
        }
    }

    /// Quiet path used when the feed appears: only use location if the user has
    /// already granted it, and never pop a system dialog over the feed.

    // MARK: Fetch

    func load() async {
        loading = true; errorMessage = nil
        do {
            let resp = try await EventService.fetch(sort: sort, range: range, origin: origin)
            events = resp.events
            region = resp.region
            // A manual override is the user's own choice of UK town, so it is
            // always in market. Only the device's own position can be abroad.
            inMarket = placeOverride != nil || (resp.inMarket ?? true)
            // The region stays the authority on units, even though every UK
            // region reports miles.
            if let unit = resp.region?.unit { Fmt.usesMiles = (unit == "mi") }
            lastLoad = .now
            scheduleAllReminders()
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }

    // MARK: Manual place override

    /// Fetch the country/city catalogue for the Settings picker. Cheap and
    /// cached server-side, so it is safe to call whenever Settings opens.
    func loadRegions() async {
        guard countries.isEmpty else { return }
        if let fetched = try? await EventService.regions() { countries = fetched }
    }

    /// Browse somewhere else. Persists the choice and reloads the feed around it.
    ///
    /// Returns false when the app is locked, so the caller shows the unlock
    /// sheet instead of appearing to do nothing. Every route to a different
    /// town runs through here, which is why the check lives here rather than
    /// being repeated at each of the three call sites.
    @discardableResult
    func setOverride(_ o: PlaceOverride) async -> Bool {
        guard unlocked else { return false }
        placeOverride = o
        persist()
        await load()
        return true
    }

    /// Go back to following the device's location.
    func clearOverride() async {
        guard placeOverride != nil else { return }
        placeOverride = nil
        persist()
        if deviceOrigin == nil { requestLocation() }
        await load()
    }

    /// Switch the whole feed to the country's primary town (London).
    /// False when locked, or when the country names no town.
    @discardableResult
    func selectCountry(_ c: RegionCountry) async -> Bool {
        guard let city = c.primary else { return false }
        return await setOverride(PlaceOverride(kind: .country, label: c.label, coordinate: city.coordinate))
    }

    /// Browse one specific town out of the region browser: a county town in
    /// Kent, say, rather than the whole of the United Kingdom.
    /// False when locked.
    @discardableResult
    func selectCity(_ city: RegionCountry.City) async -> Bool {
        await setOverride(PlaceOverride(kind: .city, label: city.label, coordinate: city.coordinate))
    }

    /// The box the address search geocodes inside: the whole of the UK, from
    /// the Isles of Scilly to Shetland. Without it, "Newport" or "Richmond"
    /// can just as easily resolve to Rhode Island or Virginia, a real hazard
    /// for British place names, most of which have an American namesake.
    ///
    /// CLCircularRegion is soft-deprecated (its replacement covers region
    /// *monitoring*), but CLGeocoder's biasing parameter still takes a CLRegion
    /// and this is the only concrete type that fits. The deprecation warning at
    /// build time is expected.
    private static let ukSearchRegion = CLCircularRegion(
        center: CLLocationCoordinate2D(latitude: 54.5, longitude: -3.5),
        radius: 800_000,          // metres, comfortably covering the UK
        identifier: "uk"
    )

    /// What happened when the user asked to re-centre on a typed address.
    /// Three outcomes rather than a Bool, because "we could not find that
    /// street" and "this is part of the paid unlock" need entirely different
    /// things said about them.
    enum AddressOutcome { case moved, notFound, locked }

    /// Re-centre the feed on a typed address. Geocoding happens on-device, so
    /// there is no API key and no extra hop through our backend.
    @discardableResult
    func searchAddress(_ text: String) async -> AddressOutcome {
        let query = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return .notFound }
        // Checked before geocoding, not after: there is no reason to spend a
        // geocode on a move that is not going to happen.
        guard unlocked else { return .locked }
        let marks = try? await CLGeocoder().geocodeAddressString(
            query, in: Self.ukSearchRegion, preferredLocale: Locale(identifier: "en_GB")
        )
        // Biasing to the UK is a hint, not a guarantee, so take the first hit
        // that is genuinely in the country and reject the rest. A feed built
        // around Newport, Rhode Island would be empty and confusing.
        guard let mark = marks?.first(where: { $0.isoCountryCode == "GB" }),
              let loc = mark.location else { return .notFound }
        // Prefer the geocoder's tidy name over whatever the user typed.
        let label = [mark.name, mark.locality].compactMap { $0 }.first ?? query
        let moved = await setOverride(PlaceOverride(kind: .address, label: label, coordinate: loc.coordinate))
        return moved ? .moved : .locked
    }

    /// Where this feed is for, in words, for headers and empty states.
    /// Before the first feed lands, and if the backend ever declines to name a
    /// region, this reads as "the UK" rather than inventing a town.
    var placeName: String { placeOverride?.label ?? region?.label ?? "the UK" }

    /// What the header's location chip says: the place the user picked, "You"
    /// when we are ranking from their own position, and the town we fell back
    /// to otherwise (including when they are outside the UK).
    var locationChipLabel: String {
        if let o = placeOverride { return o.label }
        return (deviceOrigin != nil && inMarket) ? "You" : placeName
    }

    /// How to describe the feed's centre in a sentence: "near you", "near
    /// Canterbury", or "in London" for someone abroad, where "near you" would
    /// be plainly untrue.
    var originPhrase: String {
        if let o = placeOverride { return "near \(o.label)" }
        if deviceOrigin != nil && inMarket { return "near you" }
        return "in \(placeName)"
    }

    /// True only when preferences actually narrow the feed, that is some but not
    /// all, interests are selected. (All selected ≈ none selected ≈ show all.)
    var isPreferenceFiltered: Bool {
        !preferredCategories.isEmpty && preferredCategories.count < Preferences.all.count
    }

    /// Turn one interest on or off. Persisted on every tap, because onboarding
    /// can be finished and the app killed before anything else writes.
    func togglePreference(_ id: String) {
        if preferredCategories.contains(id) { preferredCategories.remove(id) }
        else { preferredCategories.insert(id) }
        persist()
    }

    /// Back to showing everything.
    func clearPreferences() {
        guard !preferredCategories.isEmpty else { return }
        preferredCategories.removeAll()
        persist()
    }

    /// True if the event matches the user's chosen interests (or if none chosen).
    func matchesPreferences(_ e: Event) -> Bool {
        guard !preferredCategories.isEmpty else { return true }
        let cat = e.category.lowercased()
        for pref in Preferences.with(ids: preferredCategories) {
            if pref.id == "free" && e.isFree { return true }
            if pref.keywords.contains(where: { cat.contains($0) }) { return true }
        }
        return false
    }

    /// Drop undated events for the dated ranges so "Today"/"This week" never
    /// show events with an unknown date (the "·" badge).
    private func passesDateGuard(_ e: Event) -> Bool {
        range == .all ? true : e.startDate != nil
    }

    // MARK: Derived

    /// Base browse feed: preference- and date-filtered. Discover + Map use this.
    var feed: [Event] { events.filter { matchesPreferences($0) && passesDateGuard($0) } }

    var categoryChips: [String] {
        var counts: [String: Int] = [:]
        for e in feed { counts[e.category, default: 0] += 1 }
        let free = feed.filter(\.isFree).count
        let ordered = counts.keys.sorted { counts[$0]! > counts[$1]! }.filter { $0 != "Free" }
        var chips = ["All"]
        if free > 0 { chips.append("Free") }
        chips.append(contentsOf: ordered)
        return Array(chips.prefix(16))
    }

    var visibleEvents: [Event] {
        switch category {
        case "All": return feed
        case "Free": return feed.filter(\.isFree)
        default: return feed.filter { $0.category == category }
        }
    }

    /// Search result: whatever date/date-range was parsed out of the query
    /// (nil if none), plus the events matching both the date and any
    /// leftover text (title/venue/category).
    struct SearchOutcome {
        let dateQuery: DateQuery?
        let events: [Event]
    }

    func searchResults(_ q: String) -> SearchOutcome {
        let trimmed = q.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return SearchOutcome(dateQuery: nil, events: []) }
        let parsed = DateQueryParser.parse(trimmed)
        var hits = events
        if let dq = parsed {
            hits = hits.filter { $0.startDate.map(dq.range.contains) ?? false }
        }
        let needle = (parsed?.rest ?? trimmed).lowercased().trimmingCharacters(in: .whitespaces)
        if !needle.isEmpty {
            hits = hits.filter {
                $0.title.lowercased().contains(needle)
                || ($0.venue ?? "").lowercased().contains(needle)
                || $0.category.lowercased().contains(needle)
            }
        }
        return SearchOutcome(dateQuery: parsed, events: hits)
    }

    // MARK: Save / reminders

    func isSaved(_ e: Event) -> Bool { saved[e.id] != nil }

    /// Returns false only when a save was refused because the free allowance is
    /// spent, so the caller can offer the unlock rather than leaving a bookmark
    /// button that visibly does nothing.
    ///
    /// Unsaving is never refused, including when the list is already over the
    /// limit after a refund. Taking something away is not something the gate
    /// should ever be in the way of.
    @discardableResult
    func toggleSave(_ e: Event) -> Bool {
        if saved[e.id] != nil {
            saved[e.id] = nil
            reminders.remove(e.id)
            persist()
            return true
        }
        guard unlocked || liveSaveCount < Self.freeSaveLimit else { return false }
        saved[e.id] = e
        persist()
        return true
    }

    /// Drops saves for events that have already happened.
    ///
    /// Not what makes the allowance correct. `liveSaveCount` is what does that,
    /// and it is right whether or not this has run, which is deliberate: an
    /// event can expire while the app is open, and a count that depended on
    /// housekeeping having happened would be wrong for exactly as long as it
    /// took to notice.
    ///
    /// This is here so storage does not grow forever, and so the bookmark on an
    /// old event stops being filled in. Any reminder attached to a dropped
    /// event goes with it: a notification for something that has finished is
    /// worse than none.
    func pruneExpiredSaves() {
        let live = saved.filter { Self.counts($0.value) }
        guard live.count != saved.count else { return }
        for id in Set(saved.keys).subtracting(live.keys) { reminders.remove(id) }
        saved = live
        persist()
        scheduleAllReminders()
    }

    /// False when locked. Switching a reminder off is still allowed, so a
    /// refunded user is not left with notifications they cannot stop.
    @discardableResult
    func toggleReminder(_ e: Event) -> Bool {
        if reminders.contains(e.id) {
            reminders.remove(e.id)
        } else {
            guard unlocked else { return false }
            reminders.insert(e.id)
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        }
        persist(); scheduleAllReminders()
        return true
    }

    /// What the Saved tab lists. The filter is `counts` rather than a copy of
    /// it, which is the whole point: this list and the allowance were two
    /// spellings of the same rule and they disagreed.
    var savedUpcoming: [Event] {
        saved.values
            .filter(Self.counts)
            .sorted { ($0.startDate ?? .distantFuture) < ($1.startDate ?? .distantFuture) }
    }

    private func scheduleAllReminders() {
        let center = UNUserNotificationCenter.current()
        for id in reminders {
            guard let e = saved[id], let start = e.startDate else { continue }
            let fireAt = start.addingTimeInterval(-2 * 3600)
            guard fireAt > .now else { continue }
            let content = UNMutableNotificationContent()
            content.title = "Starting soon: \(e.title)"
            content.body = "\(Fmt.time(start)) · \(e.venue ?? placeName)"
            let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: fireAt)
            let req = UNNotificationRequest(identifier: "remind-\(id)",
                                            content: content,
                                            trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false))
            center.add(req)
        }
    }

    // MARK: Persistence (UserDefaults)

    private func loadPersisted() {
        let d = UserDefaults.standard
        if let data = d.data(forKey: "saved"),
           let map = try? JSONDecoder().decode([String: Event].self, from: data) { saved = map }
        if let arr = d.array(forKey: "reminders") as? [String] { reminders = Set(arr) }
        if let arr = d.array(forKey: "preferredCategories") as? [String] { preferredCategories = Set(arr) }
        if let data = d.data(forKey: "placeOverride"),
           let o = try? JSONDecoder().decode(PlaceOverride.self, from: data) { placeOverride = o }
    }
    private func persist() {
        let d = UserDefaults.standard
        d.set(try? JSONEncoder().encode(saved), forKey: "saved")
        d.set(Array(reminders), forKey: "reminders")
        d.set(Array(preferredCategories), forKey: "preferredCategories")
        if let o = placeOverride {
            d.set(try? JSONEncoder().encode(o), forKey: "placeOverride")
        } else {
            d.removeObject(forKey: "placeOverride")
        }
    }
}

extension AppState: CLLocationManagerDelegate {
    nonisolated func locationManager(_ m: CLLocationManager, didChangeAuthorization s: CLAuthorizationStatus) {
        let ok = s == .authorizedWhenInUse || s == .authorizedAlways
        Task { @MainActor in self.locAuthorized = ok }
        if ok { m.requestLocation() }
    }
    nonisolated func locationManager(_ m: CLLocationManager, didUpdateLocations locs: [CLLocation]) {
        guard let c = locs.last?.coordinate else { return }
        Task { @MainActor in
            self.deviceOrigin = c
            // A manual override wins: reloading here would yank the user back
            // from the country or address they chose.
            guard self.placeOverride == nil else { return }
            await self.load()
        }
    }
    nonisolated func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {}
}
