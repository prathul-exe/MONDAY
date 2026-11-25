const Router = {
    routes: {},
    currentRoute: null,

    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        // Also handle popstate for back/forward
        window.addEventListener('popstate', () => this.handleRoute());
    },

    register(path, handler) {
        this.routes[path] = handler;
    },

    navigate(path, params = {}) {
        window.location.hash = path;
        this.currentRoute = path;
        this.handleRoute(params);
    },

    handleRoute(params = {}) {
        const hash = window.location.hash.slice(1) || 'dashboard';
        const [route, ...rest] = hash.split('/');
        const routeParams = rest.length > 0 ? { id: rest[0], ...params } : params;

        this.currentRoute = route;

        const app = document.getElementById('app');
        if (!app) return;

        // Check auth
        if (!AuthService.isAuthenticated() && route !== 'login' && route !== 'register') {
            App.showOnboarding();
            return;
        }

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
            requestAnimationFrame(() => {
                callback();
            });
        });
    }
};
