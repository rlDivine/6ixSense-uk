import Foundation
import SwiftUI

// MARK: - Colour tokens
//
// A near neutral ground with one rationed accent, per the visual overhaul
// handoff. The subject matter is already colourful, since every event carries a
// photograph, so the interface recedes and lets those carry the colour.
//
// Three rules that are easy to undo by accident:
//
//   Every value is a flat colour. Translucency comes from .ultraThinMaterial,
//   never from a colour ramp. There is no gradient anywhere in the app.
//
//   No purple and no pink. The dark accent is RE-PICKED, not lightened. The
//   old dark accent was the flag red brightened to survive a dark panel, and
//   lightening a red at that hue angle is exactly what produces salmon. The
//   value below sits on the orange side of red, where lifting it in value
//   never reaches pink. Do not nudge it back toward 0xC8102E.
//
//   activeBg is deliberately NOT the accent. Selection is monochrome, which is
//   what lets red still mean "this is on today" rather than appearing a dozen
//   times a screen and meaning nothing.

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
    /// The page. A warm white, and a dark that is cool grey with no navy in it.
    static let bg       = Color(dark: 0x0C0D0F, light: 0xFBFAF8)
    /// Only where a surface genuinely lifts off the page, which in practice is
    /// the map preview and sheets. Feed rows do NOT sit on this: they sit on
    /// `bg` and are separated by a single hairline. That change is most of what
    /// stops the app reading as a dashboard.
    static let panel    = Color(dark: 0x16181B, light: 0xFFFFFF)
    /// Wells, chips, the search field, skeletons.
    static let panel2   = Color(dark: 0x1F2226, light: 0xF2F0EC)
    /// The one separator. Between feed rows, around the detail fact strip,
    /// between preference rows, and nowhere a boundary is already obvious.
    static let hairline = Color(dark: 0x2B2F34, light: 0xE4E1DB)

    /// Tint laid over the material on translucent chrome, so glass takes the
    /// app's colour instead of the system's neutral grey.
    ///
    /// 0.88 is solved, not chosen. The map tray has live map tiles moving under
    /// it, so the composite has to hold against a white backdrop as well as a
    /// black one. At this alpha `text` clears 4.5:1 in both themes and so does
    /// `muted`; at 0.85 muted drops to 4.29:1 dark and 4.30:1 light and fails.
    /// The web client's --glass is the same colour at the same alpha.
    static let glass = Color(dark: 0x16181B, light: 0xFFFFFF).opacity(0.88)

    /// Three weights of text. Using all three, rather than just text and muted,
    /// is most of what gives a list its hierarchy.
    static let text     = Color(dark: 0xF1F2F3, light: 0x1A1A1C)
    static let muted    = Color(dark: 0x9EA3A9, light: 0x5F6165)
    /// Captions and overlines that should recede.
    ///
    /// LIFTED FROM THE HANDOFF, deliberately. It specifies 0x6C7278 dark and
    /// 0x86888E light, and both fail 4.5:1 on every surface they are used on:
    /// 4.00 and 3.40 on `bg`, 3.28 and 3.11 on `panel2`. This is not decoration,
    /// it is the card's overline and footer, so the brief's own accessibility
    /// rule applies and the handoff's section 10 asks for exactly this
    /// measurement. These are the smallest hue-preserving lifts that clear the
    /// bar against the worst surface each theme puts it on, which is panel2:
    /// 4.52 dark and 4.54 light. Darkening either one puts real text below AA.
    static let faint    = Color(dark: 0x84898E, light: 0x6C6D72)

    /// Rationed. "On today", the active tab, the price on the paywall. Nothing
    /// else. See the note above the enum on why the dark value is not a
    /// lightened flag red.
    ///
    /// One live constraint: against `panel2` this reaches 4.33:1 dark, which is
    /// AA for large text only. The handoff says not to lighten it further, so
    /// the rule is the other way round: do not put SMALL accent text on
    /// `panel2`. On `bg` it has comfortable headroom at 5.27:1.
    static let accent   = Color(dark: 0xE2574A, light: 0xB8112B)
    /// The same red as a filled background under a white label, which wants the
    /// opposite of the above: dark enough for white to clear 4.5:1. One colour
    /// cannot do both on a dark theme, so fills keep their own token. White on
    /// this reaches 5.16:1 dark and 6.66:1 light.
    static let accentFill = Color(dark: 0xC2402F, light: 0xB8112B)
    /// Directions, restore, secondary emphasis.
    static let link     = Color(dark: 0x7FA7D4, light: 0x0A3C86)

    /// Selected state, monochrome on purpose. Near black on light and near
    /// white on dark, with the matching foreground so a filled chip is always
    /// legible. Both directions land at 17:1.
    static let activeBg = Color(dark: 0xF1F2F3, light: 0x1A1A1C)
    static let activeFg = Color(dark: 0x0C0D0F, light: 0xFFFFFF)

    /// Kept for the Free label, which uses the accent rather than reaching for
    /// a green that belongs to neither flag colour.
    static let freeFg   = accent
    /// Older name for `panel2`, kept so nothing has to be renamed twice.
    static let chip     = panel2
}

// MARK: - Radius
//
// Five steps plus full round, where the app previously had one value used
// everywhere. This is what restores object hierarchy: a sheet at 28 and a chip
// at full round read as different KINDS of thing. Do not normalise them back
// toward each other.

enum R {
    /// Category marks and small indicators.
    static let mark: CGFloat   = 8
    /// Card thumbnails.
    static let thumb: CGFloat  = 10
    /// Wells, rectangular chips, the search field, the notice.
    static let well: CGFloat   = 12
    /// Buttons, primary and secondary.
    static let button: CGFloat = 14
    /// Cards and feature images.
    static let card: CGFloat   = 18
    /// Sheets and the map tray.
    static let sheet: CGFloat  = 28
}

// MARK: - Spacing, on a four point base

enum S {
    static let s1: CGFloat = 4
    static let s2: CGFloat = 8
    static let s3: CGFloat = 12
    static let s4: CGFloat = 16
    /// The screen gutter.
    static let s5: CGFloat = 20
    static let s6: CGFloat = 24
    static let s7: CGFloat = 32
}

// MARK: - Type
//
// SF Pro across a real range, not a second typeface. The app has to read as
// obviously native and a display face fights that. What was wrong was never the
// typeface, it was that everything sat at 13pt semibold with nothing to anchor
// a screen and nothing that genuinely receded.
//
// The gap that matters is 34 down to 11. If a new screen needs a size, take it
// from this list rather than inventing one between two existing steps.
//
// Nothing here is .fixedSize, so all of it scales with Dynamic Type.

enum F {
    /// Town name, detail title, paywall headline.
    static var display: Font  { .system(size: 34, weight: .bold) }
    /// Empty and error headlines, sheet titles.
    static var title: Font    { .system(size: 27, weight: .bold) }
    /// The event title. The card's anchor.
    static var headline: Font { .system(size: 20, weight: .semibold) }
    /// Descriptions, preference rows, list values.
    static var body: Font     { .system(size: 17, weight: .regular) }
    /// Venue and supporting metadata.
    static var callout: Font  { .system(size: 15, weight: .medium) }
    /// Sub values under a fact.
    static var footnote: Font { .system(size: 13, weight: .regular) }
    /// Overlines, section headers, units. Always uppercase, always tracked out.
    static var caption: Font  { .system(size: 11, weight: .semibold) }

    /// Distance figures. Monospaced so a column of them aligns down the feed,
    /// which is half of what makes the right hand column scannable without
    /// reading any words.
    static var distance: Font { .system(size: 20, weight: .bold).monospacedDigit() }
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
    /// own. This replaced a gradient: the tint alone carries the family.
    ///
    /// CONTAINED to a thumbnail or a feature image. Never a wash behind a whole
    /// card: that was the old habit that made the feed read as a colour coded
    /// spreadsheet, and it is the thing the six family merge exists to stop.
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
                .withAlphaComponent(dark ? 0.16 : 0.11)
        })
    }
}

/// Six families, not thirteen hues.
///
/// Thirteen hues at similar saturation across cards, pins and chips read as a
/// colour coded spreadsheet, and five of them were the purples and pinks the
/// overhaul had to remove. Merging to six families removes those as a side
/// effect of a structural decision rather than as a patch, and six still covers
/// every listing type the corpus produces.
///
/// Colour is an accent INSIDE a card, never the card's identity: a 14x3 rule
/// beside the overline, a map pin, a corner rule on a feature image, or a
/// contained thumbnail tint. Never a wash behind a whole card.
enum Family: String, CaseIterable {
    case music, stage, culture, sport, food, outdoor

    /// Always rendered as text beside the rule. Family colour is never the only
    /// carrier of meaning, which is both an accessibility rule and the reason
    /// the greyscale test still passes.
    var label: String {
        switch self {
        case .music:   return "Music"
        case .stage:   return "Stage"
        case .culture: return "Culture"
        case .sport:   return "Sport"
        case .food:    return "Food"
        case .outdoor: return "Outdoor"
        }
    }

    /// An SF Symbol, never an emoji: symbols inherit tint, weight and Dynamic
    /// Type, which is the whole reason the emoji had to go.
    var symbol: String {
        switch self {
        case .music:   return "music.note"
        case .stage:   return "theatermasks"
        case .culture: return "building.columns"
        case .sport:   return "sportscourt"
        case .food:    return "fork.knife"
        case .outdoor: return "mountain.2"
        }
    }

    var style: CatStyle {
        switch self {
        case .music:   return CatStyle(dark: 0x7BA8D8, light: 0x2F6FB0)
        case .stage:   return CatStyle(dark: 0xD3A45F, light: 0x9A6420)
        case .culture: return CatStyle(dark: 0x97A6B6, light: 0x4A5A6B)
        case .sport:   return CatStyle(dark: 0x6FBE8C, light: 0x2C6E49)
        case .food:    return CatStyle(dark: 0xDC8A66, light: 0xA5492A)
        case .outdoor: return CatStyle(dark: 0x68B8AC, light: 0x2D6E66)
        }
    }
}

enum Categories {
    /// Used for "Things to do", the feed's generic bucket, and for any wording
    /// the canonicaliser has not seen yet. A neutral slate rather than a hue,
    /// so an uncategorised listing never borrows a family's meaning.
    static let fallback = CatStyle(dark: 0x9AA0A6, light: 0x5F6165)

    /// The canonical vocabulary the API emits, folded onto the six families.
    /// api/sources/util.js spells these, so a listing arrives here already
    /// spelled the way this table spells it. Keys are lowercased because
    /// `family(_:)` lowercases what it is given.
    ///
    /// "Family" folds to culture rather than getting its own hue: family
    /// listings in the corpus are overwhelmingly museums, libraries and
    /// community activities, which is what culture already is.
    static let families: [String: Family] = [
        "music": .music, "live music": .music, "clubs": .music,
        "festivals": .music,
        "comedy": .stage, "theatre": .stage, "film": .stage,
        "museums": .culture, "family": .culture,
        "football": .sport, "sport": .sport,
        "markets": .food, "food": .food,
        "outdoors": .outdoor,
    ]

    /// Nil for "Things to do" and anything unrecognised, which is the signal to
    /// use `fallback` and show no family name at all rather than inventing one.
    static func family(_ category: String) -> Family? {
        families[category.lowercased()]
    }

    static func style(_ category: String) -> CatStyle {
        family(category)?.style ?? fallback
    }
    static func wash(_ category: String) -> Color {
        style(category).wash
    }
    /// The family name for the card footer, or the category itself when it
    /// belongs to no family, so the footer is never blank.
    static func label(_ category: String) -> String {
        family(category)?.label ?? category
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
    /// cannot render emoji.
    ///
    /// The family carries the symbol now, so a category that folds to a family
    /// simply borrows it and the six stay visually consistent with their rules
    /// and pins. The tolerant chain below is only for wording the canonicaliser
    /// has not folded yet: a source can always invent a new word, and a loose
    /// glyph is better than a missing one.
    static func symbol(_ category: String) -> String {
        if let f = family(category) { return f.symbol }

        let c = category.lowercased()
        // Ordered so the narrower word wins: "club night" must not be caught by
        // the music test, and "football" must not be caught by the general
        // sport one.
        if c.contains("club") || c.contains("night") || c.contains("rave") { return Family.music.symbol }
        if c.contains("festival") || c.contains("carnival") { return Family.music.symbol }
        if c.contains("comedy") || c.contains("stand-up") || c.contains("standup") { return Family.stage.symbol }
        if c.contains("football") || c.contains("soccer") { return "soccerball" }
        if c.contains("sport") || c.contains("rugby") || c.contains("cricket")
            || c.contains("racing") || c.contains("match") || c.contains("fixture") { return Family.sport.symbol }
        if c.contains("music") || c.contains("concert") || c.contains("gig") { return Family.music.symbol }
        if c.contains("market") || c.contains("pop-up") || c.contains("popup") { return "bag" }
        if c.contains("museum") || c.contains("exhibit") || c.contains("gallery")
            || c.contains("heritage") { return Family.culture.symbol }
        if c.contains("theat") || c.contains("art") { return Family.stage.symbol }
        if c.contains("film") || c.contains("cinema") || c.contains("screening") { return "film" }
        if c.contains("food") || c.contains("drink") { return Family.food.symbol }
        if c.contains("family") || c.contains("kid") || c.contains("child") { return Family.culture.symbol }
        if c.contains("walk") || c.contains("outdoor") || c.contains("garden")
            || c.contains("park") || c.contains("swim") { return Family.outdoor.symbol }
        if c.contains("tour") { return Family.culture.symbol }
        if c.contains("free") { return "ticket" }
        return "sparkles"
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
}
