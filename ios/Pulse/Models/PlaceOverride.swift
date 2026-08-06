import Foundation
import CoreLocation

/// A place the user picked by hand, standing in for the device's location.
///
/// Two things can create one: choosing a town in Preferences, or typing an
/// address into the search bar. While an override is set the feed is built
/// around it and GPS is ignored entirely, so someone in Leeds can browse
/// Brighton and someone in London can look up a specific street.
struct PlaceOverride: Codable, Equatable {
    enum Kind: String, Codable {
        case country
        /// A specific city or county town picked out of the region browser.
        case city
        case address
    }

    let kind: Kind
    /// What to show the user: a country name, or the address they typed.
    let label: String
    let lat: Double
    let lng: Double

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    init(kind: Kind, label: String, coordinate: CLLocationCoordinate2D) {
        self.kind = kind
        self.label = label
        self.lat = coordinate.latitude
        self.lng = coordinate.longitude
    }
}

/// The backend's curated catalogue (`GET /api/regions`). In practice it is
/// a single entry, the United Kingdom, holding every town Pulse covers.
///
/// The list is fetched rather than hardcoded so that adding a town on the
/// server makes it appear in the picker without shipping a new build.
struct RegionCountry: Codable, Identifiable, Hashable {
    struct City: Codable, Identifiable, Hashable {
        let id: String
        let label: String
        /// The county, council area or principal area this town sits in.
        /// Optional so an older backend that doesn't send it still decodes.
        let area: String?
        /// England, Wales, Scotland, Northern Ireland: the browser's sections.
        let nation: String?
        let lat: Double
        let lng: Double

        var coordinate: CLLocationCoordinate2D {
            CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }

        /// "Canterbury, Kent", which is what the rows and the filter field match on.
        var searchText: String {
            [label, area, nation].compactMap { $0 }.joined(separator: " ")
        }
    }

    let country: String   // ISO code, always "GB"
    let label: String     // "United Kingdom"
    let cities: [City]
    /// The nations present, in the order the backend listed them. Optional for
    /// the same backwards-compatibility reason as City.area.
    let nations: [String]?

    var id: String { country }

    /// One nation's worth of towns, ready to render as a list section.
    struct Section: Identifiable, Hashable {
        let nation: String?
        let cities: [City]
        var id: String { nation ?? "_all" }
    }

    /// Cities grouped for display: one section per nation, in the order the
    /// backend listed them, each sorted by county then town. A country that
    /// sends no nations at all collapses to a single unnamed section.
    var sections: [Section] {
        func sort(_ list: [City]) -> [City] {
            list.sorted { ($0.area ?? "", $0.label) < ($1.area ?? "", $1.label) }
        }
        guard let nations, !nations.isEmpty else {
            return [Section(nation: nil, cities: sort(cities))]
        }
        let grouped = Dictionary(grouping: cities, by: { $0.nation })
        var out = nations.compactMap { n -> Section? in
            guard let group = grouped[n], !group.isEmpty else { return nil }
            return Section(nation: n, cities: sort(group))
        }
        // Anything the backend forgot to name still has to appear somewhere.
        if let orphans = grouped[nil], !orphans.isEmpty {
            out.append(Section(nation: nil, cities: sort(orphans)))
        }
        return out
    }

    /// The primary town. The catalogue lists London first, so choosing the
    /// country lands the user there rather than on an arbitrary town.
    var primary: City? { cities.first }
}
