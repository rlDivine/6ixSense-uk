import Foundation
import CoreLocation

/// Talks to the Express backend (`server.js`) that aggregates + sorts events.
///
/// During development the simulator can reach your Mac at `localhost`.
/// A physical device must use your Mac's LAN IP, because `localhost` on the phone
/// means the phone itself. Find the IP with `ipconfig getifaddr en0`.
/// If your Mac's IP changes (new Wi-Fi network), update `macLAN_IP` below.
enum EventService {
    /// PRODUCTION: the deployed VenTrack UK backend (see `api/render.yaml`, which
    /// names the service `pulse-uk-api`). When set, every device uses it:
    /// simulator, your iPhone, any App Store user, and your Mac is no longer
    /// involved. Leave it empty to use the local Mac during development.
    ///
    /// This must point at a VenTrack deployment: the 6ix Sense backend serves
    /// Toronto and is a separate product.
    ///
    /// The host still says `pulse-uk-api` and that is deliberate. It is the
    /// identity of a deployed Render service, not the product name: the URL is
    /// derived from the service name, so renaming the service mints a brand new
    /// URL and takes every installed app offline until it is updated. Moving to
    /// a ventrack host means creating a new Render service and carrying the
    /// four configured API keys across to it, which is a separate deliberate
    /// migration and not part of the product rename.
    private static let productionURL = "https://pulse-uk-api.onrender.com"

    /// DEV ONLY: your Mac's Wi-Fi IP, for running on a physical iPhone at home.
    private static let macLAN_IP = "192.168.18.5"

    static let baseURL: URL = {
        if !productionURL.isEmpty { return URL(string: productionURL)! }
        return URL(string: "http://\(macLAN_IP):3000")!
    }()

    enum Sort: String { case nearest, soonest }
    enum Range: String, CaseIterable {
        case all, today, weekend, week
        var label: String {
            switch self {
            case .all: "All upcoming"; case .today: "Today"
            case .weekend: "This weekend"; case .week: "This week"
            }
        }
    }

    static func fetch(sort: Sort, range: Range, origin: CLLocationCoordinate2D?) async throws -> EventsResponse {
        var comps = URLComponents(url: baseURL.appendingPathComponent("api/events"), resolvingAgainstBaseURL: false)!
        var items = [URLQueryItem(name: "sort", value: sort.rawValue),
                     URLQueryItem(name: "range", value: range.rawValue)]
        if let origin {
            items.append(URLQueryItem(name: "lat", value: String(origin.latitude)))
            items.append(URLQueryItem(name: "lng", value: String(origin.longitude)))
        }
        comps.queryItems = items

        var req = URLRequest(url: comps.url!)
        req.timeoutInterval = 130 // first cold load runs the scrapers
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(EventsResponse.self, from: data)
    }

    /// The curated towns, for the Preferences location picker. Server-driven so
    /// adding a region on the backend shows up without shipping a build.
    /// In practice this returns exactly one entry, the United Kingdom, but the
    /// shape is a list, which is what lets the picker stay generic.
    private struct RegionsResponse: Codable { let countries: [RegionCountry] }

    static func regions() async throws -> [RegionCountry] {
        var req = URLRequest(url: baseURL.appendingPathComponent("api/regions"))
        req.timeoutInterval = 60 // may land on a cold Render instance
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(RegionsResponse.self, from: data).countries
    }
}
