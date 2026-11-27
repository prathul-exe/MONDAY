const API = {
    get baseUrl() {
        return typeof AppConfig !== 'undefined' ? AppConfig.getApiBaseUrl() : '/api/v1';
    },

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'X-App-Version': typeof AppConfig !== 'undefined' ? AppConfig.APP_VERSION : '1.0.0'
        };
        const token = typeof TokenStorage !== 'undefined'
            ? TokenStorage.getSync()
            : localStorage.getItem('monday_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    async request(method, endpoint, data = null) {
        const baseUrl = this.baseUrl;
        if (
            typeof AppConfig !== 'undefined' &&
            AppConfig.isNative() &&
            baseUrl === AppConfig.PRODUCTION_API_URL.replace(/\/+$/, '') &&
            !AppConfig.isProductionConfigured()
        ) {
            throw new Error('Backend API URL is not configured. Deploy the backend and set AppConfig.PRODUCTION_API_URL to your HTTPS URL.');
        }

        const config = {
            method,
            headers: this.getHeaders(),
        };
        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        let response;
        try {
            response = await fetch(`${baseUrl}${endpoint}`, config);
        } catch (err) {
            throw new Error('Unable to reach the server. Check your internet connection and backend API URL.');
        }

        const isAuthEndpoint = endpoint === '/auth/login' || endpoint === '/auth/register' ||
            endpoint.startsWith('/auth/login?') || endpoint.startsWith('/auth/register?');

        if (response.status === 401 && !isAuthEndpoint) {
            if (typeof TokenStorage !== 'undefined') await TokenStorage.remove();
            else localStorage.removeItem('monday_token');
            window.location.reload();
            throw new Error('Session expired');
        }

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || result.message || `Request failed (${response.status})`);
        }

        return result;
    },

    get(endpoint) { return this.request('GET', endpoint); },
    post(endpoint, data) { return this.request('POST', endpoint, data); },
    put(endpoint, data) { return this.request('PUT', endpoint, data); },
    delete(endpoint) { return this.request('DELETE', endpoint); }
};
