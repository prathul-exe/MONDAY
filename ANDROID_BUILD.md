# Android Studio Build & Release Guide — Monday

This guide explains how to open the generated `android/` Capacitor project in **Android Studio** and build a signed APK or Android App Bundle (`.aab`).

---

## 1. Prerequisites

1. **Android Studio** (with Android SDK & JDK 17+ bundled).
2. **Hosted Backend**: Deploy the Express backend (`server.js`) and database (see `DEPLOYMENT.md` and `supabase/README.md`) to an HTTPS URL.
   > **Important**: The local SQLite database (`database/attendance.db`) on your PC is **not** shared across users' phones. For multi-user public releases, host the backend + cloud database (e.g., Supabase PostgreSQL or hosted Express + persistent DB) and set `PRODUCTION_API_URL` in `public/js/config.js` to your live HTTPS `/api/v1` URL before running `npm run cap:sync`.

---

## 2. Sync Web Assets to Android

Whenever you edit files in `public/`, run:
```bash
npm run cap:sync
```

---

## 3. Open in Android Studio

1. Open **Android Studio**.
2. Click **Open** and select the exact folder:
   `e:\Attendance_tracker\android`
3. Wait for Gradle sync to finish.
4. Connect an Android device (USB Debugging enabled) or start an Android Emulator, then click **Run** (`Shift+F10`).

---

## 4. Generate a Signed APK or Android App Bundle (`.aab`)

### Option A: Using Android Studio Wizard (Recommended)
1. In Android Studio, go to **Build → Generate Signed Bundle / APK...**.
2. Choose **Android App Bundle** (for Google Play Store) or **APK** (for direct testing).
3. Click **Create new...** to create a release keystore (`.jks`) **outside** the repository or in a gitignored path, and record your passwords safely.
4. Select the **release** build variant and finish.

### Option B: Using `android/keystore.properties` (Gitignored)
Create `android/keystore.properties` (never commit this file):
```properties
storeFile=C:/path/to/monday-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=monday
keyPassword=YOUR_KEY_PASSWORD
```
Then build via **Build → Build Bundle(s) / APK(s)** in Android Studio.
