const App = {
  currentUser: null,
  currentRoute: 'dashboard',
  isLoading: true,

  async init() {
    try {
      const token = localStorage.getItem('monday_token');
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
        localStorage.removeItem('monday_token');
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
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
