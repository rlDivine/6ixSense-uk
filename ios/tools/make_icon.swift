// Generates an AppIcon variant (1024×1024 PNG, opaque/no-alpha) from the same
// PulseMark geometry used in-app. App Store icons must not have transparency.
//
// Run on a Mac:
//   swift tools/make_icon.swift <output.png> [light|dark|tinted]
//
// The three variants iOS 18 asks for:
//   light   — brand red on the dark canvas (the default icon)
//   dark    — the same mark, deeper canvas, for the dark home screen
//   tinted  — greyscale, so iOS can recolour it with the user's chosen tint
//
// The committed PNGs were produced by tools/make_icon.js, a byte-for-byte
// equivalent that runs anywhere Node does. Either script gives the same icon;
// this one is here so the mark can be regenerated from Swift on a Mac.
import AppKit
import CoreGraphics
import UniformTypeIdentifiers

let out = CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : "Pulse/Assets.xcassets/AppIcon.appiconset/icon_1024.png"
let variant = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "light"

// Canvas and mark colours per variant.
let (bg, fg): ((Double, Double, Double), (Double, Double, Double)) = {
    switch variant {
    case "dark":   return ((0x0A / 255, 0x0C / 255, 0x11 / 255), (0xFF / 255, 0x62 / 255, 0x51 / 255))
    case "tinted": return ((0x00 / 255, 0x00 / 255, 0x00 / 255), (0xD8 / 255, 0xD8 / 255, 0xD8 / 255))
    default:       return ((0x14 / 255, 0x16 / 255, 0x1E / 255), (0xFF / 255, 0x62 / 255, 0x51 / 255))
    }
}()

let size = 1024
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
// noneSkipLast → 32-bit RGB with the alpha byte ignored → opaque PNG, no alpha channel.
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                    bytesPerRow: 0, space: cs,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!

ctx.setFillColor(CGColor(srgbRed: bg.0, green: bg.1, blue: bg.2, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))

// CoreGraphics is y-up; flip so the mark geometry (y-down) draws upright.
ctx.translateBy(x: 0, y: CGFloat(size)); ctx.scaleBy(x: 1, y: -1)

// The mark lives on a 24×24 grid, centred, sized to ~62% of the canvas so it
// clears the home-screen mask's rounded corners.
let s: CGFloat = CGFloat(size) * 0.62 / 24
let cx = CGFloat(size) / 2, cy = CGFloat(size) / 2
func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
    CGPoint(x: cx + (x - 12) * s, y: cy + (y - 12) * s)
}
func circle(_ r: CGFloat) -> CGRect {
    CGRect(x: cx - r * s, y: cy - r * s, width: 2 * r * s, height: 2 * r * s)
}

ctx.setFillColor(CGColor(srgbRed: fg.0, green: fg.1, blue: fg.2, alpha: 1))
ctx.setStrokeColor(CGColor(srgbRed: fg.0, green: fg.1, blue: fg.2, alpha: 1))

// Ring: stroke the midline rather than filling two circles, which is the same
// shape and avoids depending on an even-odd fill rule.
let ringMid = (11.0 + 8.6) / 2
ctx.setLineWidth((11.0 - 8.6) * s)
ctx.strokeEllipse(in: circle(ringMid))

// Pulse trace: flat, up, down, flat.
ctx.setLineWidth(1.7 * s)
ctx.setLineCap(.round)
ctx.setLineJoin(.round)
ctx.move(to: p(6.0, 12.0))
ctx.addLine(to: p(9.0, 12.0))
ctx.addLine(to: p(10.7, 7.8))
ctx.addLine(to: p(13.3, 16.2))
ctx.addLine(to: p(15.0, 12.0))
ctx.addLine(to: p(18.0, 12.0))
ctx.strokePath()

guard let cg = ctx.makeImage() else { FileHandle.standardError.write("makeImage failed\n".data(using: .utf8)!); exit(1) }
let url = URL(fileURLWithPath: out)
guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    FileHandle.standardError.write("dest failed\n".data(using: .utf8)!); exit(1)
}
CGImageDestinationAddImage(dest, cg, nil)
CGImageDestinationFinalize(dest)
print("wrote \(out) (\(variant))")
