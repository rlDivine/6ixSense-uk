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
// "Beacon": a map pin with a pulse trace knocked out of it as a counter.
//
// One filled path with a hole, so this is filled even-odd rather than stroked.
// The arcs are given as centre and angles because that is what CGPath wants;
// they are the handoff's endpoint arcs converted, and the conversion was
// checked by rendering both forms and comparing pixels.
let headCentre = CGPoint(x: 12, y: 10)
let headRadius: CGFloat = 8.2
let tipRadius: CGFloat = 1.1
let tipHalfChord: CGFloat = 0.7
let tipChordY: CGFloat = 22.3
let tipCentre = CGPoint(
    x: 12,
    y: tipChordY - (tipRadius * tipRadius - tipHalfChord * tipHalfChord).squareRoot()
)

/// Degrees to radians in the y-down space the rest of this file works in.
func rad(_ d: Double) -> CGFloat { CGFloat(d * Double.pi / 180) }

/// Polar angle of `q` about `c`, in radians.
func ang(_ q: CGPoint, _ c: CGPoint) -> CGFloat {
    CGFloat(atan2(Double(q.y - c.y), Double(q.x - c.x)))
}

/// The pulse trace, as the closed outline of a stroke so it can be a hole.
let trace: [CGPoint] = [
    CGPoint(x: 7,    y: 10.7), CGPoint(x: 9.6,  y: 10.7), CGPoint(x: 11,   y: 7.3),
    CGPoint(x: 13.1, y: 12.9), CGPoint(x: 14.3, y: 10.2), CGPoint(x: 17.1, y: 10.2),
    CGPoint(x: 17.1, y: 8.8),  CGPoint(x: 13,   y: 8.8),  CGPoint(x: 12.3, y: 10.3),
    CGPoint(x: 10.2, y: 4.8),  CGPoint(x: 7.8,  y: 10.5), CGPoint(x: 7,    y: 10.5),
]

let fgColor = CGColor(srgbRed: fg.0, green: fg.1, blue: fg.2, alpha: 1)

let mark = CGMutablePath()
// Every sweep runs in the direction of decreasing angle, which in this y-down
// space is anticlockwise on screen. CoreGraphics calls that clockwise: true
// here, the same convention Theme.swift documents.
mark.move(to: p(12, 1.8))
mark.addArc(center: p(headCentre.x, headCentre.y), radius: headRadius * s,
            startAngle: rad(270), endAngle: rad(180), clockwise: true)
mark.addCurve(to: p(11.3, 22.3), control1: p(3.8, 15.9), control2: p(11, 22))
mark.addArc(center: p(tipCentre.x, tipCentre.y), radius: tipRadius * s,
            startAngle: ang(CGPoint(x: 12 - tipHalfChord, y: tipChordY), tipCentre),
            endAngle: ang(CGPoint(x: 12 + tipHalfChord, y: tipChordY), tipCentre),
            clockwise: true)
mark.addCurve(to: p(20.2, 10), control1: p(13, 22), control2: p(20.2, 15.9))
mark.addArc(center: p(headCentre.x, headCentre.y), radius: headRadius * s,
            startAngle: rad(0), endAngle: rad(-90), clockwise: true)
mark.closeSubpath()

mark.move(to: p(trace[0].x, trace[0].y))
for point in trace.dropFirst() { mark.addLine(to: p(point.x, point.y)) }
mark.closeSubpath()

ctx.setFillColor(fgColor)
ctx.addPath(mark)
ctx.fillPath(using: .evenOdd)

guard let cg = ctx.makeImage() else { FileHandle.standardError.write("makeImage failed\n".data(using: .utf8)!); exit(1) }
let url = URL(fileURLWithPath: out)
guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    FileHandle.standardError.write("dest failed\n".data(using: .utf8)!); exit(1)
}
CGImageDestinationAddImage(dest, cg, nil)
CGImageDestinationFinalize(dest)
print("wrote \(out) (\(variant))")
