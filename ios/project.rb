# Generates Pulse.xcodeproj from the Swift sources.
# Run:  ruby project.rb       (requires the `xcodeproj` gem, bundled with Xcode tools)
require 'xcodeproj'

ROOT = __dir__
proj_path = File.join(ROOT, 'Pulse.xcodeproj')
project = Xcodeproj::Project.new(proj_path)

target = project.new_target(:application, 'Pulse', :ios, '17.0')

# Add the source group + all Swift files
group = project.main_group.new_group('Pulse', 'Pulse')
Dir.glob(File.join(ROOT, 'Pulse', '**', '*.swift')).sort.each do |f|
  ref = group.new_reference(f)
  target.add_file_references([ref])
end

# Info.plist reference (not compiled)
group.new_reference(File.join(ROOT, 'Pulse', 'Info.plist'))

# Asset catalog (app icon), added as a resource so the xcassets is compiled.
assets = group.new_reference(File.join(ROOT, 'Pulse', 'Assets.xcassets'))
target.add_resources([assets])

# Build settings on every configuration
target.build_configurations.each do |config|
  s = config.build_settings
  # A new bundle id: Pulse is a separate App Store product from 6ix Sense, not
  # an update to it, so it must not reuse com.voice2jobs.6ixsense.
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.voice2jobs.pulseuk'
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = 'Pulse/Info.plist'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  s['SWIFT_VERSION'] = '5.0'
  # iPhone + iPad. Must stay '1,2': shipping as iPhone-only ('1') makes iPadOS
  # run the app in scaled-iPhone compatibility mode, so the regular-width
  # sidebar layout in Views/iPad never activates. That is what got 6ix Sense
  # build 1.0 (1) rejected under Guideline 4, Design (reviewed on an iPad Air
  # 11-inch); Pulse inherits the same layout and the same requirement.
  s['TARGETED_DEVICE_FAMILY'] = '1,2'      # iPhone + iPad
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
