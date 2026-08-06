import Foundation

/// A date or date-range parsed out of a free-text search query, plus
/// whatever text is left over to still match by title/venue/category.
struct DateQuery {
    let range: ClosedRange<Date>
    let label: String
    let rest: String
}

/// Mirrors the web app's search-bar date parser (api/public/app.js) so both
/// clients understand the same phrases: explicit dates ("july 25",
/// "25/7", "2026-07-25"), ranges ("july 25-27"), and relative phrases
/// ("today", "this weekend", "next week", "friday", "next friday").
///
/// Numeric dates are read the British way round: day before month.
enum DateQueryParser {
    private static let months = ["january","february","march","april","may","june","july","august","september","october","november","december"]
    private static let weekdays = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]

    // "Today", "this weekend" and friends have to mean the user's today,
    // wherever they are, so this follows the device timezone.
    private static var calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        return c
    }()

    private static func monthIndex(_ tok: String) -> Int? {
        let t = String(tok.lowercased().prefix(3))
        return months.firstIndex { $0.prefix(3) == t }
    }
    private static func jsWeekday(_ d: Date) -> Int { calendar.component(.weekday, from: d) - 1 } // 0=Sun..6=Sat
    private static func startOfDay(_ d: Date) -> Date { calendar.startOfDay(for: d) }
    private static func endOfDay(_ d: Date) -> Date {
        calendar.date(byAdding: DateComponents(day: 1, second: -1), to: startOfDay(d))!
    }
    private static func addDays(_ d: Date, _ n: Int) -> Date {
        calendar.date(byAdding: .day, value: n, to: d)!
    }
    private static func date(year: Int, month: Int, day: Int) -> Date? {
        calendar.date(from: DateComponents(year: year, month: month, day: day))
    }
    private static func weekendRange(_ now: Date, next: Bool) -> (Date, Date) {
        let day = jsWeekday(now)
        var sat = day == 0 ? startOfDay(now) : startOfDay(addDays(now, (6 - day + 7) % 7))
        if next { sat = addDays(sat, 7) }
        let sun = addDays(sat, 1)
        return (sat, endOfDay(sun))
    }

    private static func firstMatch(_ pattern: String, in s: String) -> [String]? {
        guard let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return nil }
        let range = NSRange(s.startIndex..., in: s)
        guard let m = re.firstMatch(in: s, options: [], range: range) else { return nil }
        return (0..<m.numberOfRanges).map { i in
            guard let r = Range(m.range(at: i), in: s) else { return "" }
            return String(s[r])
        }
    }
    private static func strip(_ raw: String, _ match: String) -> String {
        guard let r = raw.range(of: match, options: [.caseInsensitive]) else { return raw }
        var s = raw; s.replaceSubrange(r, with: " ")
        return s.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }
    private static func label(_ min: Date, _ max: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "EEE, MMM d"; f.timeZone = calendar.timeZone
        let a = f.string(from: min), b = f.string(from: max)
        return a == b ? a : "\(a) to \(b)"
    }

    static func parse(_ raw: String, now: Date = .now) -> DateQuery? {
        if let m = firstMatch(#"\b(\d{4})-(\d{1,2})-(\d{1,2})\b"#, in: raw),
           let y = Int(m[1]), let mo = Int(m[2]), let d = Int(m[3]),
           let dt = date(year: y, month: mo, day: d) {
            let (mn, mx) = (startOfDay(dt), endOfDay(dt))
            return DateQuery(range: mn...mx, label: label(mn, mx), rest: strip(raw, m[0]))
        }

        // The separator class accepts the dashes a person might actually type,
        // including the ones an iOS keyboard substitutes automatically. This is
        // about reading input, not about how the app writes.
        if let m = firstMatch(#"\b([a-zA-Z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|to|–|—)\s*(\d{1,2})(?:st|nd|rd|th)?\b"#, in: raw),
           let mi = monthIndex(m[1]), let d1n = Int(m[2]), let d2n = Int(m[3]) {
            let y = calendar.component(.year, from: now)
            if var d1 = date(year: y, month: mi + 1, day: d1n), var d2 = date(year: y, month: mi + 1, day: d2n) {
                if endOfDay(d2) < now {
                    d1 = date(year: y + 1, month: mi + 1, day: d1n) ?? d1
                    d2 = date(year: y + 1, month: mi + 1, day: d2n) ?? d2
                }
                let (mn, mx) = (startOfDay(d1), endOfDay(d2))
                return DateQuery(range: mn...mx, label: label(mn, mx), rest: strip(raw, m[0]))
            }
        }

        if let m = firstMatch(#"\b([a-zA-Z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b"#, in: raw),
           let mi = monthIndex(m[1]), let dn = Int(m[2]) {
            let y = calendar.component(.year, from: now)
            if var d = date(year: y, month: mi + 1, day: dn) {
                if endOfDay(d) < now { d = date(year: y + 1, month: mi + 1, day: dn) ?? d }
                let (mn, mx) = (startOfDay(d), endOfDay(d))
                return DateQuery(range: mn...mx, label: label(mn, mx), rest: strip(raw, m[0]))
            }
        }

        // "25/7" is the 25th of July: day first, as written everywhere in the UK.
        if let m = firstMatch(#"\b(\d{1,2})/(\d{1,2})\b"#, in: raw),
           let dn = Int(m[1]), let mo = Int(m[2]) {
            let y = calendar.component(.year, from: now)
            if var d = date(year: y, month: mo, day: dn) {
                if endOfDay(d) < now { d = date(year: y + 1, month: mo, day: dn) ?? d }
                let (mn, mx) = (startOfDay(d), endOfDay(d))
                return DateQuery(range: mn...mx, label: label(mn, mx), rest: strip(raw, m[0]))
            }
        }

        if let m = firstMatch(#"\b(next\s+)?weekend\b"#, in: raw) {
            let (mn, mx) = weekendRange(now, next: !m[1].isEmpty)
            return DateQuery(range: mn...mx, label: label(mn, mx), rest: strip(raw, m[0]))
        }

        if let m = firstMatch(#"\bnext week\b"#, in: raw) {
            let (mn, mx) = (startOfDay(addDays(now, 7)), endOfDay(addDays(now, 13)))
            return DateQuery(range: mn...mx, label: label(mn, mx), rest: strip(raw, m[0]))
        }
        if let m = firstMatch(#"\bthis week\b"#, in: raw) {
            let (mn, mx) = (startOfDay(now), endOfDay(addDays(now, 7)))
            return DateQuery(range: mn...mx, label: label(mn, mx), rest: strip(raw, m[0]))
        }

        if let m = firstMatch(#"\btoday\b"#, in: raw) {
            let (mn, mx) = (startOfDay(now), endOfDay(now))
            return DateQuery(range: mn...mx, label: label(mn, mx), rest: strip(raw, m[0]))
        }
        if let m = firstMatch(#"\btomorrow\b"#, in: raw) {
            let d = addDays(now, 1)
            let (mn, mx) = (startOfDay(d), endOfDay(d))
            return DateQuery(range: mn...mx, label: label(mn, mx), rest: strip(raw, m[0]))
        }

        for (i, wd) in weekdays.enumerated() {
            if let m = firstMatch(#"\b(next\s+)?"# + wd + #"\b"#, in: raw) {
                var delta = (i - jsWeekday(now) + 7) % 7
                if !m[1].isEmpty { delta += 7 }
                let d = addDays(now, delta)
                let (mn, mx) = (startOfDay(d), endOfDay(d))
                return DateQuery(range: mn...mx, label: label(mn, mx), rest: strip(raw, m[0]))
            }
        }

        return nil
    }
}
