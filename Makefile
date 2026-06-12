.PHONY: help setup ios android build-apk build-aab start-fallback clean typecheck ci test bench bench-assert verify readiness security-scan e2e lighthouse

help:
	@echo "🫀 Pulse MedPsy Weather Advisor - Command Directory"
	@echo "=================================================="
	@echo "Available commands:"
	@echo "  make setup            - Install dependencies and seed the database/manual"
	@echo "  make ios              - Build and run the real native iOS app (requires Xcode)"
	@echo "  make android          - Build and run the real native Android app"
	@echo "  make build-apk        - Build a standalone Android APK for sideloading"
	@echo "  make build-aab        - Build an Android App Bundle (AAB) for Play Store"
	@echo "  make start-fallback   - Run in Expo Go (simulated AI mode, no native modules)"
	@echo "  make clean            - Remove generated ios and android native directories"
	@echo "  make typecheck        - Verify TypeScript types"
	@echo "  make test             - Run Vitest unit & integration tests"
	@echo "  make ci               - Run linting, typechecking, and tests"
	@echo "  make e2e              - Run Playwright E2E tests"
	@echo "  make verify           - Run offline verification script"
	@echo "  make bench            - Run benchmarks"
	@echo "  make bench-assert     - Run benchmarks with assertion checks"
	@echo "  make readiness        - Run check submission readiness script"
	@echo "  make lighthouse       - Run Lighthouse audit"
	@echo "  make security-scan    - Run security scans"

setup:
	npm install
	python3 scripts/seed.py

ios:
	npm run ios

android:
	npm run android

build-apk:
	@echo "📦 Building Android Release APK..."
	npx expo prebuild --platform android
	cd android && ./gradlew assembleRelease
	@echo "✅ APK built at: android/app/build/outputs/apk/release/app-release.apk"

build-aab:
	@echo "📦 Building Android Release AAB..."
	npx expo prebuild --platform android
	cd android && ./gradlew bundleRelease
	@echo "✅ AAB built at: android/app/build/outputs/bundle/release/app-release.aab"

start-fallback:
	npm run start

clean:
	rm -rf ios android

typecheck:
	npm run typecheck

ci:
	npm run ci

test:
	npm run test

bench:
	npx tsx scripts/bench.ts

bench-assert:
	npx tsx scripts/bench.ts --assert

verify:
	python3 scripts/verify_offline.py

readiness:
	python3 scripts/check_submission_readiness.py

e2e:
	@echo "🎭 Running Playwright E2E tests (demo mode)..."
	npx playwright test

lighthouse:
	@echo "🔦 Running Lighthouse CI audit..."
	npx lhci autorun

security-scan:
	npx trufflehog filesystem . --only-verified 2>/dev/null || echo "Install trufflehog for secret scanning"
	npm audit --audit-level=high || true
