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

    /// Tint laid over the material on translucent chrome, so glass takes the
    /// app's colour instead of the system's neutral grey.
    ///
    /// 0.88 is solved, not chosen. The map tray has live map tiles moving under
    /// it, so the composite has to hold against a white backdrop as well as a
    /// black one. At this alpha `text` clears 4.5:1 in both themes and so does
    /// `muted`; at 0.85 muted drops to 4.29:1 dark and 4.30:1 light and fails.
    /// The web client's --glass is the same colour at the same alpha.
    static let glass = Color(dark: 0x1C2231, light: 0xFFFFFF).opacity(0.88)

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

// MARK: - VenTrack logo
//
// "Beacon": a map pin with a pulse trace knocked out of it as a counter. The
// pin says map at a glance, and the trace is what stops it being a stock
// location pin: it names the product rather than the category.
//
// This replaced "Proximity", a dot under two rising arcs, which read as a wifi
// symbol at every size. The handoff recommends Proximity on the grounds that a
// silhouette with a knocked-out counter does not shrink as well as three
// separated shapes, and that is a real trade: see the note on `trace` below.
//
// The geometry lives on a 24x24 grid and is mirrored in four other places:
// ios/tools/make_icon.js (which rasterises the app icon PNGs),
// ios/tools/make_icon.swift (its CoreGraphics twin), api/public/icon.svg (the
// web and PWA mark) and the inline brand mark in api/public/index.html, which
// the old note missed. All five must be kept in step, so the numbers below
// are the reference. They are the handoff's own path, converted from SVG's
// endpoint arcs to the centre and angles that CoreGraphics and SwiftUI want.
// The conversion was checked by rendering both forms and comparing pixels.
//
// Unlike the old mark this is a single filled outline with a hole in it, so
// the even-odd rule is now load bearing rather than incidental.

enum VenTrackLogoGeometry {
    /// The pin's head. Both of the outline's long arcs ride this circle.
    static let headCentre = CGPoint(x: 12, y: 10)
    static let headRadius: CGFloat = 8.2

    /// Where the crown starts and the two flanks meet the head, in degrees in
    /// the view's own space: y increases downward, so 270 is straight up.
    static let crownStart: Double = 270      // (12, 1.8), the top
    static let crownEnd: Double = 180        // (3.8, 10), the left
    static let flankStart: Double = 0        // (20.2, 10), the right
    static let flankEnd: Double = -90        // back to the top

    /// The rounded tip. Its chord runs from (11.3, 22.3) to (12.7, 22.3), so
    /// the centre sits directly above the midpoint by the sagitta and the minor
    /// arc bulges downward into the point.
    static let tipRadius: CGFloat = 1.1
    static let tipHalfChord: CGFloat = 0.7
    static let tipChordY: CGFloat = 22.3
    static let tipCentre = CGPoint(
        x: 12,
        y: tipChordY - (tipRadius * tipRadius - tipHalfChord * tipHalfChord).squareRoot()
    )

    /// The left flank, as a cubic from the head down to the tip, and the right
    /// flank back up. Straight from the handoff's two curve commands.
    static let leftFlank = (control1: CGPoint(x: 3.8, y: 15.9),
                            control2: CGPoint(x: 11, y: 22),
                            end: CGPoint(x: 11.3, y: 22.3))
    static let rightFlank = (control1: CGPoint(x: 13, y: 22),
                             control2: CGPoint(x: 20.2, y: 15.9),
                             end: CGPoint(x: 20.2, y: 10))

    /// The pulse trace, as a centreline to be stroked at a constant width.
    ///
    /// The handoff supplies this as a ready made outline, and that outline is
    /// not a constant width stroke: its left tail is 0.2 units thick and its
    /// right bar is 1.4, seven times heavier. Filled, it read as a hairline
    /// running into a block rather than as a trace. Stroking a centreline is
    /// what it was meant to look like, so that is what happens here.
    ///
    /// Spans x 6.6 to 17.4, centred on the pin's own 12. Every cap stays inside
    /// the head with room to spare: the furthest, the round cap at (6.6, 10.2),
    /// sits 6.22 from the head centre against a radius of 8.2.
    ///
    /// This is still the part that pays for the pin: at 18pt in a header the
    /// trace is close to the limit of what survives, and below about 20pt it
    /// starts to fill in. It is legible at the sizes the app actually uses.
    static let trace: [CGPoint] = [
        CGPoint(x: 6.6,  y: 10.2),
        CGPoint(x: 9.4,  y: 10.2),
        CGPoint(x: 10.9, y: 6.2),
        CGPoint(x: 12.9, y: 12.6),
        CGPoint(x: 14,   y: 9.4),
        CGPoint(x: 17.4, y: 9.4),
    ]
    static let traceWidth: CGFloat = 1.5

    /// Polar angle of `p` about `c`, in the same y-down degrees as above.
    static func angle(of p: CGPoint, about c: CGPoint) -> Double {
        atan2(Double(p.y - c.y), Double(p.x - c.x)) * 180 / Double.pi
    }

    /// Builds the logo inside `rect`, fitted to a 24x24 grid and centred. The
    /// result is two closed subpaths, the pin and the trace inside it, meant to
    /// be filled even-odd so the trace reads as a hole.
    static func path(in rect: CGRect) -> Path {
        let s = min(rect.width / 24, rect.height / 24)
        let ox = rect.midX - 12 * s
        let oy = rect.midY - 12 * s
        func place(_ pt: CGPoint) -> CGPoint { CGPoint(x: ox + pt.x * s, y: oy + pt.y * s) }

        var path = Path()

        let head = place(headCentre)
        let hr = headRadius * s
        let tip = place(tipCentre)
        let tr = tipRadius * s
        let tipStart = angle(of: CGPoint(x: 12 - tipHalfChord, y: tipChordY), about: tipCentre)
        let tipEnd = angle(of: CGPoint(x: 12 + tipHalfChord, y: tipChordY), about: tipCentre)

        // Every sweep here runs in the direction of decreasing angle, which in
        // this y-down space is anticlockwise on screen, so `clockwise: true`
        // throughout. Each arc begins exactly where the previous command left
        // off, so none of them inserts a joining line.
        path.move(to: place(CGPoint(x: 12, y: 1.8)))
        path.addArc(center: head, radius: hr,
                    startAngle: .degrees(crownStart), endAngle: .degrees(crownEnd),
                    clockwise: true)
        path.addCurve(to: place(leftFlank.end),
                      control1: place(leftFlank.control1),
                      control2: place(leftFlank.control2))
        path.addArc(center: tip, radius: tr,
                    startAngle: .degrees(tipStart), endAngle: .degrees(tipEnd),
                    clockwise: true)
        path.addCurve(to: place(rightFlank.end),
                      control1: place(rightFlank.control1),
                      control2: place(rightFlank.control2))
        path.addArc(center: head, radius: hr,
                    startAngle: .degrees(flankStart), endAngle: .degrees(flankEnd),
                    clockwise: true)
        path.closeSubpath()

        // The trace is a stroke, but a Shape has to hand back one fillable
        // path, so it is converted to its own outline here. Filled even-odd
        // alongside the pin, that outline becomes a hole rather than a mark.
        if let first = trace.first {
            var line = Path()
            line.move(to: place(first))
            for point in trace.dropFirst() { line.addLine(to: place(point)) }
            path.addPath(line.strokedPath(StrokeStyle(lineWidth: traceWidth * s,
                                                      lineCap: .round,
                                                      lineJoin: .round)))
        }

        return path
    }
}

struct VenTrackLogo: Shape {
    /// The dot and the two arc outlines are disjoint, so even-odd and non-zero
    /// give the same result. Kept as a named style because the view passes it
    /// and because it is the safe rule if the geometry ever gains a hole.
    static let fillStyle = FillStyle(eoFill: true)
    func path(in rect: CGRect) -> Path { VenTrackLogoGeometry.path(in: rect) }
}

/// The logo as used in headers and on the onboarding screen.
struct VenTrackLogoView: View {
    var size: CGFloat
    var color: Color = Tok.accent
    var body: some View {
        VenTrackLogo()
            .fill(color, style: VenTrackLogo.fillStyle)
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
    /// Whether distances render in miles. VenTrack serves the UK, where road
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

    // The radius control in Settings is chosen in the unit on the road signs
    // and compared against an API that only ever speaks kilometres, so the
    // conversion lives here beside `km(_:)` rather than being written out a
    // second time somewhere else. One factor, one place, one authority.

    /// A distance the user picked, in `distanceUnit`, as kilometres.
    static func toKm(_ display: Double) -> Double {
        usesMiles ? display / 0.621371 : display
    }

    /// A distance from the API, in kilometres, in `distanceUnit`.
    static func toDisplay(_ km: Double) -> Double {
        usesMiles ? km * 0.621371 : km
    }

    /// A whole-number radius with its unit, e.g. "10 mi". Radii are chosen from
    /// a short list of round numbers, so unlike `km(_:)` this never needs a
    /// decimal place.
    static func radius(_ km: Double) -> String {
        "\(Int(toDisplay(km).rounded())) \(distanceUnit)"
    }
}
