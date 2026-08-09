// Generates an AppIcon variant (1024x1024 PNG, opaque/no-alpha) from the same
// logo geometry used in-app. App Store icons must not have transparency.
//
// Run on a Mac:
//   swift tools/make_icon.swift <output.png> [light|dark|tinted]
//
// The three variants iOS 18 asks for:
//   light   white logo on the accent-fill tile (the default icon)
//   dark    the same logo on the dark theme's accent-fill
//   tinted  greyscale, so iOS can recolour it with the user's chosen tint
//
// The committed PNGs were produced by tools/make_icon.js, which draws the same
// geometry and runs anywhere Node does. This script is here so the icon can be
// regenerated from Swift on a Mac instead.
import AppKit
import CoreGraphics
import UniformTypeIdentifiers

let out = CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : "Pulse/Assets.xcassets/AppIcon.appiconset/icon_1024.png"
let variant = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "light"

// Canvas and logo colours per variant. An accent-fill tile with the mark
// knocked out in white, flat, no gradient and no shadow. Each variant uses its
// own theme's accent-fill, so the light tile is Pantone 186 and the dark one is
// the lifted red the dark interface uses behind white.
let (bg, fg): ((Double, Double, Double), (Double, Double, Double)) = {
    switch variant {
    case "dark":   return ((0xC8 / 255, 0x32 / 255, 0x4A / 255), (1.0, 1.0, 1.0))
    case "tinted": return ((0.0, 0.0, 0.0), (0xD8 / 255, 0xD8 / 255, 0xD8 / 255))
    default:       return ((0xC8 / 255, 0x10 / 255, 0x2E / 255), (1.0, 1.0, 1.0))
    }
}()

let size = 1024
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
// noneSkipLast gives 32-bit RGB with the alpha byte ignored, so the PNG comes
// out opaque with no alpha channel.
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                    bytesPerRow: 0, space: cs,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!

ctx.setFillColor(CGColor(srgbRed: bg.0, green: bg.1, blue: bg.2, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))

// CoreGraphics is y-up; flip so the logo geometry (y-down) draws upright.
ctx.translateBy(x: 0, y: CGFloat(size)); ctx.scaleBy(x: 1, y: -1)

// The logo lives on a 24x24 grid, centred, sized to 62% of the canvas so it
// clears the home-screen mask's rounded corners.
let s: CGFloat = CGFloat(size) * 0.62 / 24
let cx = CGFloat(size) / 2, cy = CGFloat(size) / 2
func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
    CGPoint(x: cx + (x - 12) * s, y: cy + (y - 12) * s)
}

// Reference geometry, matching PulseLogoGeometry in Design/Theme.swift.
// "Proximity": a filled dot with two rising arcs above it.
//
//   dot     centre (12, 17) radius 2.6, filled
//   arc 1   (7.6, 12.6) to (16.4, 12.6)  on radius 6.2
//   arc 2   (4.2, 8.9)  to (19.8, 8.9)   on radius 11
//   both arcs stroked at 2.1 with round caps
struct LogoArc {
    let centre: CGPoint
    let radius: CGFloat
    let start: CGFloat
    let end: CGFloat
}

/// The minor arc of `radius` running from `from` to `to` and bulging upward,
/// which is how the handoff's two SVG arc commands resolve. Both chords here
/// are horizontal, so the centre sits directly below the chord's midpoint.
/// Angles come back in radians, normalised to 0 up to 2 pi, in the same y-down
/// space the rest of this file works in.
func makeArc(_ from: CGPoint, _ to: CGPoint, _ radius: CGFloat) -> LogoArc {
    let dx = to.x - from.x
    let dy = to.y - from.y
    let half = ((dx * dx + dy * dy) / 4).squareRoot()
    let drop = (radius * radius - half * half).squareRoot()
    let c = CGPoint(x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + drop)
    func ang(_ q: CGPoint) -> CGFloat {
        let a = atan2(Double(q.y - c.y), Double(q.x - c.x))
        return CGFloat(a < 0 ? a + 2 * Double.pi : a)
    }
    return LogoArc(centre: c, radius: radius, start: ang(from), end: ang(to))
}

let arcs = [
    makeArc(CGPoint(x: 7.6, y: 12.6), CGPoint(x: 16.4, y: 12.6), 6.2),
    makeArc(CGPoint(x: 4.2, y: 8.9), CGPoint(x: 19.8, y: 8.9), 11),
]

let fgColor = CGColor(srgbRed: fg.0, green: fg.1, blue: fg.2, alpha: 1)

// The dot.
let dot = p(12, 17)
let dotR: CGFloat = 2.6 * s
ctx.setFillColor(fgColor)
ctx.fillEllipse(in: CGRect(x: dot.x - dotR, y: dot.y - dotR,
                           width: 2 * dotR, height: 2 * dotR))

// The two arcs, stroked rather than outlined: CoreGraphics does the round caps
// and the constant width, so there is nothing here to get wrong by hand.
ctx.setStrokeColor(fgColor)
ctx.setLineWidth(2.1 * s)
ctx.setLineCap(.round)
for arc in arcs {
    let path = CGMutablePath()
    // Swept over the top. In this flipped context that is the direction
    // CoreGraphics calls clockwise: false, the same convention the pin used.
    path.addArc(center: p(arc.centre.x, arc.centre.y), radius: arc.radius * s,
                startAngle: arc.start, endAngle: arc.end, clockwise: false)
    ctx.addPath(path)
    ctx.strokePath()
}

guard let cg = ctx.makeImage() else { FileHandle.standardError.write("makeImage failed\n".data(using: .utf8)!); exit(1) }
let url = URL(fileURLWithPath: out)
guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    FileHandle.standardError.write("dest failed\n".data(using: .utf8)!); exit(1)
}
CGImageDestinationAddImage(dest, cg, nil)
CGImageDestinationFinalize(dest)
print("wrote \(out) (\(variant))")
