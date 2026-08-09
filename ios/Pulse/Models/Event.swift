import Foundation

/// One event as returned by the Express `/api/events` endpoint.
struct Event: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let category: String
    let start: String?        // ISO 8601, may be null
    let venue: String?
    let address: String?
    let lat: Double?
    let lng: Double?
    let distanceKm: Double?
    let url: String?
    let image: String?
    let source: String
    let price: String?
    // Most sources give the client nothing to say here, and the detail screen
    // already builds a summary from what it does know. PredictHQ is the first
    // source that sometimes carries real prose, worth showing ahead of the
    // built-in summary precisely because that source has no url to fall back
    // on. Optional and absent on older cached JSON, so decoding never breaks.
    let description: String?

    // MARK: Derived helpers

    var isFree: Bool { (price ?? "").lowercased() == "free" }

    var startDate: Date? {
        guard let start else { return nil }
        return DateParse.iso(start)
    }

    /// The ticket link, but only if it is an ordinary web address.
    ///
    /// The backend drops anything that is not http(s) when it builds the event,
    /// so a live feed never carries one. Saved events are a different matter:
    /// they are persisted in UserDefaults and outlive a backend deploy, so a
    /// listing saved before that fix is still on the device. Handing an
    /// arbitrary scheme to the system opener is how a third-party listing gets
    /// to launch another app, so it is checked here too.
    var webURL: URL? { Event.web(url) }

    /// Same rule for the photo. AsyncImage would simply fail on an odd scheme,
    /// but there is no reason to hand it one.
    var imageURL: URL? { Event.web(image) }

    static func web(_ raw: String?) -> URL? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty,
              let url = URL(string: raw),
              let scheme = url.scheme?.lowercased(),
              scheme == "http" || scheme == "https"
        else { return nil }
        return url
    }

    /// A usable map coordinate: present, finite, in range, and not (0,0).
    /// An invalid value makes MapKit hang, so we filter those out.
    var hasCoordinate: Bool {
        guard let lat, let lng else { return false }
        return lat.isFinite && lng.isFinite
            && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
            && !(lat == 0 && lng == 0)
    }
}

/// Tolerant date parsing. Handles full ISO-8601 (with/without fractional
/// seconds) AND the timezone-less local strings some sources emit
/// (Ticketmaster's `localTime`, date-only values). ISO8601DateFormatter
/// rejects those, which used to make dated events look undated (the "·" badge)
/// and slip past the date filters.
enum DateParse {
    private static let withFrac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f
    }()
    // Timezone-less fallbacks. These strings are venue-local ("7pm at the
    // venue"), so we interpret them in the device's own timezone, which is the
    // user's town wherever they opened the app.
    private static func local(_ format: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = format
        return f
    }
    private static let dt   = local("yyyy-MM-dd'T'HH:mm:ss")
    private static let dtMin = local("yyyy-MM-dd'T'HH:mm")
    private static let dateOnly = local("yyyy-MM-dd")

    static func iso(_ s: String) -> Date? {
        withFrac.date(from: s) ?? plain.date(from: s)
            ?? dt.date(from: s) ?? dtMin.date(from: s) ?? dateOnly.date(from: s)
    }
}

/// The town a feed was built for. The backend resolves this from the
/// coordinates the app sends: every region it serves is a curated UK town, so
/// `label` is always a real place name.
struct Region: Codable, Hashable {
    struct Center: Codable, Hashable {
        let lat: Double
        let lng: Double
    }
    let id: String
    let label: String?      // "London", "Canterbury", …
    let area: String?       // county / council area / principal area
    let nation: String?     // England | Wales | Scotland | Northern Ireland
    let country: String?    // ISO code, always "GB"
    let timeZone: String?   // IANA id, e.g. "Europe/London"
    let unit: String?       // "mi"
    let center: Center?
    let generic: Bool?      // legacy field, always false

}

/// API envelope: { origin, region, inMarket, sort, range, count, sources, events }
struct EventsResponse: Codable {
    let count: Int
    let sources: [String]
    let region: Region?
    /// False when the coordinate we sent was outside the UK. Pulse covers the
    /// UK only, so the backend serves London and says so rather than pretending
    /// the user is there. Optional so an older backend still decodes.
    let inMarket: Bool?
    let events: [Event]
}
