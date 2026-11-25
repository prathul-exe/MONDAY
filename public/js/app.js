const App = {
  appVersion: '1.0.0',
  currentUser: null,
  currentRoute: 'dashboard',
  isLoading: true,

  async init() {
    try {
      this.initCapacitorBridge();
      this.checkAppVersion();
      const token = typeof TokenStorage !== 'undefined'
        ? await TokenStorage.init()
        : localStorage.getItem('monday_token');
      if (!token) {
        this.showOnboarding();
        return;
      }

      try {
        const user = await API.get('/auth/me');
        this.currentUser = user;
        this.applyStoredTheme();
        this.showApp();
      } catch (e) {
        if (typeof TokenStorage !== 'undefined') await TokenStorage.remove();
        else localStorage.removeItem('monday_token');
        this.showOnboarding();
      }
    } catch (e) {
      console.error('App init error:', e);
      this.showOnboarding();
    } finally {
      this.isLoading = false;
      const ls = document.getElementById('loading-screen');
      if (ls) ls.remove();
    }
  },

  applyStoredTheme() {
    const theme = localStorage.getItem('monday_theme') || 'light';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  showOnboarding() {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = OnboardingComponent.render();
    OnboardingComponent.attachEvents();
  },

  async showApp() {
    Router.init();
    const initial = window.location.hash.slice(1) || 'dashboard';
    Router.navigate(initial);
  },

  async refreshUser() {
    try {
      const user = await API.get('/auth/me');
      this.currentUser = user;
      return user;
    } catch (e) {
      console.error('Failed to refresh user:', e);
      return null;
    }
  },

  logout() {
    AuthService.logout();
  },

  showToast(message, type = 'success') {
    Helpers.showToast(message, type);
  },

  initCapacitorBridge() {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform?.()) return;

    // Android hardware back button handling
    const capApp = window.Capacitor.Plugins?.App;
    if (capApp) {
      capApp.addListener('backButton', ({ canGoBack }) => {
        const hash = window.location.hash.slice(1) || 'dashboard';
        if (canGoBack && hash !== 'dashboard') {
          window.history.back();
        } else {
          capApp.exitApp();
        }
      });
    }

    // Request runtime notification permission on Android 13+ when needed
    const localNotifs = window.Capacitor.Plugins?.LocalNotifications;
    if (localNotifs) {
      localNotifs.checkPermissions().then(status => {
        if (status?.display === 'prompt') {
          localNotifs.requestPermissions().catch(() => {});
        }
      }).catch(() => {});
    }
  },

  async checkAppVersion() {
    try {
      const info = await API.get(`/system/version?currentVersion=${encodeURIComponent(this.appVersion)}`);
      if (!info || (!info.updateAvailable && !info.forceUpdate)) return;
      if (document.getElementById('app-update-banner')) return;

      const banner = document.createElement('div');
      banner.id = 'app-update-banner';
      banner.className = 'fixed top-2 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-2rem)] max-w-md bg-inverse-surface text-inverse-on-surface rounded-2xl px-4 py-3 shadow-xl flex items-center justify-between gap-3';
      banner.innerHTML = `
        <div class="min-w-0">
          <p class="font-headline-sm text-xs font-semibold">${info.forceUpdate ? 'Update Required' : 'Update Available'} (v${Helpers.escapeHtml(info.latestAppVersion)})</p>
          <p class="font-body-sm text-[11px] opacity-80 truncate">${Helpers.escapeHtml(info.releaseNotes || '')}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <a href="${Helpers.escapeHtml(info.playStoreUrl)}" target="_blank" rel="noopener" class="px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-tag text-[11px] font-semibold">Update</a>
          ${info.forceUpdate ? '' : '<button id="dismiss-update-banner" class="text-xs opacity-70 hover:opacity-100">&times;</button>'}
        </div>
      `;
      document.body.appendChild(banner);
      document.getElementById('dismiss-update-banner')?.addEventListener('click', () => banner.remove());
    } catch (_) {
      // Non-blocking check
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
