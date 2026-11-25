/**
 * Runtime configuration for Web & Capacitor Android.
 * Update PRODUCTION_API_URL to your deployed HTTPS backend before building a release APK/AAB.
 */
const AppConfig = {
  APP_VERSION: '1.0.0',
  PRODUCTION_API_URL: 'https://api.monday-attendance.example.com/api/v1',
  DEV_ANDROID_API_URL: 'http://10.0.2.2:3000/api/v1',

  isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  },

  getApiBaseUrl() {
    if (window.MONDAY_API_URL) return window.MONDAY_API_URL;
    const saved = localStorage.getItem('monday_api_url');
    if (saved) return saved;
    if (!this.isNative()) return '/api/v1';
    // When running inside Capacitor Android, never default to localhost in production.
    // Use configured production URL unless overridden for local emulator testing.
    return this.PRODUCTION_API_URL;
  }
};

/**
 * Secure token storage: uses Android Keystore via SecureStoragePlugin on native,
 * and localStorage on web. Keeps an in-memory cache for synchronous header reads.
 */
const TokenStorage = {
  _token: null,

  async init() {
    const secure = window.Capacitor?.Plugins?.SecureStoragePlugin;
    if (AppConfig.isNative() && secure) {
      try {
        const res = await secure.get({ key: 'monday_token' });
        this._token = res?.value || null;
        return this._token;
      } catch (_) {
        this._token = null;
        return null;
      }
    }
    this._token = localStorage.getItem('monday_token');
    return this._token;
  },

  getSync() {
    return this._token || localStorage.getItem('monday_token');
  },

  async set(token) {
    this._token = token;
    const secure = window.Capacitor?.Plugins?.SecureStoragePlugin;
    if (AppConfig.isNative() && secure) {
      try {
        await secure.set({ key: 'monday_token', value: token });
        return;
      } catch (_) {
        // Fallback only if plugin unavailable
      }
    }
    localStorage.setItem('monday_token', token);
  },

  async remove() {
    this._token = null;
    localStorage.removeItem('monday_token');
    const secure = window.Capacitor?.Plugins?.SecureStoragePlugin;
    if (AppConfig.isNative() && secure) {
      try {
        await secure.remove({ key: 'monday_token' });
      } catch (_) {
        // Ignore if key not present
      }
    }
  }
};
