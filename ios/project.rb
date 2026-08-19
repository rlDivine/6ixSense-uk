# Generates VenTrack.xcodeproj from the Swift sources.
# Run:  ruby project.rb       (requires the `xcodeproj` gem, bundled with Xcode tools)
require 'xcodeproj'

ROOT = __dir__
proj_path = File.join(ROOT, 'VenTrack.xcodeproj')
project = Xcodeproj::Project.new(proj_path)

target = project.new_target(:application, 'VenTrack', :ios, '17.0')

# Add the source group + all Swift files
group = project.main_group.new_group('VenTrack', 'VenTrack')
Dir.glob(File.join(ROOT, 'VenTrack', '**', '*.swift')).sort.each do |f|
  ref = group.new_reference(f)
  target.add_file_references([ref])
end

# Info.plist reference (not compiled)
group.new_reference(File.join(ROOT, 'VenTrack', 'Info.plist'))

# The local StoreKit test configuration, so the in-app purchase can be exercised
# in the simulator before the product exists in App Store Connect. A reference
# only: it is neither compiled nor bundled, and it is the SCHEME that points at
# it. After generating the project, in Xcode: Product, Scheme, Edit Scheme, Run,
# Options, StoreKit Configuration, pick VenTrack.storekit. That setting lives in
# the scheme, which Xcode creates itself, so this script cannot set it for you.
# Without it Store.loadProduct() finds nothing and the paywall shows no price.
group.new_reference(File.join(ROOT, 'VenTrack.storekit'))

# Asset catalog (app icon), added as a resource so the xcassets is compiled.
assets = group.new_reference(File.join(ROOT, 'VenTrack', 'Assets.xcassets'))
target.add_resources([assets])

# Build settings on every configuration
target.build_configurations.each do |config|
  s = config.build_settings
  # A new bundle id: VenTrack is a separate App Store product from 6ix Sense, not
  # an update to it, so it must not reuse com.voice2jobs.6ixsense.
  # Changing this from com.voice2jobs.pulseuk likewise makes VenTrack a distinct
  # product rather than an update to the old one, which is the point: it ships
  # as its own App Store listing with its own installs and reviews.
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.voice2jobs.ventrackuk'
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  # Both of these, not just SDKROOT.
  #
  # `new_target(..., :ios, ...)` sets SDKROOT to iphoneos and stops there, which
  # is enough for Xcode to open the project and not enough for it to work out
  # what the scheme can run on. xcodebuild fails the destination lookup with
  # "Supported platforms for the buildables in the current scheme is empty" and
  # never reaches the compiler, so it reads like a broken project rather than a
  # missing build setting.
  #
  # Simulator is listed first because that is what a build here is normally for.
  s['SDKROOT'] = 'iphoneos'
  s['SUPPORTED_PLATFORMS'] = 'iphonesimulator iphoneos'
  # An iPhone-only app has no business offering either of these, and leaving
  # them unset lets Xcode infer a Mac destination that then fails to build.
  s['SUPPORTS_MACCATALYST'] = 'NO'
  s['SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD'] = 'NO'
  s['INFOPLIST_FILE'] = 'VenTrack/Info.plist'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  s['SWIFT_VERSION'] = '5.0'
  # iPhone only.
  #
  # This used to be '1,2', and the comment here warned it had to stay that way.
  # The reason was specific: the app carried a regular-width sidebar layout in
  # Views/iPad, and shipping as iPhone-only made iPadOS run it in scaled-iPhone
  # compatibility mode so that layout never activated. A reviewer on an iPad Air
  # 11-inch saw a blown-up phone app, and 6ix Sense build 1.0 (1) was rejected
  # under Guideline 4, Design.
  #
  # That warning does not apply now, because the thing it was protecting is
  # gone. Views/iPad has been deleted and RootView no longer branches on size
  # class, so there is no iPad layout left to fail to activate. What ships is a
  # plainly iPhone-only app, which is a normal and accepted configuration and
  # runs on iPad in compatibility mode by design rather than by accident.
  #
  # The rejection risk that remains is not this setting, it is claiming iPad
  # support the app does not honour. So if iPad support is ever restored, put
  # BOTH back together: the layout and this value. Half of the pair is what got
  # the sibling app rejected.
  s['TARGETED_DEVICE_FAMILY'] = '1'        # iPhone only
  s['CODE_SIGN_STYLE'] = 'Automatic'
  # NOTE: do NOT force CODE_SIGNING_ALLOWED=NO here. It breaks signing in the
  # Xcode UI. For headless simulator builds pass it on the command line instead:
  #   xcodebuild ... CODE_SIGNING_ALLOWED=NO
  # Voice2Jobs team. Kept here so regenerating the project doesn't blank the
  # signing team and break archiving; override with DEV_TEAM=... if needed.
  s['DEVELOPMENT_TEAM'] = ENV['DEV_TEAM'] || 'CRLGA87MAF'
  s['ENABLE_PREVIEWS'] = 'YES'
  s['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  s['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = ''
  # A UK-market app: default to British English rather than the US default.
  s['DEVELOPMENT_LANGUAGE'] = 'en-GB'
end

project.save
puts "Generated #{proj_path}"
