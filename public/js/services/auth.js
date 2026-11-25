const AuthService = {
    async login(email, password) {
        const result = await API.post('/auth/login', { email, password });
        localStorage.setItem('monday_token', result.token);
        App.currentUser = result.user;
        return result;
    },

    async register(fullName, email, password, studentId, department, semester) {
        const result = await API.post('/auth/register', {
            full_name: fullName,
            email,
            password,
            student_id: studentId,
            department,
            semester: parseInt(semester) || 1
        });
        localStorage.setItem('monday_token', result.token);
        App.currentUser = result.user;
        return result;
    },

    logout() {
        localStorage.removeItem('monday_token');
        App.currentUser = null;
        App.showOnboarding();
    },

    isAuthenticated() {
        return !!localStorage.getItem('monday_token');
    },

    async updateProfile(data) {
        const result = await API.put('/auth/me', data);
        App.currentUser = result;
        return result;
    }
};
