import SwiftUI
import Foundation
import MapKit
import UIKit

/// The event page. A flat category hero, the title and the description, one
/// bordered facts table, the venue, three equal secondary actions, and a sticky
/// primary action that names where the tickets actually come from.
///
/// The hero used to carry a scrim over the photo. That was a gradient, and the
/// design pass removed every gradient in the app, so the wash is flat and the
/// photo simply covers it when one loads.
struct EventDetailView: View {
    let event: Event
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss

    /// A calendar file written once on appear, so the Calendar action can hand
    /// the event to the system without asking for calendar permission.
    @State private var calendarFile: URL?

    var body: some View {
        ZStack(alignment: .bottom) {
            Tok.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    hero
                    details
                }
            }
            cta
        }
        .ignoresSafeArea(edges: .top)
        .onAppear(perform: makeCalendarFile)
    }

    // MARK: Hero

    private var hero: some View {
        // Size is driven by the wash, which is a fixed frame. The glyph and the
        // photo are both clipped overlays, so a wide photo can never inflate the
        // hero's width and shove the rest of the page off screen. The glyph sits
        // under the photo, so a failed image still leaves the category showing.
        Categories.wash(event.category)
            .frame(maxWidth: .infinity)
            .frame(height: 260)
            .overlay { CategoryGlyph(category: event.category, size: 64) }
            .overlay { heroImage }
            .clipped()
            .overlay(alignment: .top) { heroControls }
    }

    @ViewBuilder private var heroImage: some View {
        if let url = event.imageURL {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                } else {
                    Color.clear
                }
            }
        }
    }

    private var heroControls: some View {
        HStack {
            circleBtn("chevron.left", "Back") { dismiss() }
            Spacer()
            circleBtn(app.isSaved(event) ? "bookmark.fill" : "bookmark",
                      app.isSaved(event) ? "Remove from saved" : "Save event") {
                app.toggleSave(event)
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 54)
    }

    private func circleBtn(_ sys: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: sys)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Tok.text)
                .frame(width: 38, height: 38)
                .background(Tok.panel, in: Circle())
                .overlay(Circle().stroke(Tok.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    // MARK: Body

    private var details: some View {
        VStack(alignment: .leading, spacing: 16) {
            categoryLabel
            Text(event.title)
                .font(.system(size: 27, weight: .bold))
                .kerning(-0.8)
                .foregroundStyle(Tok.text)
                .fixedSize(horizontal: false, vertical: true)
            Text(summary)
                .font(.system(size: 14.5))
                .lineSpacing(6)
                .foregroundStyle(Tok.muted)
                .fixedSize(horizontal: false, vertical: true)
            facts
            venueBlock
            secondaryActions
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .padding(.bottom, 120)
    }

    private var categoryLabel: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(Categories.style(event.category).color)
                .frame(width: 7, height: 7)
            Text(event.category.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .kerning(0.84)
                .foregroundStyle(Categories.style(event.category).color)
        }
        .accessibilityElement(children: .combine)
    }

    /// Most sources carry no description, so this says what Pulse actually
    /// knows and points at the listing for the rest, rather than inventing
    /// copy. A source that does carry one (PredictHQ, for some categories) is
    /// worth more here than usual, precisely because that source often has no
    /// url to fall back on.
    ///
    /// Not every source carries a booking link, so the constructed fallback's
    /// last line only promises a listing when `event.webURL` is actually there
    /// to open.
    private var summary: String {
        if let d = event.description?.trimmingCharacters(in: .whitespacesAndNewlines), !d.isEmpty {
            return d
        }
        var parts: [String] = []
        parts.append(sourceName.isEmpty ? "Listed on a partner feed." : "Listed on \(sourceName).")
        if let v = event.venue, !v.isEmpty { parts.append("On at \(v).") }
        if event.webURL != nil {
            parts.append("Open the full listing for the line up, the running times and tickets.")
        }
        return parts.joined(separator: " ")
    }

    private var sourceName: String {
        event.source.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: Facts
    //
    // One bordered container split by hairlines, not three separate cards.
    // Three cards read as three things to decide between; this reads as one
    // block of facts about a single event, which is what it is.

    private var facts: some View {
        HStack(spacing: 0) {
            factCell("When", whenValue, whenSub)
            factDivider
            factCell("Distance", Fmt.distance(event.distanceKm), distanceSub)
            factDivider
            factCell("Price", priceValue, priceSub)
        }
        .frame(maxWidth: .infinity)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
    }

    private var factDivider: some View {
        Rectangle().fill(Tok.hairline).frame(width: 1)
    }

    private func factCell(_ label: String, _ value: String, _ sub: String) -> some View {
        VStack(spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .kerning(0.84)
                .foregroundStyle(Tok.faint)
            Text(value)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Tok.text)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(sub)
                .font(.system(size: 11.5))
                .foregroundStyle(Tok.faint)
                .fixedSize(horizontal: false, vertical: true)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 13)
        .padding(.horizontal, 8)
        .accessibilityElement(children: .combine)
    }

    private var whenValue: String { Fmt.relDay(event.startDate) }

    private var whenSub: String {
        guard let d = event.startDate else { return "Watch the listing" }
        return Fmt.time(d) + ", " + d.formatted(.dateTime.day().month(.wide))
    }

    /// The API distance is measured straight between two points, so the sub
    /// value says so once it is far enough for that to matter.
    private var distanceSub: String {
        guard let km = event.distanceKm else { return "Location not given" }
        if km < 0.2 { return "Right by you" }
        if km < 5 {
            let mins = max(1, Int((km / 5.0 * 60).rounded()))
            return "About \(mins) min walk"
        }
        return "In a straight line"
    }

    private var priceValue: String {
        if event.isFree { return "Free" }
        if let p = event.price, !p.isEmpty { return p }
        return "Not listed"
    }

    private var priceSub: String {
        if event.isFree { return "Listed as free" }
        if let p = event.price, !p.isEmpty { return "Booking fees may apply" }
        return sourceName.isEmpty ? "Check the listing" : "Check with \(sourceName)"
    }

    // MARK: Venue

    private var venueBlock: some View {
        VStack(alignment: .leading, spacing: 0) {
            venueMap
            VStack(alignment: .leading, spacing: 10) {
                Text(venueName)
                    .font(.system(size: 15.5, weight: .bold))
                    .foregroundStyle(Tok.text)
                    .fixedSize(horizontal: false, vertical: true)
                Text(addressText)
                    .font(.system(size: 13))
                    .foregroundStyle(Tok.muted)
                    .fixedSize(horizontal: false, vertical: true)
                directions
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
        }
        .background(Tok.panel)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
    }

    @ViewBuilder private var venueMap: some View {
        if event.hasCoordinate, let lat = event.lat, let lng = event.lng {
            VenueSnapshot(coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng),
                          tint: Categories.style(event.category).pin)
                .frame(height: 140)
                .frame(maxWidth: .infinity)
                .clipped()
                .accessibilityHidden(true)
        }
    }

    private var venueName: String {
        if let v = event.venue, !v.isEmpty { return v }
        return "Venue to be announced"
    }

    private var addressText: String {
        if let a = event.address, !a.isEmpty { return a }
        return "Address not listed"
    }

    @ViewBuilder private var directions: some View {
        if event.hasCoordinate, let lat = event.lat, let lng = event.lng,
           let url = URL(string: "http://maps.apple.com/?daddr=\(lat),\(lng)") {
            Link(destination: url) {
                Text("Directions")
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Tok.link)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 12))
            }
            .accessibilityLabel("Directions to \(venueName)")
        }
    }

    // MARK: Actions

    /// Share, Calendar and Save carry the same weight. None of the three is the
    /// thing the page is for, so none of them should look like it is.
    private var secondaryActions: some View {
        HStack(spacing: 8) {
            shareAction
            calendarAction
            saveAction
        }
    }

    @ViewBuilder private var shareAction: some View {
        if let url = event.webURL {
            ShareLink(item: url) { actionLabel("Share", "square.and.arrow.up") }
                .buttonStyle(.plain)
        } else {
            actionLabel("Share", "square.and.arrow.up")
                .opacity(0.45)
                .accessibilityHidden(true)
        }
    }

    @ViewBuilder private var calendarAction: some View {
        if let file = calendarFile {
            ShareLink(item: file) { actionLabel("Calendar", "calendar") }
                .buttonStyle(.plain)
        } else {
            actionLabel("Calendar", "calendar")
                .opacity(0.45)
                .accessibilityHidden(true)
        }
    }

    private var saveAction: some View {
        let saved = app.isSaved(event)
        return Button {
            app.toggleSave(event)
        } label: {
            actionLabel(saved ? "Saved" : "Save", saved ? "bookmark.fill" : "bookmark")
        }
        .buttonStyle(.plain)
        .accessibilityLabel(saved ? "Remove from saved" : "Save event")
        .accessibilityValue(saved ? "Saved" : "Not saved")
        .accessibilityAddTraits(saved ? AccessibilityTraits.isSelected : [])
    }

    private func actionLabel(_ title: String, _ symbol: String) -> some View {
        VStack(spacing: 5) {
            Image(systemName: symbol).font(.system(size: 15, weight: .semibold))
            Text(title).font(.system(size: 12.5, weight: .semibold))
        }
        .foregroundStyle(Tok.text)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 11)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
    }

    // MARK: Sticky primary action

    /// Names the source, because "Get tickets" tells you nothing about who is
    /// about to take your money. This is one of the three jobs red is allowed
    /// to do, and it is `accentFill` rather than `accent` so the white label
    /// clears contrast on both themes.
    private var ctaTitle: String {
        sourceName.isEmpty ? "Get tickets and details" : "Book on \(sourceName)"
    }

    @ViewBuilder private var cta: some View {
        if let url = event.webURL {
            VStack(spacing: 0) {
                Rectangle().fill(Tok.hairline).frame(height: 1)
                Link(destination: url) {
                    Text(ctaTitle)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Tok.accentFill, in: RoundedRectangle(cornerRadius: 14))
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 14)
            }
            .background(Tok.bg)
        }
    }

    // MARK: Calendar file
    //
    // Written as an .ics and handed to the share sheet, which offers Add to
    // Calendar. Doing it this way means the app never has to ask for access to
    // somebody's calendar just to put one event in it.

    private func makeCalendarFile() {
        guard calendarFile == nil, let start = event.startDate else { return }
        let end = start.addingTimeInterval(2 * 60 * 60)

        let stamp = DateFormatter()
        stamp.locale = Locale(identifier: "en_US_POSIX")
        stamp.timeZone = TimeZone(identifier: "UTC")
        stamp.dateFormat = "yyyyMMdd'T'HHmmss'Z'"

        var lines: [String] = []
        lines.append("BEGIN:VCALENDAR")
        lines.append("VERSION:2.0")
        lines.append("PRODID:-//Pulse//Pulse UK//EN")
        lines.append("CALSCALE:GREGORIAN")
        lines.append("BEGIN:VEVENT")
        lines.append("UID:\(icsEscape(event.id))@pulse.uk")
        lines.append("DTSTAMP:\(stamp.string(from: Date()))")
        lines.append("DTSTART:\(stamp.string(from: start))")
        lines.append("DTEND:\(stamp.string(from: end))")
        lines.append("SUMMARY:\(icsEscape(event.title))")
        let place = [event.venue ?? "", event.address ?? ""].filter { !$0.isEmpty }.joined(separator: ", ")
        if !place.isEmpty { lines.append("LOCATION:\(icsEscape(place))") }
        if let url = event.webURL { lines.append("URL:\(url.absoluteString)") }
        lines.append("END:VEVENT")
        lines.append("END:VCALENDAR")

        let text = lines.joined(separator: "\r\n")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try text.write(to: url, atomically: true, encoding: .utf8)
            calendarFile = url
        } catch {
            calendarFile = nil
        }
    }

    /// The event id comes from a third party feed, so it is scrubbed down to
    /// something that is definitely a safe file name.
    private var fileName: String {
        let safe = event.id.unicodeScalars.map { scalar -> Character in
            CharacterSet.alphanumerics.contains(scalar) ? Character(scalar) : Character("-")
        }
        let stem = String(safe.prefix(40))
        return "pulse-" + (stem.isEmpty ? "event" : stem) + ".ics"
    }

    private func icsEscape(_ s: String) -> String {
        s.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: ";", with: "\\;")
            .replacingOccurrences(of: ",", with: "\\,")
            .replacingOccurrences(of: "\n", with: "\\n")
    }
}

/// A still image of the venue location, rendered once via MKMapSnapshotter.
/// Far lighter than embedding a live `Map`, and safe to present over another map.
struct VenueSnapshot: View {
    let coordinate: CLLocationCoordinate2D
    /// Marker fill. This is the category `pin`, which is fixed in both themes,
    /// because a white symbol sits on top of it.
    var tint: Color
    @State private var image: UIImage? = nil

    init(coordinate: CLLocationCoordinate2D, tint: Color = Tok.accentFill) {
        self.coordinate = coordinate
        self.tint = tint
    }

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Tok.panel2
            }
            Image(systemName: "mappin.circle.fill")
                .symbolRenderingMode(.palette)
                .foregroundStyle(Color.white, tint)
                .font(.system(size: 28))
        }
        .onAppear(perform: render)
    }

    private func render() {
        guard image == nil else { return }
        let opts = MKMapSnapshotter.Options()
        opts.region = MKCoordinateRegion(center: coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01))
        opts.size = CGSize(width: 380, height: 140)
        MKMapSnapshotter(options: opts).start(with: .main) { snapshot, _ in
            if let snapshot { image = snapshot.image }
        }
    }
}
