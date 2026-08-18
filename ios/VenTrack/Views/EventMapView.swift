import SwiftUI
import UIKit
import MapKit
import CoreLocation
import QuartzCore

/// The set of events the user surfaced by tapping somewhere on the map.
/// `title` is what the tray header shows, e.g. "3 events near Brixton Academy".
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
    /// The centre of whatever the map is currently showing, reported back by
    /// the map itself. This is what "Search this area" re-centres the feed on.
    @State private var visibleCentre: CLLocationCoordinate2D?
    @State private var searchingArea = false

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
            // UIKit MKMapView wrapper. SwiftUI's `Map` trips a Metal multisample
            // assertion that freezes/crashes the app on the current SDK.
            EventMapKit(events: mapped,
                        selectedID: $selectedID,
                        showsUser: app.locAuthorized,
                        userCoordinate: app.origin,
                        recenterTick: recenterTick,
                        onTapArea: { anchor, members in focusArea(at: anchor, members: members) },
                        onRegionChange: { centre in visibleCentre = centre })
                .ignoresSafeArea()
                .overlay(vignette)

            searchBar

            if let id = selectedID, let e = mapped.first(where: { $0.id == id }) {
                PiPCard(event: e) { detail = e }
                    .padding(.top, 76)
                    .transition(.scale.combined(with: .opacity))
            }

            VStack(spacing: 0) {
                Spacer(minLength: 0)
                HStack {
                    Spacer(minLength: 0)
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

    // MARK: - Search this area

    /// The field along the top. It is a button rather than a text field: there
    /// is nothing to type, the query is "wherever I have just dragged to".
    private var searchBar: some View {
        HStack(spacing: 10) {
            Button { Task { await searchThisArea() } } label: {
                HStack(spacing: 9) {
                    Image(systemName: searchingArea ? "clock" : "magnifyingglass")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Tok.muted)
                    Text(searchingArea ? "Finding this area" : "Search this area")
                        .font(.system(size: 15))
                        .foregroundStyle(searchingArea ? Tok.muted : Tok.text)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(searchingArea || visibleCentre == nil)
            .accessibilityLabel("Search the area the map is showing")

            if canClear {
                Button { clearArea() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Tok.muted)
                        .frame(width: 48, height: 48)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear the area search")
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var canClear: Bool {
        app.placeOverride != nil || focus != nil || selectedID != nil
    }

    private func clearArea() {
        focus = nil
        selectedID = nil
        if app.placeOverride != nil { Task { await app.clearOverride() } }
    }

    /// Re-centres the whole feed on what the map is showing. The name comes
    /// from the geocoder, on device, so the rest of the app can still say where
    /// the feed is for: the Discover title and the status line both read it.
    @MainActor private func searchThisArea() async {
        guard let centre = visibleCentre, !searchingArea else { return }
        // Another route to a town you are not standing in, so it goes through
        // the same gate as the town list and the address search. Checked before
        // the reverse geocode rather than after: no point spending one on a
        // move that will not happen.
        guard app.unlocked else { app.unlockPrompt = .towns; return }
        searchingArea = true
        let here = CLLocation(latitude: centre.latitude, longitude: centre.longitude)
        let marks = try? await CLGeocoder().reverseGeocodeLocation(
            here, preferredLocale: Locale(identifier: "en_GB"))
        let mark = marks?.first
        let label = mark?.locality
            ?? mark?.subAdministrativeArea
            ?? mark?.administrativeArea
            ?? "This area"
        focus = nil
        selectedID = nil
        await app.setOverride(PlaceOverride(kind: .address, label: label, coordinate: centre))
        searchingArea = false
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

    /// Glass, and inside the safe area on purpose: the tray sits above the tab
    /// bar rather than sliding under the home indicator.
    private var tray: some View {
        VStack(spacing: 0) {
            trayHeader
            carousel
        }
        .bottomGlass(heavy: true)
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
        .padding(.top, 10)
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
            .padding(.vertical, 10)
            .background(.regularMaterial, in: Capsule())
            .overlay(Capsule().stroke(Tok.hairline, lineWidth: 1))
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
                .frame(width: 46, height: 46)
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().stroke(Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Recenter on my location")
    }

    // A flat scrim along the bottom edge, where the card carousel sits. It is
    // there so the cards keep their contrast over a light patch of map, and it
    // is a solid fill rather than the gradient it replaced.
    private var vignette: some View {
        VStack(spacing: 0) {
            Color.clear
            Color.black.opacity(0.22).frame(height: 120)
        }
        .allowsHitTesting(false).ignoresSafeArea()
    }

    private var carousel: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(trayEvents) { e in
                    CarouselCard(event: e) { select(e); detail = e }
                        .frame(width: 250)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
        }
    }

    // Selecting recenters the map: EventMapKit reads selectedID and animates to it.
    private func select(_ e: Event) { selectedID = e.id }
}

// MARK: - Marker artwork
//
// The markers are drawn as flat images rather than left to MKMarkerAnnotation
// View, because the design needs three things that class does not give: a size
// that changes with selection, a category fill that is the fixed `pin` value
// rather than the theme-adaptive one, and a count badge that is the selected
// navy instead of a red teardrop. Every fill here is flat.

enum PinRenderer {
    /// A teardrop in the category's pin colour with a white symbol on it. The
    /// head and the tail are two overlapping subpaths filled non-zero, which
    /// unions them into one shape with no seam down the join.
    static func pin(colour: UIColor, symbol: String, width: CGFloat) -> UIImage {
        let height = width * 1.30
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height))
        return renderer.image { _ in
            colour.setFill()

            let tail = UIBezierPath()
            tail.move(to: CGPoint(x: width * 0.22, y: width * 0.66))
            tail.addLine(to: CGPoint(x: width * 0.78, y: width * 0.66))
            tail.addLine(to: CGPoint(x: width * 0.50, y: height))
            tail.close()
            tail.fill()

            UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: width, height: width)).fill()

            let config = UIImage.SymbolConfiguration(pointSize: width * 0.40, weight: .semibold)
            guard let glyph = UIImage(systemName: symbol, withConfiguration: config)?
                .withTintColor(.white, renderingMode: .alwaysOriginal) else { return }
            glyph.draw(in: CGRect(x: (width - glyph.size.width) / 2,
                                  y: (width - glyph.size.height) / 2,
                                  width: glyph.size.width,
                                  height: glyph.size.height))
        }
    }

    /// A cluster: the selected background with the count in the matching
    /// foreground. Never a hardcoded white, which is near invisible on the
    /// dark theme's near-white fill.
    static func cluster(count: Int, fill: UIColor, ink: UIColor) -> UIImage {
        let label = count > 99 ? "99+" : "\(count)"
        let diameter: CGFloat = label.count > 2 ? 46 : 40
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: diameter, height: diameter))
        return renderer.image { _ in
            fill.setFill()
            UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: diameter, height: diameter)).fill()

            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 15, weight: .bold),
                .foregroundColor: ink
            ]
            let text = label as NSString
            let size = text.size(withAttributes: attributes)
            text.draw(at: CGPoint(x: (diameter - size.width) / 2,
                                  y: (diameter - size.height) / 2),
                      withAttributes: attributes)
        }
    }

    /// Where the user is: the link blue inside a white ring, so it reads on
    /// both the pale and the dark map.
    static func userDot(fill: UIColor) -> UIImage {
        let diameter: CGFloat = 22
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: diameter, height: diameter))
        return renderer.image { _ in
            UIColor.white.setFill()
            UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: diameter, height: diameter)).fill()
            fill.setFill()
            UIBezierPath(ovalIn: CGRect(x: 4, y: 4, width: diameter - 8, height: diameter - 8)).fill()
        }
    }
}

/// One event's marker. 30pt normally, 42pt when it is the selected one, with a
/// soft ring expanding out of the selected one and nothing else.
final class EventPinView: MKAnnotationView {
    static let reuseID = "eventPin"

    private let ring = CAShapeLayer()

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        canShowCallout = false
        ring.fillColor = UIColor.clear.cgColor
        ring.lineWidth = 2
        ring.opacity = 0
        layer.addSublayer(ring)
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("EventPinView is built in code only")
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        stopRing()
    }

    /// Redraws the marker for this event at the size the selection state asks
    /// for. `pin`, not `color`: a white symbol sits on this fill, and the
    /// theme-adaptive hues carry white at only 2:1 to 3:1.
    func apply(event: Event, selected: Bool) {
        let colour = UIColor(Categories.style(event.category).pin)
        let width: CGFloat = selected ? 42 : 30
        let marker = PinRenderer.pin(colour: colour,
                                     symbol: Categories.symbol(event.category),
                                     width: width)
        image = marker
        bounds = CGRect(origin: .zero, size: marker.size)
        // The tip of the teardrop is what sits on the coordinate, so the whole
        // marker is lifted by half its own height.
        centerOffset = CGPoint(x: 0, y: -marker.size.height / 2)
        clusteringIdentifier = "ev"
        displayPriority = selected ? .required : .defaultLow
        zPriority = selected ? .max : .defaultUnselected
        ring.strokeColor = colour.cgColor
        if selected { startRing(width: width) } else { stopRing() }
    }

    private func startRing(width: CGFloat) {
        stopRing()
        let centre = CGPoint(x: bounds.midX, y: width / 2)
        ring.frame = CGRect(x: centre.x - width / 2,
                            y: centre.y - width / 2,
                            width: width,
                            height: width)
        ring.path = UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: width, height: width)).cgPath

        let scale = CABasicAnimation(keyPath: "transform.scale")
        scale.fromValue = 0.75
        scale.toValue = 2.0
        let fade = CABasicAnimation(keyPath: "opacity")
        fade.fromValue = 0.5
        fade.toValue = 0.0

        let group = CAAnimationGroup()
        group.animations = [scale, fade]
        group.duration = 1.8
        group.repeatCount = .infinity
        group.timingFunction = CAMediaTimingFunction(name: .easeOut)
        ring.add(group, forKey: "pulse")
    }

    private func stopRing() {
        ring.removeAnimation(forKey: "pulse")
        ring.opacity = 0
    }
}

/// The count badge MapKit shows in place of pins that are too close together.
final class ClusterPinView: MKAnnotationView {
    static let reuseID = "eventCluster"

    private var count = 0

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        canShowCallout = false
        displayPriority = .required
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("ClusterPinView is built in code only")
    }

    func apply(count: Int) {
        self.count = count
        image = PinRenderer.cluster(
            count: count,
            fill: UIColor(Tok.activeBg).resolvedColor(with: traitCollection),
            ink: UIColor(Tok.activeFg).resolvedColor(with: traitCollection))
        centerOffset = .zero
    }

    /// Both of this badge's colours flip with the theme, and an image is
    /// resolved at the moment it is drawn, so it has to be drawn again.
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if previousTraitCollection?.userInterfaceStyle != traitCollection.userInterfaceStyle {
            apply(count: count)
        }
    }
}

/// The user's own position.
final class UserDotView: MKAnnotationView {
    static let reuseID = "userDot"

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        canShowCallout = false
        isEnabled = false
        displayPriority = .required
        redraw()
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("UserDotView is built in code only")
    }

    private func redraw() {
        image = PinRenderer.userDot(fill: UIColor(Tok.link).resolvedColor(with: traitCollection))
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if previousTraitCollection?.userInterfaceStyle != traitCollection.userInterfaceStyle {
            redraw()
        }
    }
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
    /// Reports the centre of the visible region after a pan or a zoom, which is
    /// what the phone's "Search this area" button acts on. Also defaults to a
    /// no-op, for the same reason.
    var onRegionChange: (CLLocationCoordinate2D) -> Void = { _ in }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.pointOfInterestFilter = .excludingAll
        map.showsUserLocation = showsUser
        map.register(EventPinView.self,
                     forAnnotationViewWithReuseIdentifier: EventPinView.reuseID)
        map.register(UserDotView.self,
                     forAnnotationViewWithReuseIdentifier: UserDotView.reuseID)
        map.register(ClusterPinView.self,
                     forAnnotationViewWithReuseIdentifier: MKMapViewDefaultClusterAnnotationViewReuseIdentifier)
        // London until the feed says otherwise. VenTrack serves the UK, so opening
        // on anywhere else is a bug the user sees before the first fetch lands.
        map.setRegion(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 51.5074, longitude: -0.1278),
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
        /// Prefers the live dot's location, falling back to the app's origin.
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
            if annotation is MKUserLocation {
                return mapView.dequeueReusableAnnotationView(
                    withIdentifier: UserDotView.reuseID, for: annotation)
            }
            if let cluster = annotation as? MKClusterAnnotation {
                let view = mapView.dequeueReusableAnnotationView(
                    withIdentifier: MKMapViewDefaultClusterAnnotationViewReuseIdentifier,
                    for: cluster) as? ClusterPinView
                view?.apply(count: cluster.memberAnnotations.count)
                return view
            }
            guard let ev = annotation as? EventAnnotation else { return nil }
            let view = mapView.dequeueReusableAnnotationView(
                withIdentifier: EventPinView.reuseID, for: ev) as? EventPinView
            view?.apply(event: ev.event, selected: parent.selectedID == ev.event.id)
            return view
        }

        func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
            let centre = mapView.centerCoordinate
            let report = parent.onRegionChange
            DispatchQueue.main.async { report(centre) }
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            // Grow the marker first, whether the selection came from a tap or
            // from the tray, so the two routes always look the same.
            if let ev = view.annotation as? EventAnnotation {
                (view as? EventPinView)?.apply(event: ev.event, selected: true)
            }
            if programmatic { return }

            // A cluster is literally "the events around this spot", so list them
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
            if let ev = view.annotation as? EventAnnotation {
                (view as? EventPinView)?.apply(event: ev.event, selected: false)
            }
            if programmatic { return }
            if let ev = view.annotation as? EventAnnotation {
                DispatchQueue.main.async {
                    if self.parent.selectedID == ev.event.id { self.parent.selectedID = nil }
                }
            }
        }
    }
}

/// The preview raised above a tapped pin. Same overline, title and wash the
/// list card uses, so an event with a broken image behaves identically here.
struct PiPCard: View {
    let event: Event
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: 11) {
            ZStack {
                Categories.wash(event.category)
                CategoryGlyph(category: event.category, size: 19)
                if let url = event.imageURL {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() }
                        else { Color.clear }
                    }
                }
            }
            .frame(width: 56, height: 56)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 3) {
                overline
                Text(event.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Tok.text)
                    .lineLimit(1)
                Text(Fmt.distance(event.distanceKm))
                    .font(.system(size: 12.5))
                    .foregroundStyle(Tok.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(11)
        .frame(maxWidth: 330)
        .cardGlass(cornerRadius: 14)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
        .padding(.horizontal, 16)
        .contentShape(RoundedRectangle(cornerRadius: 14))
        .onTapGesture(perform: onTap)
    }

    private var overline: some View {
        let w = Fmt.when(event.startDate)
        return Text(w.text.uppercased())
            .font(.system(size: 10.5, weight: .bold))
            .kerning(0.8)
            .foregroundStyle(w.soon ? Tok.accent : Tok.muted)
            .lineLimit(1)
    }
}

/// One card in the tray. The wash and the glyph sit under the photo, so a URL
/// that fails leaves the category showing rather than an empty box.
struct CarouselCard: View {
    let event: Event
    let onOpen: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                Categories.wash(event.category)
                CategoryGlyph(category: event.category, size: 26)
                if let url = event.imageURL {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() }
                        else { Color.clear }
                    }
                }
            }
            .frame(height: 88)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: 11))

            VStack(alignment: .leading, spacing: 3) {
                overline
                Text(event.title)
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Tok.text)
                    .lineLimit(1)
                Text(footerText)
                    .font(.system(size: 12))
                    .foregroundStyle(Tok.muted)
                    .lineLimit(1)
            }
            .padding(.top, 10)
        }
        .padding(10)
        .cardGlass(cornerRadius: 16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Tok.hairline, lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .onTapGesture(perform: onOpen)
    }

    private var overline: some View {
        let w = Fmt.when(event.startDate)
        return Text(w.text.uppercased())
            .font(.system(size: 10.5, weight: .bold))
            .kerning(0.8)
            .foregroundStyle(w.soon ? Tok.accent : Tok.muted)
            .lineLimit(1)
    }

    private var footerText: String {
        var parts: [String] = []
        if event.distanceKm != nil { parts.append(Fmt.distance(event.distanceKm)) }
        if event.isFree { parts.append("Free") }
        else if let p = event.price, !p.isEmpty { parts.append(p) }
        if parts.isEmpty { parts.append(event.venue ?? "Venue to be announced") }
        return parts.joined(separator: " · ")
    }
}
