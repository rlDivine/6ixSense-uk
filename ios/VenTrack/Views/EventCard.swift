import SwiftUI

/// Which treatment to draw. One hierarchy, three densities.
enum EventCardStyle {
    /// The workhorse. Thumbnail, text, distance column. Feed, Saved, Search.
    case row
    /// One per screen, at the top of the feed, where the photograph gets to do
    /// the work. Used more than once per screen it undoes the calm and the feed
    /// becomes a carousel of posters.
    case feature
    /// No thumbnail at all. The map tray, where a thumbnail column would crush
    /// the text, and any event with no usable image, where this is more honest
    /// than a placeholder square.
    case compact
}

/// The most used component in the app, and per the overhaul brief, the screen.
///
/// Three rules hold across all three treatments, and they are what make a feed
/// scannable rather than a wall of equal slabs:
///
///   THE TITLE DOMINATES. 20pt semibold against a 15pt venue and an 11pt
///   footer. Density inside a card used to be uniform, which gave an event's
///   title no more weight than its price.
///
///   THE TWO RANKING AXES HOLD FIXED POSITIONS. Time is always the overline,
///   top left. Distance is always the right hand column, in tabular figures
///   with its unit beneath. A column of rows therefore scans vertically for
///   both axes without reading a single word.
///
///   TODAY IS THE ONLY THING THAT TURNS RED. The overline takes `accent` when
///   the event is on today or tomorrow and `faint` otherwise. It is the highest
///   value single use of colour in the app, and it only works because nothing
///   else competes for it.
///
/// Each card is its own box: `panel` fill, an 18pt radius and a hairline, with
/// a gap to the next one. The overhaul removed all of that in favour of rows on
/// a flat ground, and on a real feed it did not hold up: twenty rows with
/// nothing around them read as one continuous block rather than twenty things
/// to choose between. The type hierarchy above is what that change was really
/// buying, and it survives boxing them.
struct EventCard: View {
    let event: Event
    var style: EventCardStyle = .row
    /// Set when the card sits in a horizontal tray rather than a vertical feed.
    /// Two things follow from that, and both are the same requirement of fitting
    /// a row of cards side by side:
    ///
    ///   the screen gutter is the TRAY'S, not the card's, or neighbours end up
    ///   with a fat gap between them;
    ///   the title reserves both its lines whether or not it needs them, so a
    ///   one-line title and a two-line title do not leave the row with ragged
    ///   bottoms. In a vertical feed the same reservation would just be dead
    ///   space, which is why this is not the default.
    var tray: Bool = false

    @EnvironmentObject var app: AppState
    @Environment(\.dynamicTypeSize) private var typeSize

    private var family: Family? { Categories.family(event.category) }
    private var catColor: Color { Categories.style(event.category).color }

    /// An event with no usable photo draws as compact rather than as a row with
    /// a tinted placeholder square. The extra title width carries more than the
    /// square does.
    private var effectiveStyle: EventCardStyle {
        if style == .row, event.imageURL == nil { return .compact }
        return style
    }

    var body: some View {
        // The bookmark is a sibling laid over the card, never a third column.
        // Giving it a column of its own would put it in direct competition with
        // the distance figure, which is one of the two things the whole app
        // ranks on.
        content
            // Cards sit in their OWN box again.
            //
            // The overhaul put feed rows straight onto `bg` separated by a
            // single hairline, on the argument that whitespace and weight
            // should do the work borders were doing. On a real feed on a real
            // phone that argument loses: twenty rows with nothing around them
            // read as one continuous block of text rather than twenty things
            // you can choose between, and the eye has nowhere to rest.
            //
            // `panel` is only a shade off `bg` in either theme, so the fill
            // alone is not enough to say "separate object" and the hairline
            // does the actual work. Both together, and it reads as a card.
            .background(Tok.panel, in: RoundedRectangle(cornerRadius: R.card))
            .overlay(RoundedRectangle(cornerRadius: R.card)
                .stroke(Tok.hairline, lineWidth: 1))
            // The screen gutter lives here rather than on the feed, so the
            // section header and the gate keep their own alignment. A card in
            // a horizontal tray opts out: there the gutter is the tray's.
            .padding(.horizontal, tray ? 0 : S.s5)
    }

    @ViewBuilder private var content: some View {
        switch effectiveStyle {
        case .row:     rowBody
        case .feature: featureBody
        case .compact: compactBody
        }
    }

    // MARK: 5a. Row

    private var rowBody: some View {
        HStack(alignment: .top, spacing: S.s3) {
            thumb
            VStack(alignment: .leading, spacing: S.s1) {
                overline
                title
                venue
                footer.padding(.top, S.s1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            rightColumn
        }
        .padding(.leading, S.s4)
        .padding(.trailing, S.s2)
        .padding(.vertical, S.s4)
    }

    private var thumb: some View {
        ZStack {
            CategoryArtwork(category: event.category, seed: event.id.hashValue)
            // The photo sits on top of the artwork, so a URL that fails to load
            // leaves the composition showing rather than a blank square.
            if let url = event.imageURL {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        Color.clear
                    }
                }
            }
        }
        .frame(width: 68, height: 68)
        .clipShape(RoundedRectangle(cornerRadius: R.thumb))
        .accessibilityHidden(true)
    }

    // MARK: 5b. Feature

    private var featureBody: some View {
        VStack(alignment: .leading, spacing: S.s3) {
            featureImage
            HStack(alignment: .top, spacing: S.s3) {
                VStack(alignment: .leading, spacing: S.s1) {
                    overline
                    Text(event.title)
                        .font(.system(size: 22, weight: .semibold))
                        .kerning(-0.5)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .foregroundStyle(Tok.text)
                    venue
                    footer.padding(.top, S.s1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                distanceColumn
            }
            .padding(.trailing, S.s4)
        }
        .padding(.leading, S.s4)
        .padding(.vertical, S.s4)
    }

    private var featureImage: some View {
        ZStack {
            CategoryArtwork(category: event.category, seed: event.id.hashValue)
            if let url = event.imageURL {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        Color.clear
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 172)
        // One step in from the card's own 18, so a rounded rectangle inside a
        // rounded rectangle looks nested rather than accidentally concentric.
        .clipShape(RoundedRectangle(cornerRadius: R.well))
        // The family mark, in the corner of the photograph rather than as a
        // wash across it. A wash over a photo is a tint over someone else's
        // picture; a rule is a mark of our own.
        .overlay(alignment: .bottomLeading) {
            if family != nil {
                Rectangle()
                    .fill(catColor)
                    .frame(width: 44, height: 4)
                    .padding(.leading, S.s4)
            }
        }
        // Hidden BEFORE the bookmark goes on, not after. Applied to the whole
        // composition it would take the bookmark out of the accessibility tree
        // with it, and the one control on the feature card would become
        // unreachable by VoiceOver.
        .accessibilityHidden(true)
        // On the feature the bookmark sits on the photograph itself, which is
        // where there is room for it and where the eye already is.
        .overlay(alignment: .topTrailing) { bookmark }
        .padding(.trailing, S.s4)
    }

    // MARK: 5c. Compact

    private var compactBody: some View {
        HStack(alignment: .top, spacing: S.s3) {
            VStack(alignment: .leading, spacing: S.s1) {
                HStack(spacing: S.s2) {
                    familyRule
                    overlineText
                }
                title
                Text(compactMeta)
                    .font(F.callout)
                    .foregroundStyle(Tok.muted)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            compactDistance
        }
        .padding(.horizontal, S.s4)
        .padding(.vertical, S.s4)
    }

    /// Venue and price on one line, because a compact row has no footer to put
    /// them in and two short facts read better joined than stacked.
    private var compactMeta: String {
        var parts: [String] = []
        if let v = event.venue, !v.isEmpty { parts.append(v) } else { parts.append(app.placeName) }
        if event.isFree { parts.append("Free") }
        else if let p = event.price, !p.isEmpty { parts.append(p) }
        return parts.joined(separator: " · ")
    }

    // MARK: Shared pieces

    private var title: some View {
        Text(event.title)
            .font(F.headline)
            .kerning(-0.42)
            .lineLimit(2, reservesSpace: tray)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .foregroundStyle(Tok.text)
    }

    private var venue: some View {
        Text(venueText)
            .font(F.callout)
            .foregroundStyle(Tok.muted)
            .lineLimit(1)
    }

    private var venueText: String {
        if let v = event.venue, !v.isEmpty { return v }
        return app.placeName
    }

    private var overline: some View {
        overlineText.lineLimit(1)
    }

    /// The imminence axis. Red only when it is on today or tomorrow.
    private var overlineText: some View {
        let w = Fmt.when(event.startDate)
        return Text(w.text.uppercased())
            .font(F.caption)
            .kerning(0.77)
            .foregroundStyle(w.soon ? Tok.accent : Tok.faint)
    }

    /// A 14x3 rule, not a dot and not a wash. Always accompanied by the family
    /// name in the footer, so colour is never the only carrier of meaning.
    @ViewBuilder private var familyRule: some View {
        if family != nil {
            RoundedRectangle(cornerRadius: 1.5)
                .fill(catColor)
                .frame(width: 14, height: 3)
                .accessibilityHidden(true)
        }
    }

    // MARK: Distance, the second ranking axis
    //
    // A fixed right hand column in both row and feature, so a column of them
    // aligns down the feed and can be compared without reading anything. The
    // figure is monospaced for exactly that reason; the unit sits beneath it in
    // caption case so the number is never crowded.

    /// Distance with the bookmark beneath it. The handoff's rule is that the
    /// bookmark must not become a THIRD column competing with the distance
    /// figure; sharing the right hand column with it is what the design shows,
    /// and it is also the only version that cannot overlap, since the two are
    /// laid out rather than positioned by hand.
    private var rightColumn: some View {
        VStack(alignment: .trailing, spacing: 0) {
            distanceColumn
            bookmark
        }
    }

    private var distanceColumn: some View {
        VStack(alignment: .trailing, spacing: 0) {
            if event.distanceKm != nil {
                Text(Fmt.km(event.distanceKm))
                    .font(F.distance)
                    .foregroundStyle(Tok.text)
                Text(Fmt.distanceUnit.uppercased())
                    .font(F.caption)
                    .kerning(0.77)
                    .foregroundStyle(Tok.faint)
            }
        }
        // Reserves the bookmark's own space beneath, so the two never collide
        // however long the title runs.
        .padding(.top, 2)
        .frame(minWidth: 44, alignment: .trailing)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(event.distanceKm == nil ? "" : "\(Fmt.distance(event.distanceKm)) away")
    }

    /// Compact puts the unit inline: the tray is short and a stacked unit costs
    /// a line that the four visible events need.
    private var compactDistance: some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            if event.distanceKm != nil {
                Text(Fmt.km(event.distanceKm))
                    .font(F.distance)
                    .foregroundStyle(Tok.text)
                Text(Fmt.distanceUnit.uppercased())
                    .font(F.caption)
                    .kerning(0.77)
                    .foregroundStyle(Tok.faint)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(event.distanceKm == nil ? "" : "\(Fmt.distance(event.distanceKm)) away")
    }

    // MARK: Footer
    //
    // Family rule, family name, price, source. All 11pt uppercase in `faint`,
    // so it is reference detail rather than something competing with the title.
    //
    // Dynamic Type breaks this line first, so at the accessibility sizes it
    // gives up the source, then the family name, and keeps the price, which is
    // the fact a person is actually comparing.

    private var showsSource: Bool { !typeSize.isAccessibilitySize }
    private var showsFamilyName: Bool { typeSize < .accessibility3 }

    private var footerParts: [String] {
        var out: [String] = []
        if showsFamilyName, family != nil { out.append(Categories.label(event.category)) }
        if event.isFree { out.append("Free") }
        else if let p = event.price, !p.isEmpty { out.append(p) }
        if showsSource, !event.source.isEmpty { out.append(event.source) }
        return out
    }

    private var footer: some View {
        HStack(spacing: S.s2) {
            familyRule
            Text(footerParts.joined(separator: "   ").uppercased())
                .font(F.caption)
                .kerning(0.77)
                .foregroundStyle(Tok.faint)
                .lineLimit(1)
        }
    }

    // MARK: Bookmark

    private var bookmark: some View {
        let saved = app.isSaved(event)
        return Button {
            // Refused only when the free allowance is spent. Offering the
            // unlock is the whole point of returning a Bool here: without it
            // the bookmark would visibly do nothing and read as a bug.
            if !app.toggleSave(event) { app.unlockPrompt = .saving }
        } label: {
            Image(systemName: saved ? "bookmark.fill" : "bookmark")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(saved ? Tok.accent : Tok.faint)
                // Visually smaller than its hit area, by design. 44x44 is the
                // minimum target and the glyph does not need to fill it.
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(saved ? "Remove \(event.title) from saved" : "Save \(event.title)")
        .accessibilityValue(saved ? "Saved" : "Not saved")
        .accessibilityAddTraits(saved ? AccessibilityTraits.isSelected : [])
    }
}

/// Touch down drops the row to 62 per cent and back.
///
/// Deliberately NO scale on list rows: a long feed where every row grows and
/// shrinks under the thumb reads as unstable. Buttons may scale, rows may not.
struct PressableRow: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.62 : 1)
            .animation(.easeOut(duration: configuration.isPressed ? 0.12 : 0.2),
                       value: configuration.isPressed)
    }
}

enum TagKind { case category, neutral, free }

/// Small outlined label, used on the detail sheet. Outlined rather than filled,
/// so several of them together stay quiet.
struct TagChip: View {
    let text: String
    var kind: TagKind = .neutral
    var body: some View {
        Text(text)
            .font(F.caption)
            .kerning(0.77)
            .padding(.horizontal, S.s2 + 1).padding(.vertical, S.s1)
            .foregroundStyle(fg)
            .background(bg, in: Capsule())
            .overlay(Capsule().stroke(stroke, lineWidth: 1))
    }
    private var fg: Color {
        switch kind {
        case .category: Tok.text
        case .free: Tok.freeFg
        case .neutral: Tok.muted
        }
    }
    private var bg: Color { kind == .neutral ? Tok.panel2 : .clear }
    private var stroke: Color {
        switch kind {
        case .category: Tok.hairline
        case .free: Tok.freeFg
        case .neutral: .clear
        }
    }
}
