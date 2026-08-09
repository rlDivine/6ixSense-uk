import Foundation

/// A high-level interest the user picks in onboarding. Each maps to a set of
/// keywords matched (loosely) against an event's category, so the messy
/// per-source category strings still slot into clean buckets.
struct Preference: Identifiable, Hashable {
    let id: String
    let label: String
    let emoji: String
    let keywords: [String]
}

enum Preferences {
    static let all: [Preference] = [
        .init(id: "music",     label: "Music & Concerts", emoji: "🎵", keywords: ["music", "concert", "dj", "band", "gig"]),
        .init(id: "food",      label: "Food & Drink",     emoji: "🍔", keywords: ["food", "drink", "tasting", "brunch", "wine", "beer"]),
        .init(id: "festival",  label: "Festivals",        emoji: "🎪", keywords: ["festival", "fair", "carnival"]),
        .init(id: "nightlife", label: "Nightlife",        emoji: "🌃", keywords: ["night", "club", "party", "dance", "rave"]),
        .init(id: "arts",      label: "Arts & Theatre",   emoji: "🎨", keywords: ["art", "theat", "exhibit", "gallery", "museum"]),
        .init(id: "film",      label: "Film",             emoji: "🎬", keywords: ["film", "movie", "cinema", "screening"]),
        .init(id: "comedy",    label: "Comedy",           emoji: "🎤", keywords: ["comedy", "standup", "stand-up", "improv"]),
        // UK sport vocabulary: football and rugby lead, and "fixture" is the
        // word British listings actually use for a scheduled match.
        .init(id: "sports",    label: "Sports",           emoji: "⚽️", keywords: ["sport", "football", "rugby", "cricket", "netball", "athletics", "boxing", "darts", "snooker", "racing", "match", "fixture", "league"]),
        .init(id: "free",      label: "Free Events",      emoji: "🎟️", keywords: ["free"]),
        .init(id: "popup",     label: "Pop-ups & Markets", emoji: "🎁", keywords: ["pop-up", "popup", "market", "bazaar"]),
        .init(id: "family",    label: "Family",           emoji: "🎡", keywords: ["family", "kid", "child"]),
        // Tours folded into Museums when the category vocabulary was unified,
        // so the old keywords (tour, walk, outdoor, hike, park) matched no
        // category at all and this interest silently returned nothing. The
        // label follows the bucket it actually resolves to now.
        .init(id: "outdoors",  label: "Tours & Heritage", emoji: "🚶", keywords: ["museum", "heritage", "tour", "exhibit"]),
    ]

    static func with(ids: Set<String>) -> [Preference] { all.filter { ids.contains($0.id) } }
}
