import Foundation

/// A high-level interest the user picks in onboarding. Each maps to a set of
/// keywords matched (loosely) against an event's category, so the messy
/// per-source category strings still slot into clean buckets.
struct Preference: Identifiable, Hashable {
    let id: String
    let label: String
    /// An SF Symbol, not an emoji. Emoji render in a separate font that ignores
    /// the app's weight and colour, which made the interest grid the one place
    /// the interface changed character. A symbol takes the tint and the weight
    /// of everything around it, and scales with Dynamic Type.
    let symbol: String
    let keywords: [String]
}

enum Preferences {
    static let all: [Preference] = [
        .init(id: "music",     label: "Music & Concerts", symbol: "music.note", keywords: ["music", "concert", "dj", "band", "gig"]),
        .init(id: "food",      label: "Food & Drink",     symbol: "fork.knife", keywords: ["food", "drink", "tasting", "brunch", "wine", "beer"]),
        .init(id: "festival",  label: "Festivals",        symbol: "party.popper.fill", keywords: ["festival", "fair", "carnival"]),
        .init(id: "nightlife", label: "Nightlife",        symbol: "figure.socialdance", keywords: ["night", "club", "party", "dance", "rave"]),
        .init(id: "arts",      label: "Arts & Theatre",   symbol: "theatermasks.fill", keywords: ["art", "theat", "exhibit", "gallery", "museum"]),
        .init(id: "film",      label: "Film",             symbol: "film.fill", keywords: ["film", "movie", "cinema", "screening"]),
        .init(id: "comedy",    label: "Comedy",           symbol: "music.mic", keywords: ["comedy", "standup", "stand-up", "improv"]),
        // UK sport vocabulary: football and rugby lead, and "fixture" is the
        // word British listings actually use for a scheduled match.
        .init(id: "sports",    label: "Sports",           symbol: "soccerball", keywords: ["sport", "football", "rugby", "cricket", "netball", "athletics", "boxing", "darts", "snooker", "racing", "match", "fixture", "league"]),
        .init(id: "free",      label: "Free Events",      symbol: "ticket.fill", keywords: ["free"]),
        .init(id: "popup",     label: "Pop-ups & Markets", symbol: "bag.fill", keywords: ["pop-up", "popup", "market", "bazaar"]),
        .init(id: "family",    label: "Family",           symbol: "figure.2.and.child.holdinghands", keywords: ["family", "kid", "child"]),
        // Tours folded into Museums when the category vocabulary was unified,
        // so the old keywords (tour, walk, outdoor, hike, park) matched no
        // category at all and this interest silently returned nothing. The
        // label follows the bucket it actually resolves to now.
        .init(id: "outdoors",  label: "Tours & Heritage", symbol: "building.columns.fill", keywords: ["museum", "heritage", "tour", "exhibit"]),
    ]

    static func with(ids: Set<String>) -> [Preference] { all.filter { ids.contains($0.id) } }
}
