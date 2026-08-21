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
    /// Tints the symbol, so an interest carries the same colour here as the
    /// events it selects carry in the feed. Nil for "Free", which is a price
    /// and not a family: giving it a hue would claim a meaning it does not have.
    let family: Family?
    let keywords: [String]
}

enum Preferences {
    static let all: [Preference] = [
        .init(id: "music",     label: "Music & Concerts", symbol: "music.note", family: .music, keywords: ["music", "concert", "dj", "band", "gig"]),
        .init(id: "food",      label: "Food & Drink",     symbol: "fork.knife", family: .food, keywords: ["food", "drink", "tasting", "brunch", "wine", "beer"]),
        .init(id: "festival",  label: "Festivals",        symbol: "music.note.list", family: .music, keywords: ["festival", "fair", "carnival"]),
        .init(id: "nightlife", label: "Nightlife",        symbol: "figure.socialdance", family: .music, keywords: ["night", "club", "party", "dance", "rave"]),
        .init(id: "arts",      label: "Arts & Theatre",   symbol: "theatermasks", family: .stage, keywords: ["art", "theat", "exhibit", "gallery", "museum"]),
        .init(id: "film",      label: "Film",             symbol: "film", family: .stage, keywords: ["film", "movie", "cinema", "screening"]),
        .init(id: "comedy",    label: "Comedy",           symbol: "music.mic", family: .stage, keywords: ["comedy", "standup", "stand-up", "improv"]),
        // UK sport vocabulary: football and rugby lead, and "fixture" is the
        // word British listings actually use for a scheduled match.
        .init(id: "sports",    label: "Sports",           symbol: "soccerball", family: .sport, keywords: ["sport", "football", "rugby", "cricket", "netball", "athletics", "boxing", "darts", "snooker", "racing", "match", "fixture", "league"]),
        .init(id: "free",      label: "Free Events",      symbol: "ticket", family: nil, keywords: ["free"]),
        // "boot" covers both British names for the same Sunday morning: a car
        // boot sale everywhere, a boot fair in Kent and Sussex. Matched against
        // the title as well as the category, so a listing called "Ashford
        // Market Boot Fair" reaches this interest whichever source found it.
        .init(id: "popup",     label: "Pop-ups & Markets", symbol: "bag", family: .food, keywords: ["pop-up", "popup", "market", "bazaar", "boot", "jumble", "flea"]),
        .init(id: "family",    label: "Family",           symbol: "figure.2.and.child.holdinghands", family: .culture, keywords: ["family", "kid", "child"]),
        // Outdoors is a real canonical category again, so this selects it
        // rather than quietly resolving to Museums. Heritage tours stay in the
        // keyword list because they were what this interest actually returned
        // for as long as it existed, and dropping them would silently narrow
        // what an existing user already had selected.
        .init(id: "outdoors",  label: "Outdoors & Tours", symbol: "mountain.2", family: .outdoor,
              keywords: ["outdoor", "walk", "garden", "park", "swim", "nature",
                         "museum", "heritage", "tour", "exhibit"]),
    ]

    static func with(ids: Set<String>) -> [Preference] { all.filter { ids.contains($0.id) } }
}
