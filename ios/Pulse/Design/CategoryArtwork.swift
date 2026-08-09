import SwiftUI

/// A designed stand in for an event that has no photograph.
///
/// Not every source carries images. PredictHQ has none at all, the venue guide
/// has none, and Ticketmaster's occasionally fail to load. Those events used to
/// drop to a bare 4pt colour spine with no thumbnail, which left them visibly
/// poorer than the rows either side and made a full feed look broken.
///
/// Each category gets its own composition rather than a scaled up icon,
/// because a column of identical music notes still reads as missing data. The
/// motif carries the tile and the category mark sits in the corner to name it.
/// Flat shapes only: the palette has no gradients anywhere and this is no
/// exception.
///
/// Layout is deterministic in `seed`, so a given event keeps the same artwork
/// between redraws and between launches instead of reshuffling as you scroll.
struct CategoryArtwork: View {
    let category: String
    /// Any stable value for this event. The card passes the event id.
    var seed: Int = 0

    private var tint: Color { Categories.style(category).color }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                Categories.wash(category)
                motif(w, h)
                // Bottom leading, small. The mark identifies the category; the
                // motif is what makes the tile look composed rather than empty.
                CategoryGlyph(category: category, size: w * 0.23)
                    .frame(width: w, height: h, alignment: .bottomLeading)
                    .padding(.leading, w * 0.09)
                    .padding(.bottom, h * 0.09)
            }
            .frame(width: w, height: h)
            .clipped()
        }
        .accessibilityHidden(true)
    }

    // MARK: Motif selection

    /// Several categories share a motif on purpose. Football and Sport are the
    /// same idea, and Music and Live music are already one hue, so giving them
    /// separate artwork would invent a distinction the palette does not make.
    private enum Motif {
        case bars, rings, bunting, bubble, pitch, stripes
        case arches, curtain, sprockets, plate, confetti, tiles
    }

    private static func motif(for category: String) -> Motif {
        switch category.lowercased() {
        case "music", "live music": return .bars
        case "clubs":               return .rings
        case "festivals":           return .bunting
        case "comedy":              return .bubble
        case "football", "sport":   return .pitch
        case "markets":             return .stripes
        case "museums":             return .arches
        case "theatre":             return .curtain
        case "film":                return .sprockets
        case "food":                return .plate
        case "family":              return .confetti
        default:                    return .tiles
        }
    }

    @ViewBuilder
    private func motif(_ w: CGFloat, _ h: CGFloat) -> some View {
        switch Self.motif(for: category) {
        case .bars:      bars(w, h)
        case .rings:     rings(w, h)
        case .bunting:   bunting(w, h)
        case .bubble:    bubble(w, h)
        case .pitch:     pitch(w, h)
        case .stripes:   stripes(w, h)
        case .arches:    arches(w, h)
        case .curtain:   curtain(w, h)
        case .sprockets: sprockets(w, h)
        case .plate:     plate(w, h)
        case .confetti:  confetti(w, h)
        case .tiles:     tiles(w, h)
        }
    }

    // MARK: Motifs

    /// Music. An equaliser, with the bar heights varying per event so two music
    /// listings next to each other are not the same picture twice.
    private func bars(_ w: CGFloat, _ h: CGFloat) -> some View {
        var rng = Seeded(seed)
        let heights = (0..<7).map { _ in rng.between(0.26, 0.84) }
        let gap = w * 0.045
        let barWidth = (w - gap * 8) / 7
        return HStack(alignment: .bottom, spacing: gap) {
            ForEach(0..<7, id: \.self) { i in
                Capsule()
                    .fill(tint.opacity(0.26 + 0.18 * heights[i]))
                    .frame(width: barWidth, height: h * CGFloat(heights[i]))
            }
        }
        .padding(.horizontal, gap)
        .frame(width: w, height: h, alignment: .bottom)
    }

    /// Clubs. Concentric rings, a strobe seen head on.
    private func rings(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            ForEach(0..<4, id: \.self) { i in
                Circle()
                    .stroke(tint.opacity(0.40 - Double(i) * 0.07), lineWidth: w * 0.045)
                    .frame(width: w * (0.28 + CGFloat(i) * 0.26))
            }
        }
        .frame(width: w, height: h)
    }

    /// Festivals. Bunting across the top edge.
    private func bunting(_ w: CGFloat, _ h: CGFloat) -> some View {
        var rng = Seeded(seed)
        let shades = (0..<5).map { _ in rng.between(0.22, 0.46) }
        return VStack(spacing: 0) {
            HStack(spacing: w * 0.025) {
                ForEach(0..<5, id: \.self) { i in
                    Wedge()
                        .fill(tint.opacity(shades[i]))
                        .frame(width: w * 0.15, height: h * 0.32)
                }
            }
            .padding(.top, h * 0.12)
            Spacer(minLength: 0)
        }
        .frame(width: w, height: h)
    }

    /// Comedy. A speech bubble, offset so it reads as a pair.
    private func bubble(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: w * 0.14)
                .stroke(tint.opacity(0.20), lineWidth: w * 0.035)
                .frame(width: w * 0.52, height: h * 0.36)
                .offset(x: w * 0.10, y: h * 0.14)
            RoundedRectangle(cornerRadius: w * 0.14)
                .stroke(tint.opacity(0.40), lineWidth: w * 0.04)
                .frame(width: w * 0.56, height: h * 0.38)
                .offset(x: -w * 0.06, y: -h * 0.10)
        }
        .frame(width: w, height: h)
    }

    /// Football and Sport. A centre circle and halfway line, the markings you
    /// recognise from directly above a pitch.
    private func pitch(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            Rectangle()
                .fill(tint.opacity(0.26))
                .frame(width: w, height: w * 0.028)
            Circle()
                .stroke(tint.opacity(0.36), lineWidth: w * 0.035)
                .frame(width: w * 0.36)
            RoundedRectangle(cornerRadius: w * 0.02)
                .stroke(tint.opacity(0.24), lineWidth: w * 0.03)
                .frame(width: w * 0.44, height: h * 0.22)
                .offset(y: -h * 0.40)
        }
        .frame(width: w, height: h)
    }

    /// Markets. An awning, in the alternating stripe every market stall uses.
    private func stripes(_ w: CGFloat, _ h: CGFloat) -> some View {
        HStack(spacing: 0) {
            ForEach(0..<6, id: \.self) { i in
                Rectangle()
                    .fill(tint.opacity(i % 2 == 0 ? 0.30 : 0.13))
            }
        }
        .frame(width: w, height: h)
    }

    /// Museums. Columns whose rounded tops read as an arcade. The capsules run
    /// past the bottom edge and are clipped, so they sit on the floor of the
    /// tile rather than floating in it.
    private func arches(_ w: CGFloat, _ h: CGFloat) -> some View {
        HStack(spacing: w * 0.06) {
            ForEach(0..<3, id: \.self) { i in
                Capsule()
                    .fill(tint.opacity(i == 1 ? 0.34 : 0.24))
                    .frame(width: w * 0.19, height: h * 0.74)
            }
        }
        .frame(width: w, height: h, alignment: .bottom)
        .offset(y: h * 0.14)
    }

    /// Theatre. Two drapes and the swag between them.
    private func curtain(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            HStack(spacing: 0) {
                Rectangle().fill(tint.opacity(0.28)).frame(width: w * 0.20)
                Spacer(minLength: 0)
                Rectangle().fill(tint.opacity(0.28)).frame(width: w * 0.20)
            }
            Swag()
                .stroke(tint.opacity(0.40), lineWidth: w * 0.045)
                .frame(width: w * 0.86, height: h * 0.30)
                .offset(y: -h * 0.24)
        }
        .frame(width: w, height: h)
    }

    /// Film. Sprocket holes down both edges, a frame of 35mm.
    private func sprockets(_ w: CGFloat, _ h: CGFloat) -> some View {
        HStack(spacing: 0) {
            sprocketColumn(w, h)
            Spacer(minLength: 0)
            sprocketColumn(w, h)
        }
        .frame(width: w, height: h)
    }

    private func sprocketColumn(_ w: CGFloat, _ h: CGFloat) -> some View {
        VStack(spacing: h * 0.055) {
            ForEach(0..<4, id: \.self) { _ in
                RoundedRectangle(cornerRadius: w * 0.025)
                    .fill(tint.opacity(0.32))
                    .frame(width: w * 0.11, height: h * 0.13)
            }
        }
        .padding(.horizontal, w * 0.055)
    }

    /// Food. A plate seen from above.
    private func plate(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            Circle()
                .stroke(tint.opacity(0.34), lineWidth: w * 0.045)
                .frame(width: w * 0.62)
            Circle()
                .stroke(tint.opacity(0.20), lineWidth: w * 0.03)
                .frame(width: w * 0.40)
        }
        .frame(width: w, height: h)
    }

    /// Family. Scattered confetti, the one motif where the per event variation
    /// is the whole point.
    private func confetti(_ w: CGFloat, _ h: CGFloat) -> some View {
        var rng = Seeded(seed)
        let dots = (0..<14).map { _ in
            (x: rng.between(0.08, 0.92),
             y: rng.between(0.08, 0.92),
             d: rng.between(0.05, 0.13),
             o: rng.between(0.20, 0.46))
        }
        return ZStack {
            ForEach(0..<14, id: \.self) { i in
                Circle()
                    .fill(tint.opacity(dots[i].o))
                    .frame(width: w * CGFloat(dots[i].d))
                    .position(x: w * CGFloat(dots[i].x), y: h * CGFloat(dots[i].y))
            }
        }
        .frame(width: w, height: h)
    }

    /// Anything uncategorised. A diagonal run of tiles: clearly deliberate,
    /// deliberately meaning nothing, so it never borrows another category's
    /// symbolism for a listing we could not place.
    private func tiles(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            ForEach(0..<5, id: \.self) { i in
                RoundedRectangle(cornerRadius: w * 0.03)
                    .fill(tint.opacity(0.14 + 0.05 * Double(i)))
                    .frame(width: w * 0.19, height: w * 0.19)
                    .rotationEffect(.degrees(45))
                    .position(x: w * (0.15 + 0.175 * CGFloat(i)),
                              y: h * (0.76 - 0.13 * CGFloat(i)))
            }
        }
        .frame(width: w, height: h)
    }
}

// MARK: Shapes

/// A bunting flag: flat along the top, point at the bottom.
private struct Wedge: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
        p.addLine(to: CGPoint(x: r.midX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

/// The dip of a curtain swag. Stroked, never filled.
private struct Swag: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addQuadCurve(to: CGPoint(x: r.maxX, y: r.minY),
                       control: CGPoint(x: r.midX, y: r.maxY * 1.6))
        return p
    }
}

// MARK: Determinism

/// A tiny linear congruential generator. This exists only so a card's artwork
/// is stable: seeded from the event id, it gives the same layout every time
/// that event is drawn. It is not suitable for anything that needs real
/// randomness, and nothing here needs that.
private struct Seeded {
    private var state: UInt64

    init(_ seed: Int) {
        // Mix the seed first. Raw event ids are often sequential, and an LCG
        // fed consecutive values produces visibly similar first outputs.
        state = UInt64(bitPattern: Int64(seed)) &* 6364136223846793005 &+ 1442695040888963407
        state ^= state >> 33
    }

    private mutating func next() -> Double {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return Double((state >> 34) & 0x3FFFFF) / Double(0x3FFFFF)
    }

    mutating func between(_ lo: Double, _ hi: Double) -> Double {
        lo + (hi - lo) * next()
    }
}
