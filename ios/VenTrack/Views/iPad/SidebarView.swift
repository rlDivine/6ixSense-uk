import SwiftUI

/// The sidebar column of the regular width layout: the app's identity, the
/// town, the four destinations, and what the free tier has left.
///
/// WHAT IS IN HERE, AND WHAT IS DELIBERATELY NOT.
///
/// The town is here rather than in the feed. It applies to every destination,
/// not to one screen, so the chrome that is always on screen is where it
/// belongs. That is also why the content column carries no large title at
/// regular width: it would be saying the same word twice on one screen.
///
/// The filters are NOT here, and this is the line worth holding. Sort, range
/// and category change *what the content column shows*; the rows below change
/// *which destination you are in*. A sidebar that mixes the two stops being
/// legible as navigation, and there is nowhere left to put the distinction
/// back. `FeedControls` stays at the top of the content column and scrolls away
/// exactly as it does on the phone.
///
/// Selection is monochrome throughout, `Tok.activeBg` under `Tok.activeFg`, the
/// same fill the phone's sort control puts under its live segment. A selected
/// row in the accent would put red permanently on screen next to a dozen "on
/// today" overlines, and the overline is the one thing in the app that colour
/// is rationed for. See the note at the top of `Theme.swift`.
///
/// Compact width never sees this. `MainTabView` is still the phone layout and
/// the tab bar is still its navigation.
struct SidebarView: View {
    /// The selected destination, owned by the split view shell above. A
    /// binding rather than a read of `AppState.tab` because the shell is what
    /// keeps the two in step, and a column that wrote straight into app state
    /// would be a second authority on the same thing.
    @Binding var destination: Destination

    @EnvironmentObject var app: AppState

    /// The town button's sheet.
    ///
    /// Its own flag rather than something reached from `BrandStrip`: the strip
    /// already owns a `showSettings` of its own, private to it, and there is no
    /// way to drive it from out here. Both present `PreferencesView`, which is
    /// correct, since changing the town IS a setting. Two flags on two views
    /// cannot both be true at once because only one of the two controls can be
    /// tapped at a time, so there is no risk of competing sheets.
    @State private var showTownPicker = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Lifted from the phone unchanged. The mark, the wordmark and the
            // gear, with the gear's filtered dot intact, because a filter you
            // cannot see is the one that makes the app look broken, and that is
            // as true on a 13 inch as it is on a 390pt phone. Nothing is added
            // to it here: this row means "this is VenTrack, and here are the
            // settings", and the town below is a different statement.
            BrandStrip()

            // The town and the four rows scroll, the strip above and the
            // footer below do not.
            //
            // Four rows never overflow at default type, so this looks like
            // ceremony. It is not: at the accessibility sizes the town alone
            // can take three lines of 34pt, and without a scroll view the
            // fourth destination is simply off the bottom of a column that
            // cannot be moved. `.basedOnSize` means it still does not bounce in
            // the ordinary case, so nothing feels loose.
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    townButton
                    destinations
                }
            }
            .scrollBounceBehavior(.basedOnSize)

            footer
        }
        .background(Tok.bg.ignoresSafeArea())
        .sheet(isPresented: $showTownPicker) { PreferencesView() }
    }

    // MARK: The town

    /// The town as a page title with today's date over it, the same block the
    /// phone puts at the top of the feed, moved here whole.
    ///
    /// It is a button because the town is changeable, and the chevron is what
    /// says so. Tapping opens settings rather than a bare town picker: the town
    /// list lives inside `PreferencesView` and there is only one of it. Opening
    /// the whole sheet also means the person who tapped the town because they
    /// wanted the interests filter is one screen from it rather than back where
    /// they started.
    private var townButton: some View {
        Button { showTownPicker = true } label: {
            VStack(alignment: .leading, spacing: S.s1) {
                Text(todayLine)
                    .font(F.caption)
                    .kerning(0.77)
                    .foregroundStyle(Tok.faint)
                HStack(alignment: .firstTextBaseline, spacing: S.s2) {
                    Text(app.placeName)
                        .font(F.display)
                        .kerning(-0.7)
                        .foregroundStyle(Tok.text)
                        // Two lines rather than one line scaled down. The
                        // column is 288pt in portrait, and "Kingston upon
                        // Thames" at 34pt does not fit on one line of it at any
                        // honest size. Shrinking the type would break the rule
                        // that a 34pt title is 34pt on both devices, and would
                        // make the title's size depend on which town you are
                        // in, which reads as a bug.
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Image(systemName: "chevron.down")
                        .font(F.callout)
                        .foregroundStyle(Tok.muted)
                    Spacer(minLength: 0)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, S.s5)
            .padding(.top, S.s4)
            .padding(.bottom, S.s5)
            .contentShape(Rectangle())
        }
        // Rows do not scale under the finger, they dim. The town is a block of
        // 34pt type at the top of fixed chrome, and a title that grows and
        // shrinks while the four rows under it hold still is the kind of motion
        // that reads as instability rather than as feedback.
        .buttonStyle(PressableRow())
        // No `hoverEffect` here. The pointer highlight is what marks the list
        // of destinations as a list of destinations, and spreading it to every
        // tappable thing in the column takes that meaning straight back off it.
        .accessibilityLabel("Town, \(app.placeName)")
        .accessibilityHint("Opens settings, where the town can be changed")
    }

    /// "FRIDAY 21 AUGUST".
    ///
    /// Built in two pieces, and en-GB throughout, for the same reason the feed
    /// does it: the locale writes the date as "21 August" and the design wants
    /// the weekday in front of it. Uppercased here rather than carrying capitals
    /// in the string so VoiceOver still reads a word rather than spelling out
    /// letters, which is also why `F.caption` exists as a style instead of the
    /// copy being shouted at the source.
    private var todayLine: String {
        let gb = Locale(identifier: "en_GB")
        let now = Date.now
        let weekday = now.formatted(.dateTime.weekday(.wide).locale(gb))
        let date = now.formatted(.dateTime.day().month(.wide).locale(gb))
        return "\(weekday) \(date)".uppercased(with: gb)
    }

    // MARK: Destinations

    /// Built by iterating the enum rather than written out four times, so a
    /// fifth destination is one case in `Pad.swift` and nothing here.
    private var destinations: some View {
        VStack(spacing: S.s1) {
            ForEach(Destination.allCases) { d in
                row(d)
            }
        }
        // The fills inset from the column edge while the labels stay near the
        // brand strip's own 16pt margin. A selected row that ran to the very
        // edge would touch the split view's divider and read as a panel rather
        // than as a row.
        .padding(.horizontal, S.s2)
        .padding(.bottom, S.s4)
    }

    private func row(_ d: Destination) -> some View {
        let on = destination == d
        return Button { destination = d } label: {
            HStack(spacing: S.s3) {
                Image(systemName: d.symbol)
                    // A fixed measure, so the four labels start on the same
                    // vertical line whatever each symbol's own width is. Taken
                    // from the spacing scale rather than picked, because an
                    // invented 26 here is a number nobody can later justify.
                    .frame(width: S.s6, alignment: .center)
                    .foregroundStyle(on ? Tok.activeFg : Tok.muted)
                Text(d.label)
                    .foregroundStyle(on ? Tok.activeFg : Tok.text)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            // One size and one weight in both states. Bolding the selected row
            // would change its width and shove the label, and the fill already
            // says which row is live twice over, by ground and by foreground.
            .font(F.body)
            .padding(.horizontal, S.s3)
            .padding(.vertical, S.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(on ? Tok.activeBg : Color.clear,
                        in: RoundedRectangle(cornerRadius: R.well))
            // The whole row is the target, including the empty measure to the
            // right of a short word like "Map".
            .contentShape(RoundedRectangle(cornerRadius: R.well))
        }
        .buttonStyle(.plain)
        // The one place in the app with a pointer effect. A trackpad user
        // needs to know what in this column is navigation before they commit to
        // clicking it, and these four rows are the answer.
        .hoverEffect(.highlight)
        .accessibilityLabel(d.label)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    // MARK: Footer

    /// What the free tier has left, and the way out of it.
    ///
    /// The whole footer is absent once unlocked, rather than the unlock row
    /// alone. "3 of 3 free saves used" is a sentence about an allowance that no
    /// longer exists for a paying user, and leaving it there to read "0 of 3"
    /// for ever would be describing somebody else's app. There is nothing true
    /// to say in its place, so nothing is said and the destinations get the
    /// space back.
    ///
    /// It sits below the scroll view, not inside it, because an allowance you
    /// have to go looking for is not a thing you will notice spending.
    @ViewBuilder private var footer: some View {
        if !app.unlocked {
            VStack(alignment: .leading, spacing: S.s3) {
                savesLine
                unlockRow
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, S.s4)
            .padding(.vertical, S.s4)
            // The one separator, on the edge where the footer meets the column
            // above it. Same colour on both sides, so without it the footer is
            // simply text that has drifted to the bottom.
            .overlay(alignment: .top) {
                Rectangle().fill(Tok.hairline).frame(height: 1)
            }
        }
    }

    /// The figures at full strength and the words quiet, so the state reads at
    /// a glance without the line shouting.
    ///
    /// Counted through `savesRemaining`, which is derived from `liveSaveCount`,
    /// which is the app's one definition of what still counts as a save.
    /// Subtracting it from the limit here rather than counting saves again is
    /// the whole point of that being one definition: the sidebar cannot drift
    /// from what the bookmark gate actually enforces.
    private var savesLine: some View {
        let used = AppState.freeSaveLimit - app.savesRemaining
        return (
            Text("\(used) of \(AppState.freeSaveLimit)").foregroundStyle(Tok.text)
            + Text(" free saves used").foregroundStyle(Tok.muted)
        )
        .font(F.footnote)
        .accessibilityLabel("\(used) of \(AppState.freeSaveLimit) free saves used")
    }

    /// The offer, stated once, quietly.
    ///
    /// A quiet well rather than the filled `accentFill` button the feed's own
    /// gate uses, and the difference is that this one is ALWAYS on screen. A
    /// solid red block living permanently in the chrome is exactly the thing
    /// that stops "on today" reading as urgent, which is the same argument the
    /// selected row makes above. The gate at the end of the free week can shout
    /// because you have to scroll to it.
    ///
    /// On the contrast: `Tok.accent` on `Tok.panel2` is 4.33:1 on dark, which
    /// `Theme.swift` flags as large text only. 17pt semibold is large text by
    /// that measure with room to spare, and 17pt semibold is what the app's
    /// other primary button labels already are, so this borrows a size that
    /// exists rather than inventing one. Do not quieten this to 13pt: the same
    /// colour on the same well fails at that size.
    private var unlockRow: some View {
        Button { app.unlockPrompt = .general } label: {
            HStack(spacing: S.s2) {
                Text("Unlock everything")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Tok.accent)
                    // Left to wrap rather than truncated or scaled: at the
                    // accessibility sizes two lines of an offer is fine, and
                    // "Unlock everyth..." is not.
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, S.s3)
            .padding(.vertical, S.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Tok.panel2, in: RoundedRectangle(cornerRadius: R.button))
            .contentShape(RoundedRectangle(cornerRadius: R.button))
        }
        .buttonStyle(PressableRow())
        .accessibilityLabel("Unlock everything")
        .accessibilityHint("Opens the paid unlock")
    }
}
