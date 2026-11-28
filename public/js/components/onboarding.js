const OnboardingComponent = {
  view: 'welcome', // 'welcome' | 'login' | 'register'

  arrowForwardSvg(cls = 'w-5 h-5') {
    return `<svg aria-hidden="true" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
  },

  arrowBackSvg(cls = 'w-[22px] h-[22px]') {
    return `<svg aria-hidden="true" class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>`;
  },

  render() {
    if (this.view === 'login') return this.renderLogin();
    if (this.view === 'register') return this.renderRegister();
    return this.renderWelcome();
  },

  renderWelcome() {
    return `
      <main class="flex-1 flex flex-col relative w-full max-w-lg mx-auto px-gutter bg-surface justify-center min-h-screen">
        <div class="flex flex-col w-full pb-8 select-none">
          <!-- Top Brand Mark Header -->
          <div class="flex items-center justify-between pt-4 pb-2">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></div>
              <span class="font-headline-lg-mobile text-headline-lg-mobile font-semibold tracking-tighter text-on-surface">MONDAY<span class="text-secondary font-bold">.</span></span>
            </div>
            <span class="font-label-tag text-label-tag uppercase tracking-widest px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-medium">v1.0.0</span>
          </div>

          <!-- Hero Typography Section -->
          <div class="flex flex-col gap-2.5 mt-4 mb-8">
            <h1 class="font-display-lg-mobile text-display-lg-mobile font-semibold tracking-tight text-on-surface leading-none">
              Your semester.<br/>
              <span class="text-on-surface-variant">Under control.</span>
            </h1>
            <p class="font-body-md text-body-md text-on-surface-variant max-w-sm leading-relaxed">
              Eliminate attendance anxiety, plan timetable, and track academic health with mathematical precision.
            </p>
          </div>

          <!-- Key Value Props Quick Micro Grid -->
          <div class="grid grid-cols-3 gap-2.5 mb-10">
            <div class="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1 items-start">
              <span class="material-symbols-outlined text-on-surface text-lg">calculate</span>
              <span class="font-label-code text-label-code text-on-surface font-semibold">Predictive</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant leading-tight">Formula-backed buffer counts</span>
            </div>
            <div class="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1 items-start">
              <span class="material-symbols-outlined text-on-surface text-lg">bolt</span>
              <span class="font-label-code text-label-code text-on-surface font-semibold">1-Tap Log</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant leading-tight">Quick swipe attendance tick</span>
            </div>
            <div class="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1 items-start">
              <span class="material-symbols-outlined text-on-surface text-lg">lock</span>
              <span class="font-label-code text-label-code text-on-surface font-semibold">Private</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant leading-tight">100% isolated user data</span>
            </div>
          </div>

          <!-- Bottom CTA Actions -->
          <div class="flex flex-col gap-3 mt-auto">
            <button id="btn-get-started" class="w-full bg-primary text-on-primary py-4 px-6 rounded-full font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all hover:bg-neutral-800" type="button">
              <span>Get Started</span>
              ${this.arrowForwardSvg('w-5 h-5')}
            </button>
            <button id="btn-go-signin" class="w-full py-3 px-6 rounded-full bg-transparent text-on-surface font-body-md text-body-md font-medium text-center hover:bg-surface-container-low transition-colors active:scale-[0.99]" type="button">
              Already have an account? <span class="font-semibold underline decoration-outline-variant underline-offset-4">Sign In</span>
            </button>
          </div>

          <!-- Privacy Notice -->
          <div class="flex items-center justify-center gap-1.5 mt-5 text-center">
            <span class="material-symbols-outlined text-outline text-sm">shield</span>
            <span class="font-body-sm text-body-sm text-outline">All attendance data is stored securely and privately.</span>
          </div>
        </div>
      </main>
    `;
  },

  renderLogin() {
    return `
      <main class="flex-1 flex flex-col relative w-full max-w-lg mx-auto px-gutter bg-surface py-6 min-h-screen">
        <div class="flex items-center justify-between mb-6">
          <button id="btn-back-welcome" aria-label="Back to welcome" class="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors" type="button">
            ${this.arrowBackSvg('w-[22px] h-[22px]')}
          </button>
          <span class="font-headline-sm text-headline-sm font-semibold tracking-tighter text-on-surface">MONDAY<span class="text-secondary font-bold">.</span></span>
          <div class="w-10"></div>
        </div>

        <div class="flex flex-col gap-2 mb-8">
          <h1 class="font-display-lg-mobile text-display-lg-mobile font-semibold tracking-tight text-on-surface">Welcome back.</h1>
          <p class="font-body-md text-body-md text-on-surface-variant">Sign in to access your attendance tracker.</p>
        </div>

        <form id="login-form" class="flex flex-col gap-4 flex-1">
          <div id="auth-error" class="hidden p-3 rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm"></div>

          <div>
            <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1.5" for="login-email">Email</label>
            <input id="login-email" type="email" required autocomplete="email" placeholder="student@university.edu"
              class="w-full rounded-xl bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-outline-variant border border-transparent focus:border-[#8FAFC9] focus:outline-none transition-all">
          </div>

          <div>
            <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1.5" for="login-password">Password</label>
            <div class="relative">
              <input id="login-password" type="password" required autocomplete="current-password" placeholder="Enter your password"
                class="w-full rounded-xl bg-surface-container-low px-4 py-3 pr-11 text-on-surface placeholder:text-outline-variant border border-transparent focus:border-[#8FAFC9] focus:outline-none transition-all">
              <button type="button" id="toggle-login-pw" class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                <span class="material-symbols-outlined text-[20px]">visibility</span>
              </button>
            </div>
          </div>

          <div class="rounded-xl bg-surface-container-low px-3.5 py-2.5 border border-surface-variant/60">
            <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Forgot password? Password recovery is not available in this version. Please keep your password safe.
            </p>
          </div>

          <div class="mt-auto pt-4 flex flex-col gap-3">
            <button id="login-submit-btn" type="submit" class="w-full bg-primary text-on-primary py-4 px-6 rounded-full font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all">
              <span>Sign In</span>
              <span class="material-symbols-outlined text-xl">login</span>
            </button>
            <button type="button" id="btn-switch-register" class="w-full py-3 px-6 rounded-full text-on-surface font-body-md text-body-md font-medium text-center hover:bg-surface-container-low transition-colors">
              Don't have an account? <span class="font-semibold underline decoration-outline-variant underline-offset-4">Register</span>
            </button>
          </div>
        </form>
      </main>
    `;
  },

  renderRegister() {
    return `
      <main class="flex-1 flex flex-col relative w-full max-w-lg mx-auto px-gutter bg-surface py-6 min-h-screen">
        <div class="flex items-center justify-between mb-5">
          <button id="btn-back-welcome" aria-label="Back to welcome" class="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors" type="button">
            ${this.arrowBackSvg('w-[22px] h-[22px]')}
          </button>
          <span class="font-headline-sm text-headline-sm font-semibold tracking-tighter text-on-surface">MONDAY<span class="text-secondary font-bold">.</span></span>
          <div class="w-10"></div>
        </div>

        <div class="flex flex-col gap-1.5 mb-6">
          <h1 class="font-display-lg-mobile text-display-lg-mobile font-semibold tracking-tight text-on-surface">Create Account</h1>
          <p class="font-body-md text-body-md text-on-surface-variant">Set up your semester profile to get started.</p>
        </div>

        <form id="register-form" class="flex flex-col gap-3.5 flex-1 pb-6">
          <div id="auth-error" class="hidden p-3 rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm"></div>

          <div>
            <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1" for="reg-name">Full Name</label>
            <input id="reg-name" type="text" required placeholder="Maya Lin"
              class="w-full rounded-xl bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-outline-variant border border-transparent focus:border-[#8FAFC9] focus:outline-none">
          </div>

          <div>
            <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1" for="reg-email">Email</label>
            <input id="reg-email" type="email" required placeholder="maya@university.edu"
              class="w-full rounded-xl bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-outline-variant border border-transparent focus:border-[#8FAFC9] focus:outline-none">
          </div>

          <div>
            <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1" for="reg-password">Password</label>
            <input id="reg-password" type="password" required minlength="6" placeholder="Minimum 6 characters"
              class="w-full rounded-xl bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-outline-variant border border-transparent focus:border-[#8FAFC9] focus:outline-none">
          </div>

          <div class="rounded-xl bg-surface-container-low px-3.5 py-2.5 border border-surface-variant/60">
            <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Important: Password recovery is not available in this version. Please keep your password safe.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1" for="reg-student-id">Student ID (Opt)</label>
              <input id="reg-student-id" type="text" placeholder="CS-2025-001"
                class="w-full rounded-xl bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-outline-variant border border-transparent focus:border-[#8FAFC9] focus:outline-none">
            </div>
            <div>
              <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1" for="reg-semester">Semester</label>
              <select id="reg-semester" class="w-full rounded-xl bg-surface-container-low px-4 py-3 text-on-surface border border-transparent focus:border-[#8FAFC9] focus:outline-none">
                ${[1,2,3,4,5,6,7,8].map(n => `<option value="${n}" ${n === 4 ? 'selected' : ''}>Semester ${n}</option>`).join('')}
              </select>
            </div>
          </div>

          <div>
            <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1" for="reg-dept">Department (Opt)</label>
            <input id="reg-dept" type="text" placeholder="Computer Science & Eng"
              class="w-full rounded-xl bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-outline-variant border border-transparent focus:border-[#8FAFC9] focus:outline-none">
          </div>

          <div class="mt-auto pt-3 flex flex-col gap-3">
            <button id="register-submit-btn" type="submit" class="w-full bg-primary text-on-primary py-4 px-6 rounded-full font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all">
              <span>Create Account</span>
              ${this.arrowForwardSvg('w-5 h-5')}
            </button>
            <button type="button" id="btn-switch-login" class="w-full py-2.5 px-6 rounded-full text-on-surface font-body-md text-body-md font-medium text-center hover:bg-surface-container-low transition-colors">
              Already have an account? <span class="font-semibold underline decoration-outline-variant underline-offset-4">Sign In</span>
            </button>
          </div>
        </form>
      </main>
    `;
  },

  rerender() {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = this.render();
      this.attachEvents();
    }
  },

  attachEvents() {
    document.getElementById('btn-get-started')?.addEventListener('click', () => {
      this.view = 'register';
      this.rerender();
    });
    document.getElementById('btn-go-signin')?.addEventListener('click', () => {
      this.view = 'login';
      this.rerender();
    });
    document.getElementById('btn-back-welcome')?.addEventListener('click', () => {
      this.view = 'welcome';
      this.rerender();
    });
    document.getElementById('btn-switch-register')?.addEventListener('click', () => {
      this.view = 'register';
      this.rerender();
    });
    document.getElementById('btn-switch-login')?.addEventListener('click', () => {
      this.view = 'login';
      this.rerender();
    });

    const togglePw = document.getElementById('toggle-login-pw');
    const loginPwInput = document.getElementById('login-password');
    if (togglePw && loginPwInput) {
      togglePw.addEventListener('click', () => {
        const isPw = loginPwInput.type === 'password';
        loginPwInput.type = isPw ? 'text' : 'password';
        togglePw.querySelector('span').textContent = isPw ? 'visibility_off' : 'visibility';
      });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('auth-error');
        const btn = document.getElementById('login-submit-btn');
        errEl.classList.add('hidden');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-xl">progress_activity</span><span>Signing In...</span>';
        try {
          const email = document.getElementById('login-email').value.trim();
          const password = document.getElementById('login-password').value;
          await AuthService.login(email, password);
          Helpers.showToast('Signed in successfully');
          App.showApp();
        } catch (err) {
          errEl.textContent = err.message || 'Sign in failed';
          errEl.classList.remove('hidden');
          btn.disabled = false;
          btn.innerHTML = '<span>Sign In</span><span class="material-symbols-outlined text-xl">login</span>';
        }
      });
    }

    const regForm = document.getElementById('register-form');
    if (regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('auth-error');
        const btn = document.getElementById('register-submit-btn');
        errEl.classList.add('hidden');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-xl">progress_activity</span><span>Creating Account...</span>';
        try {
          const name = document.getElementById('reg-name').value.trim();
          const email = document.getElementById('reg-email').value.trim();
          const password = document.getElementById('reg-password').value;
          const studentId = document.getElementById('reg-student-id').value.trim();
          const dept = document.getElementById('reg-dept').value.trim();
          const sem = document.getElementById('reg-semester').value;
          await AuthService.register(name, email, password, studentId, dept, sem);
          Helpers.showToast('Account created!');
          App.showApp();
        } catch (err) {
          errEl.textContent = err.message || 'Registration failed';
          errEl.classList.remove('hidden');
          btn.disabled = false;
          btn.innerHTML = `<span>Create Account</span>${this.arrowForwardSvg('w-5 h-5')}`;
        }
      });
    }
  }
};
