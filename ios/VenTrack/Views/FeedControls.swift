import SwiftUI

/// The filter block that sits above every feed, on both devices.
///
/// Extracted from `DiscoverView` when the iPad layout arrived, because the
/// content column needs exactly these controls and a second copy of them would
/// be a second set of gates to keep in step with `AppState`. One copy, one
/// gutter parameter, both layouts.
///
/// What is NOT here: the large title. On the phone the town is the page title,
/// at 34pt, above these controls. On iPad the town lives in the sidebar because
/// it applies to every destination rather than to one screen, and a feed that
/// repeated it would be saying the same thing twice on one screen. So the title
/// stays in `DiscoverView` and this is the part they share.
struct FeedControls: View {
    /// The screen margin. `S.s5` on the phone, `Pad.gutter` at regular width,
    /// where a margin sized for 390pt reads as cramped.
    var gutter: CGFloat = S.s5

    @EnvironmentObject var app: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: S.s3) {
            outOfMarketNotice
            sortControl
            rangeRow
            categoryRow
        }
    }

    /// A chip's own height. Both `Pill` and `CategoryChip` are built to it.
    static let chipHeight: CGFloat = 34

    /// Plain, draggable surface above and below the chips.
    ///
    /// Not decoration. Every chip is a `Button` filling the full height of the
    /// row, so with the scroll view sized exactly to the chips there was no
    /// part of it that was not a button, and a horizontal drag had to begin on
    /// a control while a vertical scroll view sat underneath competing for the
    /// same gesture. That is a well known way to make a nested horizontal row
    /// feel stuck: it scrolls if you flick it just right and refuses if you
    /// drag it slowly, which reads as broken rather than fiddly.
    ///
    /// Five points top and bottom gives the gesture somewhere to start that is
    /// not a control, on both rows, and changes nothing about how a chip looks.
    static let chipPad: CGFloat = 5

    /// The height of one row of chips, told to the rows explicitly.
    ///
    /// A ScrollView is greedy in BOTH axes, including the one it does not
    /// scroll. Inside a vertical feed that never shows, because there it is
    /// offered unbounded height and settles at its content size. In a stack
    /// that fills the display, two horizontal scroll views will take a third of
    /// the screen each and crush whatever is below them to nothing. That is
    /// what a "black screen on launch" turned out to be once already.
    ///
    /// So it stays an explicit number. It is now derived from the two above
    /// rather than written as a literal, because the row and its contents have
    /// to agree: framed shorter than its content, the row clips instead of
    /// scrolling.
    static let chipRow: CGFloat = chipHeight + chipPad * 2

    /// Two segments in a full width `panel2` track, the live one filled with
    /// `activeBg` under `activeFg`. Selection is monochrome everywhere, and
    /// that is what leaves the accent free to mean one thing.
    ///
    /// Both segments are labelled with an SF Symbol rather than an emoji: an
    /// emoji renders in its own font at its own weight and colour, so it never
    /// matches the label beside it.
    private var sortControl: some View {
        HStack(spacing: 0) {
            sortSegment("location.fill", "Nearest", .nearest)
            sortSegment("clock.fill", "Soonest", .soonest)
        }
        .padding(2)
        .background(Tok.panel2, in: RoundedRectangle(cornerRadius: 11))
        .padding(.horizontal, gutter)
        .frame(height: 44)
    }

    /// The symbol is decorative, so it stays out of the accessibility label:
    /// VoiceOver says "sort by nearest" rather than reading the pin out loud.
    private func sortSegment(_ symbol: String, _ label: String,
                             _ value: EventService.Sort) -> some View {
        let on = app.sort == value
        return Button {
            guard app.sort != value else { return }
            app.sort = value
            Task { await app.load() }
        } label: {
            Label(label, systemImage: symbol)
                .labelStyle(.titleAndIcon)
                .font(.system(size: 15, weight: .medium))
                .imageScale(.small)
                .foregroundStyle(on ? Tok.activeFg : Tok.muted)
                .frame(maxWidth: .infinity)
                .frame(height: 36)
                .background(on ? Tok.activeBg : Color.clear,
                            in: RoundedRectangle(cornerRadius: 9))
                .contentShape(RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sort by \(label.lowercased())")
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    /// The free app looks seven days ahead, so "All upcoming" carries a padlock
    /// until the unlock is bought. It stays in the row rather than being hidden:
    /// a control you can see and understand is a better offer than one that
    /// silently is not there, and hiding it would leave the row looking like the
    /// whole feature set.
    private var rangeRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(EventService.Range.allCases, id: \.self) { r in
                    let locked = r == .all && !app.unlocked
                    Pill(text: r.label, active: app.range == r, locked: locked) {
                        guard app.range != r else { return }
                        if locked { app.unlockPrompt = .dateRange; return }
                        app.range = r
                        Task { await app.load() }
                    }
                }
            }
            .padding(.horizontal, gutter)
            .padding(.vertical, Self.chipPad)
        }
        .frame(height: Self.chipRow)
    }

    /// Built from what is actually in the feed, never a fixed list, so a town
    /// with no football listings does not offer a Football chip that returns
    /// nothing.
    private var categoryRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(app.categoryChips, id: \.self) { c in
                    CategoryChip(name: c, active: app.category == c) {
                        app.category = c
                    }
                }
            }
            .padding(.horizontal, gutter)
            .padding(.vertical, Self.chipPad)
        }
        .frame(height: Self.chipRow)
    }

    /// Shown only when the device is outside the UK. Without it the feed looks
    /// broken, showing London listings under a "near you" heading, when in fact
    /// it is working exactly as intended for a UK only app. Not dismissible,
    /// because the condition persists.
    @ViewBuilder private var outOfMarketNotice: some View {
        if !app.inMarket && app.placeOverride == nil {
            HStack(alignment: .top, spacing: 9) {
                Image(systemName: "info.circle")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Tok.muted)
                Text("VenTrack covers the UK only. You appear to be outside it, so we are showing \(app.placeName).")
                    .font(F.footnote)
                    .foregroundStyle(Tok.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(S.s3)
            .background(Tok.panel2, in: RoundedRectangle(cornerRadius: R.well))
            .padding(.horizontal, gutter)
            .accessibilityElement(children: .combine)
        }
    }
}

/// Names what the run of cards below actually is, rather than repeating the
/// count already in the header.
struct FeedSectionHeader: View {
    var gutter: CGFloat = S.s5

    @EnvironmentObject var app: AppState

    var body: some View {
        Text(app.range == .today ? "TONIGHT" : "TONIGHT AND THIS WEEK")
            .font(F.caption)
            .kerning(0.77)
            .foregroundStyle(Tok.faint)
            .padding(.horizontal, gutter)
            .padding(.top, S.s5)
            .padding(.bottom, S.s3)
    }
}

/// The end of the free week is a STATED gate, never a blur or a fade.
///
/// A fade is a gradient, and it is also dishonest: it implies there is
/// something just out of reach rather than saying what the boundary is. So this
/// names how many more events exist, explains the boundary in one sentence, and
/// offers one button. The shape of the paid tier is legible before anyone hits
/// it.
struct FreeWindowGate: View {
    var gutter: CGFloat = S.s5

    @EnvironmentObject var app: AppState

    var body: some View {
        if !app.unlocked, app.range != .all, !app.visibleEvents.isEmpty {
            VStack(alignment: .leading, spacing: S.s2) {
                Text("That is the free week")
                    .font(F.title)
                    .kerning(-0.7)
                    .foregroundStyle(Tok.text)
                Text("VenTrack looks seven days ahead on the free tier. Unlocking opens the whole month, every town in the UK, and unlimited saves.")
                    .font(F.body)
                    .foregroundStyle(Tok.muted)
                    .fixedSize(horizontal: false, vertical: true)
                Button { app.unlockPrompt = .dateRange } label: {
                    Text("See what unlocking adds")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(Tok.accentFill, in: RoundedRectangle(cornerRadius: R.button))
                }
                .buttonStyle(PressableRow())
                .padding(.top, S.s2)
            }
            .padding(.horizontal, gutter)
            .padding(.top, S.s7)
        }
    }
}
