const Router = {
    routes: {},
    currentRoute: null,
    _initialized: false,
    _pendingNavigation: null,
    _activeHash: null,

    _normalizeHash(hash) {
        return String(hash || '').replace(/^#/, '');
    },

    _hashFromUrl(url) {
        if (!url) return '';
        const idx = url.indexOf('#');
        return idx === -1 ? '' : url.slice(idx + 1);
    },

    init() {
        if (this._initialized) return;
        this._initialized = true;
        window.addEventListener('hashchange', (event) => {
            const liveHash = this._normalizeHash(window.location.hash);
            if (event && event.newURL !== undefined && this._hashFromUrl(event.newURL) !== liveHash) {
                return;
            }
            let params = {};
            if (this._pendingNavigation && this._pendingNavigation.hash === liveHash) {
                params = this._pendingNavigation.params || {};
                this._pendingNavigation = null;
            }
            this.handleRoute(params);
        });
    },

    register(path, handler) {
        this.routes[path] = handler;
    },

    navigate(path, params = {}) {
        const target = this._normalizeHash(path);
        const current = this._normalizeHash(window.location.hash);
        this.currentRoute = target.split('/')[0] || 'dashboard';
        if (current === target) {
            this._pendingNavigation = null;
            if (this._activeHash === target && Object.keys(params).length === 0) {
                return;
            }
            this.handleRoute(params);
            return;
        }
        this._pendingNavigation = { hash: target, params };
        window.location.hash = target;
    },

    handleRoute(params = {}) {
        const hash = this._normalizeHash(window.location.hash) || 'dashboard';
        const [route, ...rest] = hash.split('/');
        const routeParams = rest.length > 0 ? { id: rest[0], ...params } : params;

        this.currentRoute = route;

        const app = document.getElementById('app');
        if (!app) return;

        // Check auth
        if (!AuthService.isAuthenticated() && route !== 'login' && route !== 'register') {
            this._activeHash = null;
            App.showOnboarding();
            return;
        }

        this._activeHash = this._normalizeHash(window.location.hash) || 'dashboard';

        // Build page with header + content + nav
        let content = '';

        switch(route) {
            case 'dashboard':
                content = DashboardComponent.render();
                this.afterRender(() => DashboardComponent.init());
                break;
            case 'subject':
                content = SubjectDetailComponent.render(routeParams.id || rest[0]);
                this.afterRender(() => SubjectDetailComponent.init(routeParams.id || rest[0]));
                break;
            case 'deadlines':
                content = DeadlinesComponent.render();
                this.afterRender(() => DeadlinesComponent.init());
                break;
            case 'timetable':
                content = TimetableComponent.render();
                this.afterRender(() => TimetableComponent.init());
                break;
            case 'settings':
                content = SettingsComponent.render();
                this.afterRender(() => SettingsComponent.init());
                break;
            default:
                content = DashboardComponent.render();
                this.afterRender(() => DashboardComponent.init());
        }

        app.innerHTML = content;
    },

    afterRender(callback) {
        requestAnimationFrame(() => {
            callback();
        });
    }
};
