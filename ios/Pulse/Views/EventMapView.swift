import SwiftUI
import MapKit

/// The set of events the user surfaced by tapping somewhere on the map.
/// `title` is what the tray header shows, e.g. "3 events near Massey Hall".
struct AreaFocus: Equatable {
    let title: String
    let ids: [String]
}

struct EventMapView: View {
    @EnvironmentObject var app: AppState
    @State private var selectedID: String?
    @State private var detail: Event?
    // Bumped when the locate button is tapped; EventMapKit watches this to recenter.
    @State private var recenterTick = 0
    // The bottom tray collapses so the map can be browsed full screen.
    @State private var trayHidden = false
    // Set when a pin or cluster is tapped: the events at that spot.
    @State private var focus: AreaFocus?

    // MKMapView clusters natively, so it stays smooth with many pins.
    private static let maxPins = 250
    /// Two pins count as "the same area" within this distance of each other.
    private static let areaRadiusM: CLLocationDistance = 400

    private var mapped: [Event] { Array(app.visibleEvents.filter(\.hasCoordinate).prefix(Self.maxPins)) }

    /// What the tray lists: the tapped area if there is one, otherwise everything.
    private var trayEvents: [Event] {
        guard let focus else { return Array(mapped.prefix(40)) }
        let wanted = Set(focus.ids)
        return mapped.filter { wanted.contains($0.id) }
    }

    var body: some View {
        ZStack(alignment: .top) {
            // UIKit MKMapView wrapper — SwiftUI's `Map` trips a Metal multisample
            // assertion that freezes/crashes the app on the current SDK.
            EventMapKit(events: mapped,
                        selectedID: $selectedID,
                        showsUser: app.locAuthorized,
                        userCoordinate: app.origin,
                        recenterTick: recenterTick,
                        onTapArea: { anchor, members in focusArea(at: anchor, members: members) })
                .ignoresSafeArea()
                .overlay(vignette)

            rangePills

            if let id = selectedID, let e = mapped.first(where: { $0.id == id }) {
                PiPCard(event: e) { detail = e }
                    .padding(.top, 70)
                    .transition(.scale.combined(with: .opacity))
            }

            VStack(spacing: 0) {
                Spacer()
                HStack {
                    Spacer()
                    locateButton
                        .padding(.trailing, 16)
                        .padding(.bottom, 12)
                }
                if trayHidden {
                    revealBar
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                } else {
                    tray
                        .transition(.move(edge: .bottom))
                }
            }
        }
        .animation(.spring(response: 0.34, dampingFraction: 0.86), value: trayHidden)
        .animation(.easeInOut(duration: 0.22), value: focus)
        .sheet(item: $detail) { EventDetailView(event: $0) }
    }

    // MARK: - Area focus

    /// Called when a pin or a cluster is tapped. `members` is the cluster's
    /// contents when a cluster was tapped, or the single event otherwise; either
    /// way we widen it to everything within a short walk of the tap, because
    /// "what's on here" is more useful than "the one pin you happened to hit".
    private func focusArea(at anchor: CLLocationCoordinate2D, members: [Event]) {
        let centre = CLLocation(latitude: anchor.latitude, longitude: anchor.longitude)
        var ids = Set(members.map(\.id))
        for e in mapped {
            guard let lat = e.lat, let lng = e.lng else { continue }
            if CLLocation(latitude: lat, longitude: lng).distance(from: centre) <= Self.areaRadiusM {
                ids.insert(e.id)
            }
        }
        let hits = mapped.filter { ids.contains($0.id) }
        guard !hits.isEmpty else { return }

        // Name the area after the venue most of the hits share, if there is one.
        let venue = Dictionary(grouping: hits.compactMap(\.venue), by: { $0 })
            .max { $0.value.count < $1.value.count }?.key
        let noun = hits.count == 1 ? "event" : "events"
        let title = venue.map { "\(hits.count) \(noun) near \($0)" } ?? "\(hits.count) \(noun) here"

        focus = AreaFocus(title: title, ids: hits.map(\.id))
        // Tapping the map is a request to see what's there, so open the tray.
        trayHidden = false
    }

    private func clearFocus() {
        focus = nil
        selectedID = nil
    }

    // MARK: - Bottom tray

    private var tray: some View {
        VStack(spacing: 0) {
            trayHeader
            carousel
        }
        .background(.ultraThinMaterial)
    }

    private var trayHeader: some View {
        HStack(spacing: 10) {
            Text(focus?.title ?? "\(trayEvents.count) nearby")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(focus == nil ? Tok.muted : Tok.accent)
                .lineLimit(1)

            Spacer(minLength: 0)

            if focus != nil {
                Button { clearFocus() } label: {
                    Text("Show all")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Tok.muted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Show all events again")
            }

            Button { trayHidden = true } label: {
                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Tok.muted)
                    .frame(width: 30, height: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Hide the event list and show the full map")
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 2)
    }

    /// The pill that brings the tray back once it has been collapsed.
    private var revealBar: some View {
        Button { trayHidden = false } label: {
            HStack(spacing: 6) {
                Image(systemName: "chevron.up").font(.system(size: 11, weight: .bold))
                Text(focus?.title ?? "\(trayEvents.count) events")
                    .font(.system(size: 12.5, weight: .semibold))
                    .lineLimit(1)
            }
            .foregroundStyle(Tok.text)
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
            .shadow(color: .black.opacity(0.3), radius: 8, y: 3)
        }
        .buttonStyle(.plain)
        .padding(.bottom, 14)
        .accessibilityLabel("Show the event list")
    }

    // Recenters the map on the user's current location. Taps recenter when
    // location is granted; otherwise it prompts (or points to Settings).
    private var locateButton: some View {
        Button {
            if app.locAuthorized {
                recenterTick += 1
            } else {
                app.tapLocationChip()
            }
        } label: {
            Image(systemName: "location.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(app.locAuthorized ? Tok.accent : Tok.muted)
                .frame(width: 44, height: 44)
                .background(Tok.panel, in: Circle())
                .overlay(Circle().stroke(Tok.hairline, lineWidth: 1))
                .shadow(color: .black.opacity(0.28), radius: 6, y: 2)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Recenter on my location")
    }

    // Cheap edge-darkening for legibility — a radial gradient, NOT a blur.
    private var vignette: some View {
        RadialGradient(colors: [.clear, .black.opacity(0.28)],
                       center: .center, startRadius: 200, endRadius: 540)
            .allowsHitTesting(false).ignoresSafeArea()
    }

    private var rangePills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(EventService.Range.allCases, id: \.self) { r in
                    Pill(text: r.label, active: app.range == r, color: Tok.accent) {
                        app.range = r
                        focus = nil
                        Task { await app.load() }
                    }
                    .shadow(color: .black.opacity(0.3), radius: 6, y: 2)
                }
            }.padding(.horizontal, 12)
        }
        .padding(.top, 8)
    }

    private var carousel: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(trayEvents) { e in
                    CarouselCard(event: e) { select(e); detail = e }
                        .frame(width: 260)
                        .onTapGesture { select(e) }
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
        }
    }

    // Selecting recenters the map: EventMapKit reads selectedID and animates to it.
    private func select(_ e: Event) { selectedID = e.id }
}

// MARK: - UIKit map (stable; SwiftUI Map's Metal renderer freezes on this SDK)

/// An MKAnnotation that carries the full Event so the delegate can style + report it.
final class EventAnnotation: NSObject, MKAnnotation {
    let event: Event
    let coordinate: CLLocationCoordinate2D
    var title: String? { event.title }
    init(_ event: Event) {
        self.event = event
        self.coordinate = CLLocationCoordinate2D(latitude: event.lat ?? 0, longitude: event.lng ?? 0)
    }
}

struct EventMapKit: UIViewRepresentable {
    var events: [Event]
    @Binding var selectedID: String?
    var showsUser: Bool
    var userCoordinate: CLLocationCoordinate2D?
    var recenterTick: Int
    /// Reports the spot the user tapped and the events sitting on it.
    /// Defaults to a no-op so callers that have their own list (the iPad rail)
    /// can keep using the map without wiring up a tray.
    var onTapArea: (CLLocationCoordinate2D, [Event]) -> Void = { _, _ in }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.pointOfInterestFilter = .excludingAll
        map.showsUserLocation = showsUser
        map.register(MKMarkerAnnotationView.self, forAnnotationViewWithReuseIdentifier: "ev")
        map.register(MKMarkerAnnotationView.self,
                     forAnnotationViewWithReuseIdentifier: MKMapViewDefaultClusterAnnotationViewReuseIdentifier)
        map.setRegion(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 43.6532, longitude: -79.3832),
            span: MKCoordinateSpan(latitudeDelta: 0.09, longitudeDelta: 0.09)), animated: false)
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.parent = self
        map.showsUserLocation = showsUser
        context.coordinator.sync(map)
        context.coordinator.recenterIfNeeded(map)
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        var parent: EventMapKit
        private var idsOnMap: Set<String> = []
        private var annoByID: [String: EventAnnotation] = [:]
        private var programmatic = false
        private var lastRecenterTick = 0

        init(_ parent: EventMapKit) { self.parent = parent }

        /// Animate to the user's current location when the locate button is tapped.
        /// Prefers the live blue-dot location, falling back to the app's origin.
        func recenterIfNeeded(_ map: MKMapView) {
            guard parent.recenterTick != lastRecenterTick else { return }
            lastRecenterTick = parent.recenterTick

            var target: CLLocationCoordinate2D?
            if let live = map.userLocation.location?.coordinate,
               CLLocationCoordinate2DIsValid(live),
               !(live.latitude == 0 && live.longitude == 0) {
                target = live
            } else if let origin = parent.userCoordinate {
                target = origin
            }
            guard let center = target else { return }

            let region = MKCoordinateRegion(
                center: center,
                span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05))
            map.setRegion(region, animated: true)
        }

        func sync(_ map: MKMapView) {
            let newIDs = Set(parent.events.map(\.id))
            if newIDs != idsOnMap {
                for id in idsOnMap.subtracting(newIDs) {
                    if let a = annoByID[id] { map.removeAnnotation(a); annoByID[id] = nil }
                }
                var toAdd: [EventAnnotation] = []
                for e in parent.events where !idsOnMap.contains(e.id) {
                    let a = EventAnnotation(e); annoByID[e.id] = a; toAdd.append(a)
                }
                if !toAdd.isEmpty { map.addAnnotations(toAdd) }
                idsOnMap = newIDs
            }

            // Sync selection both ways.
            let currentlySelected = (map.selectedAnnotations.first as? EventAnnotation)?.event.id
            if parent.selectedID != currentlySelected {
                programmatic = true
                if let sid = parent.selectedID, let a = annoByID[sid] {
                    map.selectAnnotation(a, animated: true)
                    map.setCenter(a.coordinate, animated: true)
                } else if parent.selectedID == nil {
                    map.selectedAnnotations.forEach { map.deselectAnnotation($0, animated: true) }
                }
                programmatic = false
            }
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            if annotation is MKUserLocation { return nil }
            if let cluster = annotation as? MKClusterAnnotation {
                let v = mapView.dequeueReusableAnnotationView(
                    withIdentifier: MKMapViewDefaultClusterAnnotationViewReuseIdentifier, for: cluster) as! MKMarkerAnnotationView
                v.markerTintColor = UIColor(Tok.accent)
                v.glyphText = "\(cluster.memberAnnotations.count)"
                v.displayPriority = .required
                return v
            }
            guard let ev = annotation as? EventAnnotation else { return nil }
            let v = mapView.dequeueReusableAnnotationView(withIdentifier: "ev", for: ev) as! MKMarkerAnnotationView
            let style = Categories.style(ev.event.category)
            v.markerTintColor = UIColor(style.color)
            v.glyphText = style.glyph
            v.clusteringIdentifier = "ev"
            v.displayPriority = .defaultLow
            return v
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            if programmatic { return }

            // A cluster is literally "the events around this spot" — list them
            // in the tray rather than making the user zoom in and hunt.
            if let cluster = view.annotation as? MKClusterAnnotation {
                let members = cluster.memberAnnotations.compactMap { ($0 as? EventAnnotation)?.event }
                let anchor = cluster.coordinate
                mapView.deselectAnnotation(cluster, animated: false)
                var r = mapView.region
                r.center = anchor
                r.span = MKCoordinateSpan(latitudeDelta: max(r.span.latitudeDelta / 3.5, 0.002),
                                          longitudeDelta: max(r.span.longitudeDelta / 3.5, 0.002))
                mapView.setRegion(r, animated: true)
                let report = parent.onTapArea
                DispatchQueue.main.async { report(anchor, members) }
                return
            }

            if let ev = view.annotation as? EventAnnotation {
                let id = ev.event.id
                let anchor = ev.coordinate
                let event = ev.event
                let report = parent.onTapArea
                DispatchQueue.main.async {
                    self.parent.selectedID = id
                    report(anchor, [event])
                }
            }
        }

        func mapView(_ mapView: MKMapView, didDeselect view: MKAnnotationView) {
            if programmatic { return }
            if let ev = view.annotation as? EventAnnotation {
                DispatchQueue.main.async {
                    if self.parent.selectedID == ev.event.id { self.parent.selectedID = nil }
                }
            }
        }
    }
}

struct PiPCard: View {
    let event: Event
    let onTap: () -> Void
    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Categories.gradient(event.category)
                Text(Categories.style(event.category).glyph).font(.system(size: 24))
            }.frame(width: 56, height: 56).clipShape(RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 3) {
                Text(event.title).font(.system(size: 14, weight: .bold)).foregroundStyle(Tok.text).lineLimit(1)
                Text("\(Fmt.time(event.startDate)) · \(event.venue ?? "Venue TBA")")
                    .font(.system(size: 12)).foregroundStyle(Tok.muted).lineLimit(1)
                Text("\(Fmt.distance(event.distanceKm)) · \(Fmt.relDay(event.startDate))")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(Tok.accent)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: 320)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
        .shadow(color: .black.opacity(0.35), radius: 12, y: 6)
        .padding(.horizontal, 16)
        .onTapGesture(perform: onTap)
    }
}

struct CarouselCard: View {
    let event: Event
    let onOpen: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topLeading) {
                Categories.gradient(event.category)
                if let img = event.image, let url = URL(string: img) {
                    AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
                }
                let b = Fmt.badge(event.startDate)
                HStack {
                    VStack(spacing: 0) {
                        Text(b.m).font(.system(size: 9, weight: .heavy)).foregroundStyle(Tok.accent)
                        Text(b.day).font(.system(size: 15, weight: .heavy)).foregroundStyle(.white)
                    }.padding(.horizontal, 6).padding(.vertical, 3)
                        .background(.black.opacity(0.8), in: RoundedRectangle(cornerRadius: 7))
                    Spacer()
                    Text(Fmt.distance(event.distanceKm)).font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 9).padding(.vertical, 3)
                        .background(.black.opacity(0.8), in: Capsule())
                }.padding(8)
            }
            .frame(height: 96).clipped()
            VStack(alignment: .leading, spacing: 4) {
                Text(event.title).font(.system(size: 14.5, weight: .bold)).foregroundStyle(Tok.text).lineLimit(1)
                Text("\(Fmt.time(event.startDate)) · \(event.venue ?? "Venue TBA")")
                    .font(.system(size: 12)).foregroundStyle(Tok.muted).lineLimit(1)
            }.padding(10)
        }
        .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
    }
}
