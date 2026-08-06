import SwiftUI

// MARK: - Colour tokens (HANDOFF.md §3) — adapt automatically to light/dark.

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
    static let bg       = Color(dark: 0x0E1116, light: 0xF7F8FA)
    static let panel    = Color(dark: 0x161B22, light: 0xFFFFFF)
    static let panel2   = Color(dark: 0x1C2430, light: 0xEEF1F5)
    static let hairline = Color(dark: 0x2A3340, light: 0xE2E6EC)
    static let text     = Color(dark: 0xE8EDF3, light: 0x131720)
    static let muted    = Color(dark: 0x9AA7B4, light: 0x5C6773)
    static let chip     = Color(dark: 0x222C39, light: 0xEAEEF3)
    static let accent   = Color(hex: 0xFF6251)   // brand red — same both themes
    static let accent2  = Color(hex: 0x4AA3FF)   // blue
    static let freeFg   = Color(hex: 0x2BB37C)
}

// MARK: - Category palette + glyphs (HANDOFF.md §3.3)

struct CatStyle { let color: Color; let glyph: String }

enum Categories {
    static let map: [String: CatStyle] = [
        "pop-up": .init(color: Color(hex: 0xC77DFF), glyph: "🎁"),
        "food & drink": .init(color: Color(hex: 0xFF7A59), glyph: "🍔"),
        "festival": .init(color: Color(hex: 0xFBBF24), glyph: "🎪"),
        "music": .init(color: Color(hex: 0x4AA3FF), glyph: "🎵"),
        "live music": .init(color: Color(hex: 0x38BDF8), glyph: "🎸"),
        "market": .init(color: Color(hex: 0x34D399), glyph: "🛍️"),
        "comedy": .init(color: Color(hex: 0xF472B6), glyph: "🎤"),
        "arts": .init(color: Color(hex: 0xA78BFA), glyph: "🎨"),
        "film": .init(color: Color(hex: 0xFB7185), glyph: "🎬"),
        "tours": .init(color: Color(hex: 0x22D3EE), glyph: "🚶"),
        "sports": .init(color: Color(hex: 0x818CF8), glyph: "⚽"),
        "family": .init(color: Color(hex: 0xFCA5A5), glyph: "🎡"),
    ]
    static func style(_ category: String) -> CatStyle {
        map[category.lowercased()] ?? .init(color: Color(hex: 0x7C8AA0), glyph: "✨")
    }
    static func gradient(_ category: String) -> LinearGradient {
        let c = style(category).color
        return LinearGradient(colors: [c.opacity(0.42), c.opacity(0.10)],
                              startPoint: .topLeading, endPoint: .bottomTrailing)
    }
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

// MARK: - Pulse brand mark
// A pulse traced across a ring: the ring says "everything around you", the
// trace says "right now". Drawn in a 24×24 space so it scales cleanly from a
// 26pt header glyph to a 1024px app icon.
//
// `PulseMarkGeometry` is the single source of truth, shared by the in-app
// glyph, the generated app icon (tools/make_icon.swift) and the web mark
// (api/public/icon.svg), so every surface is the same drawing.

enum PulseMarkGeometry {
    /// The pulse trace, as points on the 24×24 grid: flat, up, down, flat.
    static let trace: [CGPoint] = [
        CGPoint(x: 6.0, y: 12.0),
        CGPoint(x: 9.0, y: 12.0),
        CGPoint(x: 10.7, y: 7.8),
        CGPoint(x: 13.3, y: 16.2),
        CGPoint(x: 15.0, y: 12.0),
        CGPoint(x: 18.0, y: 12.0),
    ]
    static let outerRadius: CGFloat = 11.0
    static let innerRadius: CGFloat = 8.6
    static let traceWidth: CGFloat = 1.7

    /// Builds the mark inside `rect` (fit to a 24×24 grid, centred). The result
    /// is a single fillable path — ring plus trace — so callers just fill it.
    static func path(in rect: CGRect) -> Path {
        let s = min(rect.width / 24, rect.height / 24)
        let cx = rect.midX, cy = rect.midY
        func p(_ pt: CGPoint) -> CGPoint {
            CGPoint(x: cx + (pt.x - 12) * s, y: cy + (pt.y - 12) * s)
        }
        func circle(_ r: CGFloat) -> CGRect {
            CGRect(x: cx - r * s, y: cy - r * s, width: 2 * r * s, height: 2 * r * s)
        }

        // Ring: outer circle with the inner one knocked out. Both are drawn in
        // the same direction, so `.evenOdd` is what makes the hole a hole.
        var ring = Path()
        ring.addEllipse(in: circle(outerRadius))
        ring.addEllipse(in: circle(innerRadius))

        var trace = Path()
        trace.move(to: p(Self.trace[0]))
        for pt in Self.trace.dropFirst() { trace.addLine(to: p(pt)) }
        let strokedTrace = trace.strokedPath(
            StrokeStyle(lineWidth: traceWidth * s, lineCap: .round, lineJoin: .round)
        )

        var out = Path()
        out.addPath(ring)
        out.addPath(strokedTrace)
        return out
    }
}

struct PulseMark: Shape {
    /// Even-odd is required: it is what turns the ring's inner circle into a
    /// hole rather than a second filled disc.
    static let fillStyle = FillStyle(eoFill: true)
    func path(in rect: CGRect) -> Path { PulseMarkGeometry.path(in: rect) }
}

/// The brand glyph as used in headers and on the onboarding splash.
struct PulseMarkView: View {
    var size: CGFloat
    var color: Color = Tok.accent
    var body: some View {
        PulseMark()
            .fill(color, style: PulseMark.fillStyle)
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

// MARK: - Date helpers

enum Fmt {
    static func badge(_ d: Date?) -> (m: String, day: String) {
        guard let d else { return ("TBA", "·") }
        let m = d.formatted(.dateTime.month(.abbreviated)).uppercased()
        return (m, d.formatted(.dateTime.day()))
    }
    static func time(_ d: Date?) -> String {
        guard let d else { return "Time TBA" }
        return d.formatted(.dateTime.hour().minute())
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
