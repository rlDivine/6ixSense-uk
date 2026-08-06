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

    // MARK: Derived helpers

    var isFree: Bool { (price ?? "").lowercased() == "free" }

    var startDate: Date? {
        guard let start else { return nil }
        return DateParse.iso(start)
    }

    /// A usable map coordinate: present, finite, in range, and not (0,0) —
    /// an invalid value makes MapKit hang, so we filter those out.
    var hasCoordinate: Bool {
        guard let lat, let lng else { return false }
        return lat.isFinite && lng.isFinite
            && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
            && !(lat == 0 && lng == 0)
    }
}

/// Tolerant date parsing. Handles full ISO-8601 (with/without fractional
/// seconds) AND the timezone-less local strings some sources emit
/// (Ticketmaster's `localTime`, date-only values) — ISO8601DateFormatter
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
    // venue"), so we interpret them in the device's own timezone — which is
    // the user's city, wherever in the world they opened the app.
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
    let country: String?    // ISO code — always "GB"
    let timeZone: String?   // IANA id, e.g. "Europe/London"
    let unit: String?       // "mi"
    let center: Center?
    let generic: Bool?      // legacy field, always false

    /// "Canterbury, Kent" — the town with the county that disambiguates it.
    var fullLabel: String {
        guard let label else { return "the UK" }
        guard let area, area != label else { return label }
        return "\(label), \(area)"
    }
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
