// Generates an AppIcon variant (1024×1024 PNG, opaque/no-alpha) from the same
// logo geometry used in-app. App Store icons must not have transparency.
//
// Run on a Mac:
//   swift tools/make_icon.swift <output.png> [light|dark|tinted]
//
// The three variants iOS 18 asks for:
//   light   white logo on the flag-blue tile (the default icon)
//   dark    the same logo on a deeper navy, for the dark home screen
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

// Canvas and logo colours per variant. Flag blue tile, white logo.
let (bg, fg): ((Double, Double, Double), (Double, Double, Double)) = {
    switch variant {
    case "dark":   return ((0x00 / 255, 0x14 / 255, 0x40 / 255), (1.0, 1.0, 1.0))
    case "tinted": return ((0.0, 0.0, 0.0), (0xD8 / 255, 0xD8 / 255, 0xD8 / 255))
    default:       return ((0x01 / 255, 0x21 / 255, 0x69 / 255), (1.0, 1.0, 1.0))
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
let head = p(12, 8.8), headR: CGFloat = 5.6 * s
let point = p(12, 20.8)
let counterR: CGFloat = 2.4 * s

let path = CGMutablePath()
// Head, entered at the left tangent point and swept over the top to the right
// one. In this flipped context that is the direction CoreGraphics calls
// clockwise: false.
path.addArc(center: head, radius: headR,
            startAngle: 152.18 * .pi / 180, endAngle: 387.82 * .pi / 180,
            clockwise: false)
// Closing back to the arc's start point draws the two tail edges. Those edges
// are tangent to the head at (7.047, 11.413) and (16.953, 11.413), which is
// what keeps the join smooth instead of kinked.
path.addLine(to: point)
path.closeSubpath()
// Counter, knocked out by the even-odd rule.
path.addEllipse(in: CGRect(x: head.x - counterR, y: head.y - counterR,
                           width: 2 * counterR, height: 2 * counterR))

ctx.setFillColor(CGColor(srgbRed: fg.0, green: fg.1, blue: fg.2, alpha: 1))
ctx.addPath(path)
ctx.fillPath(using: .evenOdd)

guard let cg = ctx.makeImage() else { FileHandle.standardError.write("makeImage failed\n".data(using: .utf8)!); exit(1) }
let url = URL(fileURLWithPath: out)
guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    FileHandle.standardError.write("dest failed\n".data(using: .utf8)!); exit(1)
}
CGImageDestinationAddImage(dest, cg, nil)
CGImageDestinationFinalize(dest)
print("wrote \(out) (\(variant))")
