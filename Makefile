SIMULATOR ?= iPhone 17
DERIVED_DATA ?= build/DerivedData
IOS_APP ?= $(DERIVED_DATA)/Build/Products/Debug-iphonesimulator/App.app
IOS_BUNDLE_ID ?= com.digitaltolk.ex.mobile

.PHONY: check ios ios-build ios-open

check:
	npm run lint
	npm run coverage

ios-build:
	npm run build
	npx capacitor sync ios
	xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'platform=iOS Simulator,name=$(SIMULATOR)' -derivedDataPath $(DERIVED_DATA) build

ios: ios-build
	xcrun simctl boot "$(SIMULATOR)" || true
	open -a Simulator
	xcrun simctl install "$(SIMULATOR)" "$(IOS_APP)"
	xcrun simctl launch "$(SIMULATOR)" "$(IOS_BUNDLE_ID)"

ios-open:
	npm run build
	npx capacitor sync ios
	npx capacitor open ios
