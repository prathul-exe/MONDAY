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
        const config = {
            method,
            headers: this.getHeaders(),
        };
        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, config);

        if (response.status === 401) {
            if (typeof TokenStorage !== 'undefined') await TokenStorage.remove();
            else localStorage.removeItem('monday_token');
            window.location.reload();
            throw new Error('Session expired');
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || result.message || 'Request failed');
        }

        return result;
    },

    get(endpoint) { return this.request('GET', endpoint); },
    post(endpoint, data) { return this.request('POST', endpoint, data); },
    put(endpoint, data) { return this.request('PUT', endpoint, data); },
    delete(endpoint) { return this.request('DELETE', endpoint); }
};
