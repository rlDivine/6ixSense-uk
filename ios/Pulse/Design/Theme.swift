import Foundation
import SwiftUI

// MARK: - Colour tokens
//
// The Union flag, used with discipline rather than evenly. Navy (Pantone 280)
// is the interface colour and does the work of every selected state. Red
// (Pantone 186) is reserved for three things only: the logo, the primary
// action, and "today". Reserving it is what stops the app looking like a wall
// of buttons.
//
// Neither flag colour survives a straight lift into a dark interface, so the
// dark theme sits on a navy derived from the blue and swaps the roles: near
// white carries the selected states, and the red is lifted to read on navy.
//
// Every token is a flat colour. There are no gradients anywhere in the app.

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255)
    }
    /// Dynamic colour that resolves per interface style.
    init(dark: UInt32, light: UInt32) {
        self.init(UIColor { tc in
            UIColor(Color(hex: tc.userInterfaceStyle == .dark ? dark : light))
        })
    }
}

enum Tok {
    static let bg       = Color(dark: 0x141926, light: 0xF6F7FB)
    static let panel    = Color(dark: 0x1C2231, light: 0xFFFFFF)
    static let panel2   = Color(dark: 0x252C3D, light: 0xEEF1F7)
    static let hairline = Color(dark: 0x2F3749, light: 0xE3E7F0)

    /// Three weights of text. Using all three, rather than just text and muted,
    /// is most of what gives a list its hierarchy.
    static let text     = Color(dark: 0xE4E7EE, light: 0x0B1633)
    static let muted    = Color(dark: 0xA3ABBD, light: 0x59627B)
    /// Solved against the worst background each theme puts it on, which is
    /// panel2 in both cases. The earlier values failed 4.5:1 on the card
    /// overline and footer, which are real text, not decoration. The revised
    /// handoff asks for 0x8A92A4 on dark, but against the lifted panel2 that
    /// only reaches 4.47:1 and so misses the bar again. 0x8D95A7 is the
    /// smallest lift that clears it, at 4.64:1.
    static let faint    = Color(dark: 0x8D95A7, light: 0x686E7E)

    /// Flag red, for text and indicators. On dark it has to be light enough to
    /// read on navy.
    static let accent   = Color(dark: 0xF4707F, light: 0xC8102E)
    /// The same red as a filled background under a white label, which needs the
    /// opposite of the above: dark enough for white to clear 4.5:1. One colour
    /// cannot do both on a dark theme, so fills get their own token. On light,
    /// Pantone 186 already carries white at 5.9:1 and no split is needed.
    static let accentFill = Color(dark: 0xC8324A, light: 0xC8102E)
    /// Flag blue, for links and secondary emphasis.
    static let link     = Color(dark: 0x9DB6E8, light: 0x012169)

    /// Selected state. Flag navy on light, near white on dark, with the
    /// matching foreground so a filled chip is always legible.
    static let activeBg = Color(dark: 0xE4E7EE, light: 0x012169)
    static let activeFg = Color(dark: 0x161B27, light: 0xFFFFFF)

    /// Kept for the Free label, which uses the accent rather than reaching for
    /// a green that belongs to neither flag colour.
    static let freeFg   = accent
    /// Older name for `panel2`, kept so nothing has to be renamed twice.
    static let chip     = panel2
}

// MARK: - Category palette
//
// Mid-tone hues that hold up against both the navy and the light greys, and
// stay distinguishable as map pins. Anchored on the two flag colours: red for
// festivals, blue for music, with muted supporting tones for the rest. No
// glyphs live here. Categories are drawn with SF Symbols, so nothing in the
// interface depends on an emoji font.
//
// The keys are the canonical vocabulary the feed emits. The API folds every
// source's own wording onto that list once, in api/sources/util.js, so a
// listing arrives here already spelled the way this table spells it.

struct CatStyle {
    /// Theme-adaptive, for anything drawn on the app's own surface. The dark
    /// variants are lifted so a 6px dot and a category label clear 4.5:1 on
    /// navy; the mid-tones they came from are far too dark for that.
    let color: Color
    /// Fixed mid-tone, for the map marker fill. A white symbol sits on it, so
    /// this one has to stay dark in both themes. The lifted hues above carry
    /// white at 2:1 to 3:1, which is why the two cannot be the same colour.
    let pin: Color

    private let darkHex: UInt32
    private let lightHex: UInt32

    init(dark: UInt32, light: UInt32) {
        self.color = Color(dark: dark, light: light)
        self.pin = Color(hex: light)
        self.darkHex = dark
        self.lightHex = light
    }

    /// Flat tint behind a card image, used when an event has no photo of its
    /// own. This replaced a gradient: the tint alone carries the category.
    ///
    /// The alpha differs by theme because the placeholder glyph is drawn in the
    /// same hue on top of this. The light surfaces need the lighter tint for
    /// the two to stay apart; on dark there is more room.
    var wash: Color {
        // Bound to locals first: the trait closure escapes, and capturing a
        // struct's own properties in one is not something to leave implicit.
        let (d, l) = (darkHex, lightHex)
        return Color(UIColor { tc in
            let dark = tc.userInterfaceStyle == .dark
            return UIColor(Color(hex: dark ? d : l))
                .withAlphaComponent(dark ? 0.20 : 0.12)
        })
    }
}

enum Categories {
    /// Used for "Things to do", the feed's generic bucket, and for any wording
    /// the canonicaliser has not seen yet. A neutral slate rather than a hue,
    /// so an uncategorised listing never borrows another category's meaning.
    static let fallback = CatStyle(dark: 0x98A2BC, light: 0x5A6580)

    /// Keys are lowercased because `style(_:)` lowercases what it is given.
    /// "Live music" deliberately shares the Music hue: it is a sub-type of it,
    /// not a rival to it, and giving it its own blue only makes two categories
    /// that look almost the same.
    static let map: [String: CatStyle] = [
        "music":      .init(dark: 0x7BA4F2, light: 0x2563C9),
        "live music": .init(dark: 0x7BA4F2, light: 0x2563C9),
        "clubs":      .init(dark: 0xAC8BF2, light: 0x6D3FC4),
        "festivals":  .init(dark: 0xF4707F, light: 0xC8102E),
        "comedy":     .init(dark: 0xE58FCE, light: 0xB23A8C),
        "football":   .init(dark: 0x4FC78C, light: 0x17794A),
        "sport":      .init(dark: 0x5FC9BB, light: 0x2B7A6F),
        "markets":    .init(dark: 0xE0A75C, light: 0xA5651B),
        "museums":    .init(dark: 0x4FB8D4, light: 0x0F6F86),
        "theatre":    .init(dark: 0xE07FA5, light: 0x9C2F5E),
        "film":       .init(dark: 0x949AE8, light: 0x4A4F9E),
        "food":       .init(dark: 0xF0946A, light: 0xB5541F),
        "family":     .init(dark: 0xCCB84F, light: 0x7A6A12),
    ]
    static func style(_ category: String) -> CatStyle {
        map[category.lowercased()] ?? fallback
    }
    static func wash(_ category: String) -> Color {
        style(category).wash
    }
}

/// The category's placeholder mark, drawn when an event has no photo of its
/// own. An SF Symbol rather than an emoji, so it takes the category colour and
/// keeps the same weight as the rest of the interface.
struct CategoryGlyph: View {
    let category: String
    var size: CGFloat
    var body: some View {
        Image(systemName: Categories.symbol(category))
            .font(.system(size: size, weight: .regular))
            .foregroundStyle(Categories.style(category).color)
            .accessibilityHidden(true)
    }
}

extension Categories {
    /// SF Symbol for the card placeholder and for native map markers, which
    /// cannot render emoji. One case per canonical category, then a tolerant
    /// chain for anything the canonicaliser has not folded yet: a source can
    /// always invent a new word, and a missing glyph is worse than a loose one.
    static func symbol(_ category: String) -> String {
        let c = category.lowercased()
        switch c {
        case "music":        return "music.note"
        case "live music":   return "guitars.fill"
        case "clubs":        return "figure.socialdance"
        case "festivals":    return "party.popper.fill"
        case "comedy":       return "music.mic"
        case "football":     return "soccerball"
        case "sport":        return "sportscourt.fill"
        case "markets":      return "bag.fill"
        case "museums":      return "building.columns.fill"
        case "theatre":      return "theatermasks.fill"
        case "film":         return "film.fill"
        case "food":         return "fork.knife"
        case "family":       return "balloon.2.fill"
        case "things to do": return "sparkles"
        default:
            // Ordered so the narrower word wins: "club night" must not be
            // caught by the music test, and "football" must not be caught by
            // the general sport one.
            if c.contains("club") || c.contains("night") || c.contains("rave") { return "figure.socialdance" }
            if c.contains("festival") || c.contains("carnival") { return "party.popper.fill" }
            if c.contains("comedy") || c.contains("stand-up") || c.contains("standup") { return "music.mic" }
            if c.contains("football") || c.contains("soccer") { return "soccerball" }
            if c.contains("sport") || c.contains("rugby") || c.contains("cricket")
                || c.contains("racing") || c.contains("match") || c.contains("fixture") { return "sportscourt.fill" }
            if c.contains("music") || c.contains("concert") || c.contains("gig") { return "music.note" }
            if c.contains("market") || c.contains("pop-up") || c.contains("popup") { return "bag.fill" }
            if c.contains("museum") || c.contains("exhibit") || c.contains("gallery")
                || c.contains("heritage") { return "building.columns.fill" }
            if c.contains("theat") || c.contains("art") { return "theatermasks.fill" }
            if c.contains("film") || c.contains("cinema") || c.contains("screening") { return "film.fill" }
            if c.contains("food") || c.contains("drink") { return "fork.knife" }
            if c.contains("family") || c.contains("kid") || c.contains("child") { return "balloon.2.fill" }
            if c.contains("tour") || c.contains("walk") || c.contains("outdoor") { return "figure.walk" }
            if c.contains("free") { return "ticket.fill" }
            return "sparkles"
        }
    }
}

// MARK: - Pulse logo
//
// "Proximity": a filled dot with two rising arcs above it. The dot is the
// person, the arcs are the two axes the product actually ranks on, close and
// soon. There is no map pin in it, which is the point: the pin said "map app"
// and said nothing about what this one does. It also holds up better than a
// pin at 18pt, because three separated shapes survive shrinking where a
// silhouette with a knocked-out counter does not.
//
// The geometry lives on a 24x24 grid and is mirrored in three other places:
// ios/tools/make_icon.js (which rasterises the app icon PNGs),
// ios/tools/make_icon.swift (its CoreGraphics twin) and api/public/icon.svg
// (the web and PWA mark). All four must be kept in step, so the numbers below
// are the reference.
//
//   dot     centre (12, 17)   radius 2.6, filled
//   arc 1   (7.6, 12.6) to (16.4, 12.6)  on radius 6.2
//   arc 2   (4.2, 8.9)  to (19.8, 8.9)   on radius 11
//   both arcs stroked at 2.1 with round caps
//
// Each arc is the minor arc that bulges upward, which is how the handoff's two
// SVG arc commands resolve. Both chords are horizontal, so each centre sits
// directly below its chord's midpoint. They land at (12, 16.968) and
// (12, 16.656), near enough to the dot that the mark reads as concentric.
//
// This is a stroked mark, but `Shape` has to hand back one fillable `Path`, so
// the two strokes are converted to closed outlines here: outer edge forward,
// round cap, inner edge back, round cap. The three subpaths do not touch, so
// the fill rule makes no difference to the result.

enum PulseLogoGeometry {
    static let dotCentre = CGPoint(x: 12, y: 17)
    static let dotRadius: CGFloat = 2.6
    static let strokeWidth: CGFloat = 2.1

    /// One of the two rising arcs, resolved from its two endpoints and radius
    /// so that this file and the two icon generators all start from the same
    /// four numbers rather than from transcribed angles.
    struct Arc {
        let centre: CGPoint
        let radius: CGFloat
        /// Degrees in the view's own space, where y increases downward, so 270
        /// is straight up. The sweep runs from `startDegrees` to `endDegrees`
        /// in the direction of increasing angle.
        let startDegrees: Double
        let endDegrees: Double

        init(from: CGPoint, to: CGPoint, radius: CGFloat) {
            let dx = to.x - from.x
            let dy = to.y - from.y
            let half = ((dx * dx + dy * dy) / 4).squareRoot()
            // Positive y is downward, so adding the sagitta puts the centre
            // below the chord and leaves the minor arc bulging upward.
            let drop = (radius * radius - half * half).squareRoot()
            let c = CGPoint(x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + drop)
            self.centre = c
            self.radius = radius
            self.startDegrees = Arc.angle(of: from, about: c)
            self.endDegrees = Arc.angle(of: to, about: c)
        }

        /// Polar angle of `p` about `c`, normalised to 0 up to 360 so that a
        /// sweep over the top is an increasing range rather than one that
        /// wraps through zero.
        static func angle(of p: CGPoint, about c: CGPoint) -> Double {
            let a = atan2(Double(p.y - c.y), Double(p.x - c.x)) * 180 / Double.pi
            return a < 0 ? a + 360 : a
        }

        /// A point at `radius` and `degrees` from `centre`, for a centre and
        /// radius already scaled into the destination rect.
        static func point(about c: CGPoint, radius: CGFloat, degrees: Double) -> CGPoint {
            let a = degrees * Double.pi / 180
            return CGPoint(x: c.x + radius * CGFloat(cos(a)),
                           y: c.y + radius * CGFloat(sin(a)))
        }
    }

    static let arcs: [Arc] = [
        Arc(from: CGPoint(x: 7.6, y: 12.6), to: CGPoint(x: 16.4, y: 12.6), radius: 6.2),
        Arc(from: CGPoint(x: 4.2, y: 8.9), to: CGPoint(x: 19.8, y: 8.9), radius: 11),
    ]

    /// Builds the logo inside `rect`, fitted to a 24x24 grid and centred.
    /// The result is three closed subpaths that can simply be filled.
    static func path(in rect: CGRect) -> Path {
        let s = min(rect.width / 24, rect.height / 24)
        let ox = rect.midX - 12 * s
        let oy = rect.midY - 12 * s
        func place(_ pt: CGPoint) -> CGPoint { CGPoint(x: ox + pt.x * s, y: oy + pt.y * s) }

        var path = Path()

        let dc = place(dotCentre)
        let dr = dotRadius * s
        path.addEllipse(in: CGRect(x: dc.x - dr, y: dc.y - dr, width: 2 * dr, height: 2 * dr))

        let cap = strokeWidth / 2 * s
        for arc in arcs {
            let c = place(arc.centre)
            let mid = arc.radius * s
            let start = Angle(degrees: arc.startDegrees)
            let end = Angle(degrees: arc.endDegrees)
            let capStart = Arc.point(about: c, radius: mid, degrees: arc.startDegrees)
            let capEnd = Arc.point(about: c, radius: mid, degrees: arc.endDegrees)

            // Outer edge, forward. clockwise: false traverses in the direction
            // of increasing angle, which in this y-down space is visually
            // clockwise, so the sweep goes over the top.
            path.move(to: Arc.point(about: c, radius: mid + cap, degrees: arc.startDegrees))
            path.addArc(center: c, radius: mid + cap,
                        startAngle: start, endAngle: end, clockwise: false)
            // Round cap at the finishing end, bulging past it.
            path.addArc(center: capEnd, radius: cap,
                        startAngle: end, endAngle: Angle(degrees: arc.endDegrees + 180),
                        clockwise: false)
            // Inner edge, back the way we came.
            path.addArc(center: c, radius: mid - cap,
                        startAngle: end, endAngle: start, clockwise: true)
            // Round cap at the starting end, closing the outline.
            path.addArc(center: capStart, radius: cap,
                        startAngle: Angle(degrees: arc.startDegrees + 180),
                        endAngle: Angle(degrees: arc.startDegrees + 360),
                        clockwise: false)
            path.closeSubpath()
        }
        return path
    }
}

struct PulseLogo: Shape {
    /// The dot and the two arc outlines are disjoint, so even-odd and non-zero
    /// give the same result. Kept as a named style because the view passes it
    /// and because it is the safe rule if the geometry ever gains a hole.
    static let fillStyle = FillStyle(eoFill: true)
    func path(in rect: CGRect) -> Path { PulseLogoGeometry.path(in: rect) }
}

/// The logo as used in headers and on the onboarding screen.
struct PulseLogoView: View {
    var size: CGFloat
    var color: Color = Tok.accent
    var body: some View {
        PulseLogo()
            .fill(color, style: PulseLogo.fillStyle)
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

// MARK: - Date helpers

enum Fmt {
    static func time(_ d: Date?) -> String {
        guard let d else { return "Time TBA" }
        return d.formatted(.dateTime.hour().minute())
    }
    /// The overline above a card title: "Today, 19:00", "Sat, 8 Aug, 19:00".
    /// `soon` marks the next two days, which is the one place in a list where
    /// colouring something actually helps.
    static func when(_ d: Date?) -> (text: String, soon: Bool) {
        guard let d else { return ("Date to be announced", false) }
        let time = d.formatted(.dateTime.hour().minute())
        let days = Calendar.current.dateComponents(
            [.day], from: Calendar.current.startOfDay(for: .now),
            to: Calendar.current.startOfDay(for: d)).day ?? 0
        if days <= 0 { return ("Today, \(time)", true) }
        if days == 1 { return ("Tomorrow, \(time)", true) }
        let day = d.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))
        return ("\(day), \(time)", false)
    }

    static func relDay(_ d: Date?) -> String {
        guard let d else { return "Date TBA" }
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: .now),
                                                   to: Calendar.current.startOfDay(for: d)).day ?? 0
        if days <= 0 { return "Today" }
        if days == 1 { return "Tomorrow" }
        if days < 7 { return "In \(days) days" }
        return d.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }
    /// Whether distances render in miles. Pulse serves the UK, where road
    /// signs are in miles, so that is the default and what every region the
    /// API knows about reports back. It stays a variable only so the feed's
    /// own `unit` remains the authority if that ever changes.
    nonisolated(unsafe) static var usesMiles: Bool = true

    static var distanceUnit: String { usesMiles ? "mi" : "km" }

    /// Bare distance number, already converted into `distanceUnit`.
    /// The API always sends kilometres.
    static func km(_ v: Double?) -> String {
        guard let v else { return "n/a" }
        let d = usesMiles ? v * 0.621371 : v
        return d < 10 ? String(format: "%.1f", d) : String(Int(d.rounded()))
    }

    /// Distance with its unit attached, e.g. "2.4 km" or "1.5 mi".
    static func distance(_ v: Double?) -> String {
        guard v != nil else { return "n/a" }
        return "\(km(v)) \(distanceUnit)"
    }
}
