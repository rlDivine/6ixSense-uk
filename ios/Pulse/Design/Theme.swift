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
    static let bg       = Color(dark: 0x080E1C, light: 0xF6F7FB)
    static let panel    = Color(dark: 0x0F1730, light: 0xFFFFFF)
    static let panel2   = Color(dark: 0x16203C, light: 0xEEF1F7)
    static let hairline = Color(dark: 0x1D2846, light: 0xE3E7F0)

    /// Three weights of text. Using all three, rather than just text and muted,
    /// is most of what gives a list its hierarchy.
    static let text     = Color(dark: 0xEEF1F8, light: 0x0B1633)
    static let muted    = Color(dark: 0x9AA5C2, light: 0x59627B)
    /// Solved against the worst background each theme puts it on, which is
    /// panel2 in both cases. The earlier values failed 4.5:1 on the card
    /// overline and footer, which are real text, not decoration.
    static let faint    = Color(dark: 0x7D88A4, light: 0x686E7E)

    /// Flag red, for text and indicators. On dark it has to be light enough to
    /// read on navy.
    static let accent   = Color(dark: 0xF44F63, light: 0xC8102E)
    /// The same red as a filled background under a white label, which needs the
    /// opposite of the above: dark enough for white to clear 4.5:1. One colour
    /// cannot do both on a dark theme, so fills get their own token. On light,
    /// Pantone 186 already carries white at 5.9:1 and no split is needed.
    static let accentFill = Color(dark: 0xD21E3C, light: 0xC8102E)
    /// Flag blue, for links and secondary emphasis.
    static let link     = Color(dark: 0x8FADEA, light: 0x012169)

    /// Selected state. Flag navy on light, near white on dark, with the
    /// matching foreground so a filled chip is always legible.
    static let activeBg = Color(dark: 0xEEF1F8, light: 0x012169)
    static let activeFg = Color(dark: 0x0B1327, light: 0xFFFFFF)

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
                .withAlphaComponent(dark ? 0.18 : 0.12)
        })
    }
}

enum Categories {
    static let map: [String: CatStyle] = [
        "pop-up": .init(dark: 0xC08CE8, light: 0x7A5BA6),
        "food & drink": .init(dark: 0xE0913F, light: 0xB5651D),
        "festival": .init(dark: 0xF44F63, light: 0xC8102E),
        "music": .init(dark: 0x6E9BF0, light: 0x2E5AAC),
        "live music": .init(dark: 0x8FBCF5, light: 0x4A7FD4),
        "market": .init(dark: 0x45C4A5, light: 0x2E7D6B),
        "comedy": .init(dark: 0xEE6E9C, light: 0xB03060),
        "arts": .init(dark: 0x9B87EC, light: 0x6B4FA0),
        "film": .init(dark: 0xEE7093, light: 0xA03A5C),
        "tours": .init(dark: 0x5FC0D6, light: 0x3E7C8C),
        "sports": .init(dark: 0x4FBE85, light: 0x1F5C3D),
        "family": .init(dark: 0xEFA05C, light: 0xC06A2E),
    ]
    static func style(_ category: String) -> CatStyle {
        map[category.lowercased()] ?? .init(dark: 0x98A2BC, light: 0x5A6580)
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
    /// SF Symbol for native map Markers (which can't render emoji).
    static func symbol(_ category: String) -> String {
        let c = category.lowercased()
        switch c {
        case "pop-up":        return "gift.fill"
        case "food & drink":  return "fork.knife"
        case "festival":      return "party.popper.fill"
        case "live music":    return "guitars.fill"
        case "market":        return "bag.fill"
        case "comedy":        return "theatermasks.fill"
        case "film":          return "film.fill"
        case "tours":         return "figure.walk"
        case "family":        return "balloon.2.fill"
        default:
            if c.contains("music") || c.contains("concert") { return "music.note" }
            if c.contains("sport") || c.contains("football") || c.contains("rugby")
                || c.contains("cricket") || c.contains("racing") { return "sportscourt.fill" }
            if c.contains("art") || c.contains("theat") { return "paintpalette.fill" }
            if c.contains("comedy") { return "theatermasks.fill" }
            if c.contains("free") { return "ticket.fill" }
            return "mappin"
        }
    }
}

// MARK: - Pulse logo (placeholder)
//
// A flat map pin with a knocked-out centre. Deliberately plain: this is a
// stand-in until a real identity exists, so it is built to be legible at 20pt
// in a header and at 1024px on the home screen, and to be thrown away without
// anything else needing to change.
//
// The geometry lives on a 24x24 grid and is mirrored in two other places:
// ios/tools/make_icon.js (which generates the app icon PNGs) and
// api/public/icon.svg (the web mark). The three must be kept in step, so the
// numbers below are the reference.
//
//   head centre   (12, 8.8)   radius 5.6
//   point         (12, 20.8)
//   counter       (12, 8.8)   radius 2.4
//
// The tail is bounded by the two lines from the point that are tangent to the
// head, which is what keeps the join between circle and tail smooth rather
// than kinked. Those tangent points fall at (7.047, 11.413) and
// (16.953, 11.413).

enum PulseLogoGeometry {
    static let headCentre = CGPoint(x: 12, y: 8.8)
    static let headRadius: CGFloat = 5.6
    static let point = CGPoint(x: 12, y: 20.8)
    static let counterRadius: CGFloat = 2.4

    /// Angles of the two tangent points, measured in the view's own coordinate
    /// space (y increasing downward), so they can be handed straight to addArc.
    static let tangentStart = Angle(degrees: 152.18)   // left tangent point
    static let tangentEnd = Angle(degrees: 387.82)     // right tangent point, gone the long way round the top

    /// Builds the logo inside `rect`, fitted to a 24x24 grid and centred.
    /// The result is one closed outline plus the counter, so it must be filled
    /// even-odd for the counter to read as a hole.
    static func path(in rect: CGRect) -> Path {
        let s = min(rect.width / 24, rect.height / 24)
        let ox = rect.midX - 12 * s, oy = rect.midY - 12 * s
        func p(_ pt: CGPoint) -> CGPoint { CGPoint(x: ox + pt.x * s, y: oy + pt.y * s) }

        var path = Path()
        // Head, entered at the left tangent point and swept over the top to the
        // right one. clockwise: false traverses in the direction of increasing
        // angle, which in this y-down space is visually clockwise.
        path.addArc(center: p(headCentre), radius: headRadius * s,
                    startAngle: tangentStart, endAngle: tangentEnd, clockwise: false)
        path.addLine(to: p(point))
        path.closeSubpath()

        // Counter.
        let c = p(headCentre), r = counterRadius * s
        path.addEllipse(in: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r))
        return path
    }
}

struct PulseLogo: Shape {
    /// Even-odd is what turns the counter into a hole rather than a second
    /// filled disc.
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
