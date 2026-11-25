const SettingsComponent = {
  settings: null,
  calendar: null,

  render() {
    const user = App.currentUser || {};
    const initials = (user.full_name || 'U').charAt(0).toUpperCase();

    return `
      ${NavigationComponent.renderHeader('Settings & Preferences', true, false, false)}
      <main class="flex-1 flex flex-col relative w-full max-w-lg mx-auto px-gutter pt-4 pb-28 bg-surface">
        <div class="flex flex-col w-full space-y-4">
          <!-- Profile Summary Card -->
          <div class="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
            <div class="flex items-center gap-space-md">
              <div class="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline-lg text-2xl font-bold shrink-0">
                ${Helpers.escapeHtml(initials)}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <h2 id="set-profile-name" class="font-headline-sm text-headline-sm text-on-surface truncate">${Helpers.escapeHtml(user.full_name || 'Student')}</h2>
                  <button id="btn-edit-profile" class="px-2.5 py-1 rounded-full bg-surface-container-low text-on-surface text-label-tag font-label-tag uppercase tracking-wider hover:bg-surface-container transition-colors">Edit</button>
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${Helpers.escapeHtml(user.department || 'General')} • Sem ${user.semester || 1}</p>
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                  ${user.student_id ? `<span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface text-label-code font-label-code">ID: ${Helpers.escapeHtml(user.student_id)}</span>` : ''}
                  <span class="px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant text-label-tag font-label-tag">${Helpers.escapeHtml(user.email || '')}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Academic & Attendance Rules -->
          <div class="rounded-xl bg-surface-container-lowest p-space-md shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[20px]">tune</span>
                <h3 class="font-headline-sm text-headline-sm text-on-surface">Academic &amp; Attendance Rules</h3>
              </div>
              <span class="text-label-tag font-label-tag text-on-surface-variant uppercase tracking-wider">Policies</span>
            </div>

            <div class="rounded-xl bg-surface-container-low p-space-md space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-headline-sm text-headline-sm text-on-surface">Minimum Attendance Required</p>
                  <p class="font-body-sm text-body-sm text-on-surface-variant">Default regulatory benchmark</p>
                </div>
                <span id="threshold-val" class="font-label-numeric text-label-numeric text-primary">75%</span>
              </div>
              <div class="space-y-1.5">
                <input id="threshold-range" class="w-full h-1.5 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-primary focus:outline-none" max="90" min="60" step="1" type="range" value="75">
                <div class="flex justify-between font-label-tag text-label-tag text-on-surface-variant">
                  <span>60% (Lenient)</span>
                  <span class="text-secondary font-medium">75% Standard</span>
                  <span>90% (Strict)</span>
                </div>
              </div>
              <div id="threshold-hint" class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-container text-body-sm font-body-sm text-on-surface">
                <span class="material-symbols-outlined text-[16px] text-secondary">info</span>
                <span>Standard university minimum. Warning triggered below threshold.</span>
              </div>
            </div>

            <div class="flex items-center justify-between py-1">
              <div class="pr-3">
                <p class="font-body-lg text-body-lg text-on-surface font-medium">Smart Buffer Warnings</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">Alert when remaining safe misses drop below 2 lectures</p>
              </div>
              <button id="toggle-buffer" aria-checked="true" class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-primary transition-colors focus:outline-none" role="switch">
                <span class="inline-block h-5 w-5 transform translate-x-5 rounded-full bg-on-primary transition-transform shadow-sm mt-0.5"></span>
              </button>
            </div>
          </div>

          <!-- Academic Calendar Dates -->
          <div class="rounded-xl bg-surface-container-lowest p-space-md shadow-sm space-y-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">date_range</span>
              <h3 class="font-headline-sm text-headline-sm text-on-surface">Semester Calendar</h3>
            </div>
            <form id="calendar-form" class="space-y-2.5">
              <input id="cal-name" type="text" placeholder="Semester Name (e.g., Fall 2026)" class="w-full rounded-xl bg-surface-container-low px-3 py-2 text-sm text-on-surface">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">Start Date</label>
                  <input id="cal-start" type="date" class="w-full rounded-xl bg-surface-container-low px-3 py-2 text-sm text-on-surface">
                </div>
                <div>
                  <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">End Date</label>
                  <input id="cal-end" type="date" class="w-full rounded-xl bg-surface-container-low px-3 py-2 text-sm text-on-surface">
                </div>
              </div>
              <button type="submit" class="w-full py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-code text-xs font-semibold">Save Semester Dates</button>
            </form>
          </div>

          <!-- Adaptive Alerts -->
          <div class="rounded-xl bg-surface-container-lowest p-space-md shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[20px]">notifications_active</span>
                <h3 class="font-headline-sm text-headline-sm text-on-surface">Adaptive Alerts</h3>
              </div>
              <span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-label-tag font-label-tag">Active</span>
            </div>
            <div class="p-3 rounded-xl bg-error-container text-on-error-container flex items-start justify-between gap-3">
              <div class="flex items-start gap-2.5">
                <span class="material-symbols-outlined text-[20px] text-error mt-0.5">warning</span>
                <div>
                  <p class="font-headline-sm text-headline-sm text-on-error-container">Critical Shortage Alert</p>
                  <p class="font-body-sm text-body-sm text-on-error-container/80">Highlight courses when attendance falls below minimum threshold.</p>
                </div>
              </div>
              <button id="toggle-critical" aria-checked="true" class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-error transition-colors focus:outline-none mt-1" role="switch">
                <span class="inline-block h-5 w-5 transform translate-x-5 rounded-full bg-on-error transition-transform shadow-sm mt-0.5"></span>
              </button>
            </div>
          </div>

          <!-- App & Privacy / Account -->
          <div class="rounded-xl bg-surface-container-lowest p-space-md shadow-sm space-y-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">shield</span>
              <h3 class="font-headline-sm text-headline-sm text-on-surface">Account &amp; Data</h3>
            </div>
            <button id="btn-reset-records" class="w-full py-2.5 px-3 rounded-xl bg-surface-container-low text-error font-label-code text-label-code flex items-center justify-center gap-2 hover:bg-error-container/40 transition-colors">
              <span class="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Reset All Attendance Records</span>
            </button>
            <button id="btn-delete-account" class="w-full py-2.5 px-3 rounded-xl bg-error-container/40 text-on-error-container font-label-code text-label-code flex items-center justify-center gap-2 hover:bg-error-container transition-colors">
              <span class="material-symbols-outlined text-[16px]">delete_forever</span>
              <span>Delete Account &amp; Data</span>
            </button>
            <button id="btn-logout" class="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-label-code text-label-code font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
              <span class="material-symbols-outlined text-[18px]">logout</span>
              <span>Sign Out</span>
            </button>
            <div class="flex items-center justify-center gap-4 pt-1 text-xs text-on-surface-variant">
              <a href="/privacy" target="_blank" class="underline hover:text-on-surface">Privacy Policy</a>
              <a href="/terms" target="_blank" class="underline hover:text-on-surface">Terms of Service</a>
            </div>
          </div>
        </div>
      </main>

      <!-- Edit Profile Modal -->
      <div id="profile-modal" class="fixed inset-0 z-[100] hidden items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-surface-container-lowest w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Edit Profile</h3>
            <button id="close-profile-modal" class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">close</span></button>
          </div>
          <form id="profile-form" class="space-y-3">
            <input id="prof-name" required type="text" placeholder="Full Name" value="${Helpers.escapeHtml(user.full_name || '')}" class="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 text-on-surface">
            <input id="prof-dept" type="text" placeholder="Department" value="${Helpers.escapeHtml(user.department || '')}" class="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 text-on-surface">
            <div class="grid grid-cols-2 gap-2">
              <input id="prof-id" type="text" placeholder="Student ID" value="${Helpers.escapeHtml(user.student_id || '')}" class="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 text-on-surface">
              <input id="prof-sem" type="number" min="1" max="12" placeholder="Semester" value="${user.semester || 1}" class="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 text-on-surface">
            </div>
            <button type="submit" class="w-full py-3 rounded-xl bg-primary text-on-primary font-label-tag uppercase font-semibold">Save Profile</button>
          </form>
        </div>
      </div>
    `;
  },

  async init() {
    this.attachEvents();
    await this.loadData();
  },

  async loadData() {
    try {
      const [settings, calData] = await Promise.all([
        API.get('/settings'),
        API.get('/calendar').catch(() => ({ calendar: null }))
      ]);
      this.settings = settings;
      this.calendar = calData.calendar;

      const slider = document.getElementById('threshold-range');
      const display = document.getElementById('threshold-val');
      if (slider && display) {
        slider.value = settings.min_attendance_threshold || 75;
        display.textContent = `${slider.value}%`;
        this.updateSliderHint(slider.value);
      }

      this.setToggleUI('toggle-buffer', !!settings.smart_buffer_warnings, 'bg-primary');
      this.setToggleUI('toggle-critical', !!settings.critical_shortage_alert, 'bg-error');

      if (this.calendar) {
        document.getElementById('cal-name').value = this.calendar.semester_name || '';
        document.getElementById('cal-start').value = this.calendar.start_date || '';
        document.getElementById('cal-end').value = this.calendar.end_date || '';
      }
    } catch (err) {
      Helpers.showToast(err.message || 'Failed to load settings', 'error');
    }
  },

  setToggleUI(id, checked, activeBg) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.setAttribute('aria-checked', String(checked));
    const knob = btn.querySelector('span');
    if (checked) {
      btn.classList.remove('bg-surface-container-highest');
      btn.classList.add(activeBg);
      knob.classList.remove('translate-x-0.5');
      knob.classList.add('translate-x-5');
    } else {
      btn.classList.remove('bg-primary', 'bg-error');
      btn.classList.add('bg-surface-container-highest');
      knob.classList.remove('translate-x-5');
      knob.classList.add('translate-x-0.5');
    }
  },

  updateSliderHint(val) {
    const hint = document.getElementById('threshold-hint');
    if (!hint) return;
    if (val < 70) {
      hint.innerHTML = '<span class="material-symbols-outlined text-[16px] text-error">warning</span><span class="text-error">Lenient threshold: High risk of department debarment.</span>';
    } else if (val > 80) {
      hint.innerHTML = '<span class="material-symbols-outlined text-[16px] text-secondary">verified</span><span>Strict setting: Highest safety margin.</span>';
    } else {
      hint.innerHTML = '<span class="material-symbols-outlined text-[16px] text-secondary">info</span><span>Standard university minimum. Warning triggered below threshold.</span>';
    }
  },

  attachEvents() {
    const slider = document.getElementById('threshold-range');
    const display = document.getElementById('threshold-val');
    if (slider && display) {
      slider.addEventListener('input', (e) => {
        display.textContent = e.target.value + '%';
        this.updateSliderHint(e.target.value);
      });
      slider.addEventListener('change', async (e) => {
        try {
          await API.put('/settings', { min_attendance_threshold: parseFloat(e.target.value) });
          Helpers.showToast('Threshold updated');
        } catch (err) {
          Helpers.showToast(err.message, 'error');
        }
      });
    }

    document.getElementById('toggle-buffer')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const next = btn.getAttribute('aria-checked') !== 'true';
      this.setToggleUI('toggle-buffer', next, 'bg-primary');
      await API.put('/settings', { smart_buffer_warnings: next });
      Helpers.showToast('Preference saved');
    });

    document.getElementById('toggle-critical')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const next = btn.getAttribute('aria-checked') !== 'true';
      this.setToggleUI('toggle-critical', next, 'bg-error');
      await API.put('/settings', { critical_shortage_alert: next });
      Helpers.showToast('Preference saved');
    });

    document.getElementById('calendar-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await API.put('/calendar', {
          semester_name: document.getElementById('cal-name').value.trim() || 'Current Semester',
          start_date: document.getElementById('cal-start').value,
          end_date: document.getElementById('cal-end').value
        });
        Helpers.showToast('Semester dates saved');
      } catch (err) {
        Helpers.showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-reset-records')?.addEventListener('click', async () => {
      const ok = await Helpers.confirm('Reset Attendance', 'This will permanently delete all your attendance records. Continue?', 'Reset All');
      if (!ok) return;
      try {
        await API.post('/settings/reset-attendance', {});
        Helpers.showToast('All attendance records reset');
      } catch (err) {
        Helpers.showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
      const ok = await Helpers.confirm('Delete Account', 'Permanently delete your account and ALL subjects, attendance logs, deadlines, and timetable data? This cannot be undone.', 'Delete Forever');
      if (!ok) return;
      try {
        await API.delete('/auth/me');
        Helpers.showToast('Account deleted');
        AuthService.logout();
      } catch (err) {
        Helpers.showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => AuthService.logout());

    const profModal = document.getElementById('profile-modal');
    document.getElementById('btn-edit-profile')?.addEventListener('click', () => {
      profModal?.classList.remove('hidden');
      profModal?.classList.add('flex');
    });
    document.getElementById('close-profile-modal')?.addEventListener('click', () => {
      profModal?.classList.add('hidden');
      profModal?.classList.remove('flex');
    });
    document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await AuthService.updateProfile({
          full_name: document.getElementById('prof-name').value.trim(),
          department: document.getElementById('prof-dept').value.trim(),
          student_id: document.getElementById('prof-id').value.trim(),
          semester: parseInt(document.getElementById('prof-sem').value) || 1
        });
        Helpers.showToast('Profile updated');
        profModal?.classList.add('hidden');
        profModal?.classList.remove('flex');
        Router.navigate('settings');
      } catch (err) {
        Helpers.showToast(err.message, 'error');
      }
    });
  }
};
