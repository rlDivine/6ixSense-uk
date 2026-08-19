import Foundation
import StoreKit

/// The one in-app purchase: a non-consumable that unlocks the whole app,
/// bought once and owned for good.
///
/// VenTrack is free to download and useful without paying. What is behind this
/// is the part that only matters once you already like it: browsing towns other
/// than the one you are standing in, looking further ahead than the next seven
/// days, and keeping more than a few events with reminders. That shape is
/// deliberate, and the reasoning is in ios/APPSTORE.md.
///
/// Not a subscription. There is no recurring cost on our side that a recurring
/// charge would be honest about, and a subscription on a utility this small
/// reads as a shakedown.
///
/// The gate is client side, which is worth being clear about rather than
/// implying otherwise: a determined person can defeat it, and the /api/events
/// endpoint is open anyway. Server-side entitlement checking would mean receipt
/// validation infrastructure and an account system, which would cost more to
/// run and maintain than the piracy it prevents, and would break the "no
/// account, no sign up" promise the App Store listing makes. This is the same
/// trade nearly every one-time unlock makes.
@MainActor
final class Store: ObservableObject {
    /// Must match the product identifier created in App Store Connect exactly.
    /// See ios/APPSTORE.md for how to create it, and VenTrack.storekit for the
    /// local test version of the same product.
    static let productID = "com.voice2jobs.ventrackuk.full"

    /// Last known entitlement, so a paying user does not see the locked app for
    /// a beat on every cold launch while StoreKit answers. StoreKit is still
    /// the authority and corrects this within a moment of launch either way.
    private static let cacheKey = "unlockedFull"

    @Published private(set) var unlocked: Bool
    /// False until StoreKit has actually answered once. Anything that takes
    /// something away from the user has to wait for this, because the cached
    /// value above is a guess and acting on a wrong guess means deleting
    /// somebody's chosen town while the network is still thinking.
    @Published private(set) var resolved = false
    @Published private(set) var product: Product?
    @Published private(set) var busy = false
    /// Set when a purchase or restore failed in a way worth telling the user
    /// about. User cancellation is not one of those, and stays nil.
    @Published var failure: String?

    /// Called on every change so AppState, which owns the gates, can follow.
    /// Explicitly main-actor isolated: it is always called from here, on the
    /// main actor, and what it calls into is main-actor isolated too.
    var onChange: (@MainActor (_ unlocked: Bool, _ resolved: Bool) -> Void)?

    private var updates: Task<Void, Never>?

    init() {
        unlocked = UserDefaults.standard.bool(forKey: Self.cacheKey)

        // Started at launch and never cancelled, deliberately. This is what
        // catches a purchase that completed outside the app: an Ask to Buy
        // approval, a purchase interrupted by a password prompt, or a refund
        // Apple processed while the app was closed. The object lives as long as
        // the process, so there is nothing to tear down.
        updates = Task { [weak self] in
            for await update in Transaction.updates {
                if case .verified(let transaction) = update {
                    await transaction.finish()
                }
                await self?.refresh()
            }
        }
    }

    // MARK: Entitlement

    /// Ask StoreKit what this Apple Account actually owns. Works offline: the
    /// entitlements come from the receipt on the device, not from the network.
    func refresh() async {
        var owned = false
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            // revocationDate is set when Apple refunded or revoked the purchase.
            if transaction.productID == Self.productID, transaction.revocationDate == nil {
                owned = true
            }
        }
        apply(owned, resolved: true)
    }

    /// The product, for its localised price. Never hardcode the price: it
    /// differs by storefront, Apple changes the tiers, and a wrong price in the
    /// interface is a rejection.
    func loadProduct() async {
        guard product == nil else { return }
        do {
            product = try await Product.products(for: [Self.productID]).first
            if product == nil {
                // An EMPTY result, not an error. StoreKit returns this rather
                // than throwing when the id is unknown to it, and every cause
                // is a configuration problem outside this code:
                //
                //   the Paid Applications Agreement is not active, which is by
                //   far the most common and blocks every product on the account
                //   until banking and tax details are filled in;
                //   the product does not exist in App Store Connect, or its id
                //   is not exactly the string above;
                //   the product exists but has never been submitted;
                //   running in a simulator or from the command line with no
                //   StoreKit configuration selected in the scheme.
                //
                // Logged rather than shown: the paywall degrades to a button
                // with no price, which is right for a user, and useless for
                // anyone trying to work out why.
                print("[store] no product for \(Self.productID). Check the Paid Applications "
                      + "Agreement is active, the id matches App Store Connect exactly, and "
                      + "the product has been submitted. In the simulator, select "
                      + "VenTrack.storekit under Scheme, Run, Options.")
            }
        } catch {
            print("[store] loading \(Self.productID) failed: \(error.localizedDescription)")
        }
    }

    /// What the button says. Falls back to no price rather than a made up one
    /// when the product could not be fetched, which happens offline and in a
    /// simulator with no StoreKit configuration selected.
    var priceLabel: String {
        guard let product else { return "Unlock everything" }
        return "Unlock everything for \(product.displayPrice)"
    }

    // MARK: Buying

    func purchase() async {
        guard let product else {
            failure = "The App Store is not reachable right now. Try again in a moment."
            return
        }
        busy = true
        failure = nil
        defer { busy = false }

        do {
            switch try await product.purchase() {
            case .success(let verification):
                guard case .verified(let transaction) = verification else {
                    // A signature that does not check out. Do not unlock: this
                    // is the one case where refusing is right even though the
                    // user believes they just paid.
                    failure = "That purchase could not be verified. Nothing has been charged."
                    return
                }
                await transaction.finish()
                apply(true, resolved: true)
            case .userCancelled:
                break   // Not a failure, and not worth a message.
            case .pending:
                // Ask to Buy, or a payment method needing approval. The
                // Transaction.updates loop above is what completes this later.
                failure = "That purchase needs approval before it can complete. "
                        + "The app will unlock on its own once it is approved."
            @unknown default:
                break
            }
        } catch {
            failure = error.localizedDescription
        }
    }

    /// Required by App Review for any non-consumable, and genuinely needed: a
    /// new phone, a reinstall, or a second device all land here.
    func restore() async {
        busy = true
        failure = nil
        defer { busy = false }

        try? await AppStore.sync()
        await refresh()
        if !unlocked {
            failure = "No previous purchase was found on this Apple Account."
        }
    }

    // MARK: -

    private func apply(_ owned: Bool, resolved isResolved: Bool) {
        unlocked = owned
        resolved = isResolved
        UserDefaults.standard.set(owned, forKey: Self.cacheKey)
        onChange?(owned, isResolved)
    }
}
