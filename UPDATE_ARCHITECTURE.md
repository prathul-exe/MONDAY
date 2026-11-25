# Scalable Update & Deployment Architecture — MONDAY

## 1. Separation of Frontend & Backend
- **Frontend (`public/` or future Capacitor/Flutter Android shell)**: Responsible strictly for rendering the Stitch UI, capturing user input, and caching local state.
- **Backend (`server.js`, `routes/`, `services/attendance-engine.js`, and `supabase/`)**: Owns all business logic, attendance percentage calculations, safe-bunk limits, recovery paths, deadline projections, and notification generation.
- **Benefit**: Updating calculation rules, thresholds, warning logic, or API responses on the server immediately takes effect for all installed users without requiring an APK/AAB reinstall.

## 2. API Versioning & Backward Compatibility
- All endpoints are exposed under both `/api/v1/*` (versioned) and `/api/*` (legacy/current alias) in `server.js`.
- Future breaking changes must be introduced under `/api/v2/*` while keeping `/api/v1/*` operational for older mobile builds until `MIN_SUPPORTED_APP_VERSION` is raised.

## 3. Version Checking & Google Play-Compliant Update Prompts
- `GET /api/system/version?currentVersion=<semver>` compares the client's `APP_VERSION` against `LATEST_APP_VERSION` and `MIN_SUPPORTED_APP_VERSION` environment variables.
- When `updateAvailable` is `true`, the client displays a non-blocking update banner linking to `PLAY_STORE_URL`.
- When `forceUpdate` is `true` (e.g., an old client below `MIN_SUPPORTED_APP_VERSION`), the client prompts the user to update via the official Google Play Store listing.
- **Policy Compliance**: Native app binaries are distributed exclusively through Google Play Store (`.aab`). The app never downloads or sideloads APKs or executable native code.

## 4. Capacitor-Compatible Live Updates (Web Assets Only)
When packaging `public/` with **Capacitor** for Android (`.aab`):
- **Eligible Assets**: Only static web bundle files (`HTML`, `CSS`, `JS` UI assets) may use a Capacitor-compatible live update channel (e.g., Ionic Appflow Live Updates or Capgo with cryptographic bundle signing) to deliver UI fixes without a full Play Store review.
- **Strict Constraints**:
  - Live updates must **never** alter native Android permissions, plugins, or executable code.
  - All live update bundles must be integrity-verified (signed) and served over HTTPS.
  - Native plugin/SDK changes or major feature releases must always be shipped as a signed `.aab` through Google Play Console.

## 5. Android APK / AAB Release Process
1. Bump `APP_VERSION` in the mobile client and `LATEST_APP_VERSION` in the backend `.env` / hosting config.
2. Build the web bundle (`public/`) and sync into Capacitor (`npx cap sync android`).
3. Generate a signed Android App Bundle (`./gradlew bundleRelease`) and upload to Google Play Console (Internal -> Closed -> Production track).
4. Once the Play Store release is live, update `LATEST_APP_VERSION` on the backend so existing users receive the update notification.

## 6. Backward-Compatible Database Migrations
- `database/migrate.js` tracks applied migrations in `schema_migrations`.
- All schema changes must follow the **Expand-and-Contract** pattern:
  1. **Expand**: Add new nullable columns or columns with `DEFAULT` values; add new tables/indexes. Never rename or drop columns that older app versions still query.
  2. **Migrate**: Backfill data safely in idempotent steps.
  3. **Contract**: Only remove deprecated columns/endpoints after `MIN_SUPPORTED_APP_VERSION` guarantees no active client depends on them.
