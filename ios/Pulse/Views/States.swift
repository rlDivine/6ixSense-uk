import SwiftUI
import Combine

struct LoadingState: View {
    /// Simulated cold-start progress. The backend runs on a free tier that can
    /// take 30–50s to wake from idle, and gives no progress signal, so we ease a
    /// bar asymptotically toward ~95% over that window. It disappears the moment
    /// events arrive (this whole view is replaced by the feed), so it never has
    /// to "reach" 100% — it just communicates that something is happening and
    /// roughly how far along the wait is. Warm launches blow past it in a flash.
    @State private var progress: Double = 0
    @State private var elapsed: Double = 0
    private let tick = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 14) {
            ProgressView().controlSize(.large).tint(Tok.accent)
            Text(caption).font(.system(size: 14, weight: .semibold)).foregroundStyle(Tok.text)
                .animation(.easeInOut(duration: 0.25), value: caption)
            // Deliberately not a source count: Pulse runs three, and a stale
            // number here is exactly the sort of thing nobody remembers to update.
            Text("Merging live listings near you").font(.system(size: 12)).foregroundStyle(Tok.muted)

            // Cold-start progress bar
            VStack(spacing: 6) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Tok.panel2)
                        Capsule().fill(Tok.accent)
                            .frame(width: max(8, geo.size.width * progress))
                    }
                }
                .frame(height: 8)
                HStack {
                    Text(subcaption).font(.system(size: 11)).foregroundStyle(Tok.muted)
                    Spacer()
                    Text("\(Int(progress * 100))%").font(.system(size: 11, weight: .semibold)).foregroundStyle(Tok.muted)
                }
            }
            .padding(.horizontal, 16).padding(.top, 4)

            VStack(spacing: 12) {
                ForEach(0..<4, id: \.self) { _ in SkeletonCard() }
            }
            .padding(.top, 8).padding(.horizontal, 14)
            Spacer()
        }
        .padding(.top, 40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onReceive(tick) { _ in
            elapsed += 0.1
            let target = 0.95
            withAnimation(.linear(duration: 0.1)) {
                progress = min(target, progress + (target - progress) * 0.007)
            }
        }
    }

    private var caption: String {
        if elapsed < 6 { return "Finding events near you…" }
        if elapsed < 22 { return "Waking up the server…" }
        return "Almost ready…"
    }
    private var subcaption: String {
        if elapsed < 8 { return "Connecting" }
        if elapsed < 22 { return "First launch can take up to a minute" }
        return "Loading events"
    }
}

private struct SkeletonCard: View {
    @State private var phase: CGFloat = -1
    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 10).fill(Tok.panel2).frame(width: 74, height: 74)
            VStack(alignment: .leading, spacing: 8) {
                bar(0.7); bar(0.4); bar(1.0)
            }
            Spacer()
        }
        .padding(10)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
    }
    private func bar(_ w: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 5).fill(Tok.panel2).frame(height: 12)
            .frame(maxWidth: .infinity, alignment: .leading).scaleEffect(x: w, anchor: .leading)
    }
}

struct EmptyState: View {
    let reset: () -> Void
    var body: some View {
        VStack(spacing: 8) {
            Text("🗓️").font(.system(size: 40))
            Text("No events match").font(.system(size: 17, weight: .bold)).foregroundStyle(Tok.text)
            Text("Try another category or widen the date range.").font(.system(size: 13.5)).foregroundStyle(Tok.muted)
            Button("Reset filters", action: reset)
                .font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                .padding(.horizontal, 20).padding(.vertical, 11)
                .background(Tok.accent, in: RoundedRectangle(cornerRadius: 12))
                .padding(.top, 6)
        }
        .multilineTextAlignment(.center).padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ErrorState: View {
    let message: String
    let retry: () -> Void
    var body: some View {
        VStack(spacing: 8) {
            Text("📡").font(.system(size: 40))
            Text("Couldn't reach events").font(.system(size: 17, weight: .bold)).foregroundStyle(Tok.text)
            Text(message).font(.system(size: 13)).foregroundStyle(Tok.muted)
                .font(.system(size: 12)).foregroundStyle(Tok.muted)
            Button("Retry", action: retry)
                .font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                .padding(.horizontal, 20).padding(.vertical, 11)
                .background(Tok.accent, in: RoundedRectangle(cornerRadius: 12))
                .padding(.top, 6)
        }
        .multilineTextAlignment(.center).padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
