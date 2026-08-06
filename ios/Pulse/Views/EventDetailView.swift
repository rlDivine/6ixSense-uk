import SwiftUI
import MapKit
import UIKit

struct EventDetailView: View {
    let event: Event
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .bottom) {
            Tok.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    hero
                    VStack(alignment: .leading, spacing: 16) {
                        badges
                        Text(event.title).font(.system(size: 25, weight: .heavy)).foregroundStyle(Tok.text)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Tap “Get tickets / Details” for the full description and tickets from \(event.source).")
                            .font(.system(size: 14)).foregroundStyle(Tok.muted)
                            .fixedSize(horizontal: false, vertical: true)
                        facts
                        venueBlock
                        secondaryActions
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16).padding(.bottom, 110)
                }
            }
            cta
        }
        .ignoresSafeArea(edges: .top)
    }

    private var hero: some View {
        // Size is driven by the wash (a fixed-frame, flexible view). The image
        // is a CLIPPED overlay, so a wide photo can never inflate the hero's width
        // and shove the rest of the page off-screen.
        Categories.wash(event.category)
            .frame(maxWidth: .infinity)
            .frame(height: 280)
            .overlay {
                if let img = event.image, let url = URL(string: img) {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() }
                        else { CategoryGlyph(category: event.category, size: 56) }
                    }
                } else {
                    CategoryGlyph(category: event.category, size: 56)
                }
            }
            .clipped()
            .overlay(alignment: .top) {
                HStack {
                    circleBtn("chevron.left") { dismiss() }
                    Spacer()
                    circleBtn(app.isSaved(event) ? "bookmark.fill" : "bookmark") { app.toggleSave(event) }
                }
                .padding(.horizontal, 14).padding(.top, 54)
            }
    }

    private func circleBtn(_ sys: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: sys).font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 38, height: 38).background(.black.opacity(0.5), in: Circle())
        }
    }

    private var badges: some View {
        HStack(spacing: 8) {
            TagChip(text: event.category, kind: .category)
            if event.isFree && event.category != "Free" { TagChip(text: "Free", kind: .free) }
            Text("via \(event.source)").font(.system(size: 11)).foregroundStyle(Tok.muted)
        }
    }

    private var facts: some View {
        HStack(spacing: 8) {
            fact("When", event.startDate != nil
                 ? event.startDate!.formatted(.dateTime.month(.abbreviated).day()) + " · " + Fmt.time(event.startDate)
                 : "TBA")
            fact("Distance", Fmt.distance(event.distanceKm))
            fact("Price", event.isFree ? "Free" : (event.price?.isEmpty == false ? event.price! : "Not listed"))
        }
    }
    private func fact(_ k: String, _ v: String) -> some View {
        VStack(spacing: 3) {
            Text(k).font(.system(size: 10.5)).foregroundStyle(Tok.muted)
            Text(v).font(.system(size: 13, weight: .bold)).foregroundStyle(Tok.text)
                .multilineTextAlignment(.center).lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity).padding(10)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
    }

    @ViewBuilder private var venueBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(event.venue ?? "Venue TBA").font(.system(size: 15, weight: .bold)).foregroundStyle(Tok.text)
            Text(event.address ?? "Address TBA").font(.system(size: 13)).foregroundStyle(Tok.muted)
            if let lat = event.lat, let lng = event.lng {
                let coord = CLLocationCoordinate2D(latitude: lat, longitude: lng)
                // Static snapshot instead of a live Map, which avoids a second MapKit
                // instance over the main map (which froze the app on dismiss).
                VenueSnapshot(coordinate: coord)
                    .frame(height: 130).clipShape(RoundedRectangle(cornerRadius: 10))
                if let url = URL(string: "http://maps.apple.com/?daddr=\(lat),\(lng)") {
                    Link("Directions", destination: url).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Tok.link)
                }
            }
        }
        .padding(12)
        .background(Tok.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tok.hairline, lineWidth: 1))
    }

    private var secondaryActions: some View {
        HStack(spacing: 8) {
            if let url = URL(string: event.url ?? "") {
                ShareLink(item: url) { actionLabel("Share") }
            } else { actionLabel("Share") }
            Button { app.toggleSave(event) } label: { actionLabel(app.isSaved(event) ? "Saved" : "Save") }
        }
    }
    private func actionLabel(_ t: String) -> some View {
        Text(t).font(.system(size: 13, weight: .semibold)).foregroundStyle(Tok.text)
            .frame(maxWidth: .infinity).padding(11)
            .background(Tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Tok.hairline, lineWidth: 1))
    }

    @ViewBuilder private var cta: some View {
        if let url = URL(string: event.url ?? "") {
            Link(destination: url) {
                Text("Get tickets and details").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(15)
                    .background(Tok.accent, in: RoundedRectangle(cornerRadius: 14))
            }
            .padding(.horizontal, 16).padding(.bottom, 24)
        }
    }
}

/// A still image of the venue location, rendered once via MKMapSnapshotter.
/// far lighter than embedding a live `Map`, and safe to present over another map.
struct VenueSnapshot: View {
    let coordinate: CLLocationCoordinate2D
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Tok.panel2
            }
            Image(systemName: "mappin.circle.fill")
                .font(.system(size: 28)).foregroundStyle(Tok.accent)
                .shadow(color: .black.opacity(0.4), radius: 2)
        }
        .onAppear(perform: render)
    }

    private func render() {
        guard image == nil else { return }
        let opts = MKMapSnapshotter.Options()
        opts.region = MKCoordinateRegion(center: coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01))
        opts.size = CGSize(width: 380, height: 130)
        MKMapSnapshotter(options: opts).start(with: .main) { snapshot, _ in
            if let snapshot { image = snapshot.image }
        }
    }
}
