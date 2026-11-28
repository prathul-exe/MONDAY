const DashboardComponent = {
  data: null,
  searchQuery: '',
  isSubmittingSubject: false,
  isMarkingAttendance: false,

  render() {
    const user = App.currentUser || {};
    const firstName = (user.full_name || 'Student').split(' ')[0];
    const semLabel = user.semester ? `Semester ${user.semester}` : 'Active Term';

    return `
      ${NavigationComponent.renderHeader('Home', false, true, true)}
      <main class="flex-1 flex flex-col relative w-full max-w-lg mx-auto px-gutter pt-4 pb-32 bg-surface">
        <div class="flex flex-col w-full gap-space-md">
          <!-- Greeting Section -->
          <section class="flex flex-col gap-space-xs pt-2">
            <div class="flex items-center justify-between">
              <span class="font-label-tag text-label-tag tracking-wider uppercase text-on-surface-variant flex items-center gap-1.5">
                <span class="inline-block w-1.5 h-1.5 rounded-full bg-secondary"></span>
                ${Helpers.escapeHtml(semLabel)}
              </span>
              <button id="btn-open-notifications" class="relative p-1.5 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant" title="Alerts">
                <span class="material-symbols-outlined text-[20px]">notifications</span>
                <span id="dash-notif-dot" class="hidden absolute top-1 right-1 w-2 h-2 rounded-full bg-error"></span>
              </button>
            </div>
            <div class="flex items-baseline justify-between mt-1">
              <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">${Helpers.getGreeting()}, ${Helpers.escapeHtml(firstName)}</h1>
            </div>
          </section>

          <!-- Overall Attendance Summary Card -->
          <section id="overall-hero-container">
            ${Helpers.loadingSpinner()}
          </section>

          <!-- Warnings Banner (if any) -->
          <section id="warnings-container" class="hidden flex-col gap-2"></section>

          <!-- Search & Add Subject Toolbar -->
          <section class="flex flex-col gap-space-md">
            <div class="flex items-center gap-2">
              <div class="flex-1 flex items-center gap-2 bg-surface-container-lowest rounded-xl px-3 py-2 shadow-sm ring-1 ring-surface-variant/40">
                <span class="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
                <input id="subject-search-input" class="bg-transparent font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none w-full" placeholder="Filter subjects..." type="text">
              </div>
              <button id="btn-add-subject-open" class="h-9 px-3.5 rounded-xl bg-primary text-on-primary font-label-code text-xs font-semibold flex items-center gap-1 shadow-sm active:scale-95 transition-transform shrink-0">
                <span class="material-symbols-outlined text-[16px]">add</span>
                <span>Subject</span>
              </button>
            </div>

            <!-- Subjects Cards List -->
            <div id="subjects-list-container" class="flex flex-col gap-space-sm"></div>
          </section>
        </div>
      </main>

      <!-- Add Subject Modal -->
      <div id="add-subject-modal" class="fixed inset-0 z-[100] hidden items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-surface-container-lowest w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between">
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Add Subject</h3>
            <button id="close-subject-modal" class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <form id="add-subject-form" class="space-y-3">
            <div>
              <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Subject Name *</label>
              <input id="subj-name" required type="text" placeholder="e.g., Data Structures" class="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-[#8FAFC9]">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Code *</label>
                <input id="subj-code" required type="text" placeholder="CS204" class="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 text-on-surface uppercase focus:outline-none focus:ring-2 focus:ring-[#8FAFC9]">
              </div>
              <div>
                <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Min Attendance %</label>
                <input id="subj-req" type="number" min="0" max="100" value="75" class="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-[#8FAFC9]">
              </div>
            </div>
            <div>
              <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Faculty Name (Optional)</label>
              <input id="subj-faculty" type="text" placeholder="Dr. Richard Torres" class="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-[#8FAFC9]">
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Credits</label>
                <input id="subj-credits" type="number" step="0.5" min="1" max="10" value="4" class="w-full rounded-xl bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none">
              </div>
              <div>
                <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Classes/Wk</label>
                <input id="subj-freq" type="number" min="1" max="14" value="3" class="w-full rounded-xl bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none">
              </div>
              <div>
                <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Room</label>
                <input id="subj-room" type="text" placeholder="LH-04" class="w-full rounded-xl bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none">
              </div>
            </div>
            <div class="pt-2 flex gap-2">
              <button type="button" id="cancel-subject-modal" class="flex-1 py-3 rounded-xl bg-surface-container-high text-on-surface font-label-tag uppercase tracking-wider font-semibold">Cancel</button>
              <button type="submit" id="save-subject-btn" class="flex-1 py-3 rounded-xl bg-primary text-on-primary font-label-tag uppercase tracking-wider font-semibold">Add Subject</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Notifications Drawer Modal -->
      <div id="notifications-modal" class="fixed inset-0 z-[100] hidden items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-surface-container-lowest w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between">
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Attendance Alerts</h3>
            <div class="flex items-center gap-2">
              <button id="btn-read-all-notifs" class="text-xs font-label-code text-secondary hover:underline">Mark all read</button>
              <button id="close-notifs-modal" class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface">
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
          <div id="notifications-list" class="space-y-2"></div>
        </div>
      </div>

      ${NavigationComponent.renderDock('dashboard')}
    `;
  },

  async init() {
    this.attachModalEvents();
    await this.loadDashboard();
  },

  async loadDashboard() {
    try {
      this.data = await API.get('/dashboard');
      this.renderHero();
      this.renderWarnings();
      this.renderSubjects();
      const dot = document.getElementById('dash-notif-dot');
      if (dot) {
        if ((this.data.recent_notifications || []).length > 0) dot.classList.remove('hidden');
        else dot.classList.add('hidden');
      }
    } catch (err) {
      Helpers.showToast(err.message || 'Failed to load dashboard', 'error');
    }
  },

  renderHero() {
    const container = document.getElementById('overall-hero-container');
    if (!container || !this.data) return;

    const d = this.data;
    const pct = d.overall_attendance || 0;
    const status = AttendanceCalc.getStatus(pct, 75);
    const radius = 32;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (Math.min(pct, 100) / 100) * circ;

    container.innerHTML = `
      <div class="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-variant/30 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg class="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="${radius}" fill="none" stroke="${status.bgColor}" stroke-width="6"></circle>
              <circle cx="40" cy="40" r="${radius}" fill="none" stroke="${status.status === 'safe' ? '#7BB28D' : status.status === 'warning' ? '#E8A968' : '#E88B88'}"
                stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(2)}" stroke-linecap="round" stroke-width="6"></circle>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="font-label-numeric text-lg font-bold text-on-surface leading-none">${Math.round(pct)}%</span>
              <span class="font-label-tag text-[9px] uppercase mt-0.5" style="color:${status.color}">${d.total_classes === 0 ? 'NEW' : status.label}</span>
            </div>
          </div>
          <div>
            <p class="font-label-tag text-label-tag uppercase text-on-surface-variant">Overall Index</p>
            <p class="font-headline-sm text-headline-sm text-on-surface mt-0.5">${d.total_attended} / ${d.total_classes} Attended</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">${d.total_subjects} subject${d.total_subjects === 1 ? '' : 's'} • ${d.total_missed} missed</p>
          </div>
        </div>
        ${d.subjects_below_threshold.length > 0 ? `
          <span class="px-2.5 py-1 rounded-full bg-[#FDEAE8] text-[#A63A37] font-label-tag text-[10px] font-semibold shrink-0">
            ${d.subjects_below_threshold.length} At Risk
          </span>
        ` : ''}
      </div>
    `;
  },

  renderWarnings() {
    const container = document.getElementById('warnings-container');
    if (!container || !this.data) return;
    const warnings = this.data.attendance_warnings || [];
    if (warnings.length === 0) {
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');
    container.classList.add('flex');
    container.innerHTML = warnings.slice(0, 2).map(w => `
      <div class="rounded-xl p-3 flex items-start gap-2.5 ${w.level === 'RED' ? 'bg-error-container/70 text-on-error-container' : 'bg-[#FEF3E2] text-[#925B1D]'}">
        <span class="material-symbols-outlined text-[18px] mt-0.5">${w.level === 'RED' ? 'warning' : 'info'}</span>
        <p class="font-body-sm text-body-sm leading-snug">${Helpers.escapeHtml(w.message)}</p>
      </div>
    `).join('');
  },

  renderSubjects() {
    const container = document.getElementById('subjects-list-container');
    if (!container || !this.data) return;

    const query = this.searchQuery.toLowerCase().trim();
    const seenIds = new Set();
    const subjects = (this.data.subjects || []).filter(s => {
      if (!s || !s.id || seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return !query || s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query) || (s.faculty_name || '').toLowerCase().includes(query);
    });

    if (subjects.length === 0) {
      container.innerHTML = `
        <div class="bg-surface-container-lowest rounded-xl p-8 text-center shadow-sm space-y-3">
          <span class="material-symbols-outlined text-4xl text-outline-variant">school</span>
          <p class="font-headline-sm text-on-surface">${query ? 'No matching subjects' : 'No subjects added yet'}</p>
          <p class="font-body-sm text-on-surface-variant">${query ? 'Try a different search term.' : 'Tap "+ Subject" above to add your first course and start tracking attendance.'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = subjects.map(s => {
      const pct = s.percentage || 0;
      const status = AttendanceCalc.getStatus(pct, s.required_attendance || 75);
      const r = 18;
      const circ = 2 * Math.PI * r;
      const offset = circ - (Math.min(pct, 100) / 100) * circ;
      const strokeColor = status.status === 'safe' ? '#7BB28D' : status.status === 'warning' ? '#E8A968' : '#E88B88';
      const trackColor = status.status === 'safe' ? '#E8F3EB' : status.status === 'warning' ? '#FEF3E2' : '#FDEAE8';

      let actionText = '';
      let actionColor = '#4D7E5C';
      if (s.total === 0) {
        actionText = 'No classes yet';
        actionColor = '#666666';
      } else if (s.classes_needed > 0) {
        actionText = `Need ${s.classes_needed}`;
        actionColor = '#ba1a1a';
      } else if (s.classes_needed === -1) {
        actionText = 'Target unreachable';
        actionColor = '#ba1a1a';
      } else {
        actionText = `Can miss ${s.classes_can_miss}`;
      }

      return `
        <div class="subject-card w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm border border-transparent hover:border-surface-variant/50 transition-colors cursor-pointer" data-subject-id="${s.id}">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                <span class="font-label-code text-[11px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded uppercase">${Helpers.escapeHtml(s.code)}</span>
                <span class="font-label-tag text-label-tag px-2 py-0.5 rounded-full font-semibold" style="color:${status.color}; background-color:${status.bgColor}">
                  ${pct.toFixed(1)}% ${s.total === 0 ? 'New' : status.label}
                </span>
              </div>
              <h3 class="font-headline-sm text-[16px] font-semibold text-on-surface truncate">${Helpers.escapeHtml(s.name)}</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5 truncate">${Helpers.escapeHtml(s.faculty_name || 'Faculty not set')}</p>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <div class="relative w-11 h-11 flex items-center justify-center shrink-0">
                <svg class="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" fill="none" r="${r}" stroke="${trackColor}" stroke-width="3.5"></circle>
                  <circle cx="22" cy="22" fill="none" r="${r}" stroke="${strokeColor}" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(2)}" stroke-linecap="round" stroke-width="3.5"></circle>
                </svg>
                <span class="absolute font-label-code text-[11px] font-semibold" style="color:${status.color}">${Math.round(pct)}%</span>
              </div>
              <div class="text-right shrink-0 min-w-[58px]">
                <span class="font-label-code text-[15px] font-semibold text-on-surface block leading-tight">${s.attended} / ${s.total}</span>
                <p class="font-label-tag text-[11px] font-medium mt-0.5" style="color:${actionColor}">${actionText}</p>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-1 border-t border-surface-container-high/60">
            <button data-quick-mark="present" data-subject-id="${s.id}" class="quick-mark-btn flex items-center justify-center py-2 px-3 rounded-lg bg-surface-container hover:bg-secondary-container hover:text-on-secondary-container transition-all active:scale-95 group font-label-code text-label-code text-on-surface font-semibold text-xs min-h-[38px]">
              <svg class="w-3.5 h-3.5 mr-1.5 stroke-[2.2] text-secondary group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>Attended
            </button>
            <button data-quick-mark="absent" data-subject-id="${s.id}" class="quick-mark-btn flex items-center justify-center py-2 px-3 rounded-lg bg-surface-container hover:bg-error-container hover:text-on-error-container transition-all active:scale-95 group font-label-code text-label-code text-on-surface font-semibold text-xs min-h-[38px]">
              <svg class="w-3.5 h-3.5 mr-1.5 stroke-[2.2] text-error group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>Missed
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Card navigation
    container.querySelectorAll('.subject-card').forEach(card => {
      card.addEventListener('click', () => {
        Router.navigate(`subject/${card.dataset.subjectId}`);
      });
    });

    // Quick attendance marking
    container.querySelectorAll('.quick-mark-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (this.isMarkingAttendance) return;

        const subjectId = btn.dataset.subjectId;
        const status = btn.dataset.quickMark;
        const markButtons = container.querySelectorAll('.quick-mark-btn');
        this.isMarkingAttendance = true;
        markButtons.forEach(b => { b.disabled = true; });

        try {
          const today = new Date().toISOString().split('T')[0];
          const nowTime = new Date().toTimeString().slice(0, 8);
          await API.post('/attendance', {
            subject_id: subjectId,
            date: today,
            status,
            start_time: nowTime,
            session_type: 'lecture'
          });
          Helpers.showToast(status === 'present' ? 'Marked as Attended' : 'Marked as Missed');
          await this.loadDashboard();
        } catch (err) {
          Helpers.showToast(err.message || 'Could not record attendance', 'error');
        } finally {
          this.isMarkingAttendance = false;
          markButtons.forEach(b => { b.disabled = false; });
        }
      });
    });
  },

  attachModalEvents() {
    const searchInput = document.getElementById('subject-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderSubjects();
      });
    }

    const subjModal = document.getElementById('add-subject-modal');
    const openSubj = document.getElementById('btn-add-subject-open');
    const closeSubj = document.getElementById('close-subject-modal');
    const cancelSubj = document.getElementById('cancel-subject-modal');

    const toggleSubjModal = (show) => {
      if (!subjModal) return;
      subjModal.classList.toggle('hidden', !show);
      subjModal.classList.toggle('flex', show);
    };

    openSubj?.addEventListener('click', () => toggleSubjModal(true));
    closeSubj?.addEventListener('click', () => toggleSubjModal(false));
    cancelSubj?.addEventListener('click', () => toggleSubjModal(false));

    document.getElementById('add-subject-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.isSubmittingSubject) return;
      this.isSubmittingSubject = true;
      const saveBtn = document.getElementById('save-subject-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      try {
        await API.post('/subjects', {
          name: document.getElementById('subj-name').value.trim(),
          code: document.getElementById('subj-code').value.trim().toUpperCase(),
          faculty_name: document.getElementById('subj-faculty').value.trim() || null,
          required_attendance: parseFloat(document.getElementById('subj-req').value) || 75,
          credits: parseFloat(document.getElementById('subj-credits').value) || 3,
          frequency_per_week: parseInt(document.getElementById('subj-freq').value) || 3,
          room: document.getElementById('subj-room').value.trim() || null
        });
        Helpers.showToast('Subject added!');
        e.target.reset();
        toggleSubjModal(false);
        await this.loadDashboard();
      } catch (err) {
        Helpers.showToast(err.message || 'Failed to add subject', 'error');
      } finally {
        this.isSubmittingSubject = false;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Add Subject';
      }
    });

    // Notifications drawer
    const notifModal = document.getElementById('notifications-modal');
    const openNotifs = document.getElementById('btn-open-notifications');
    const closeNotifs = document.getElementById('close-notifs-modal');
    const readAllBtn = document.getElementById('btn-read-all-notifs');

    openNotifs?.addEventListener('click', async () => {
      notifModal.classList.remove('hidden');
      notifModal.classList.add('flex');
      await this.loadNotifications();
    });
    closeNotifs?.addEventListener('click', () => {
      notifModal.classList.add('hidden');
      notifModal.classList.remove('flex');
    });
    readAllBtn?.addEventListener('click', async () => {
      await API.put('/notifications/read-all', {});
      await this.loadNotifications();
      await this.loadDashboard();
    });
  },

  async loadNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    list.innerHTML = Helpers.loadingSpinner();
    try {
      const items = await API.get('/notifications');
      if (items.length === 0) {
        list.innerHTML = '<p class="text-center text-on-surface-variant py-6 font-body-sm">No alerts yet. Your attendance is looking good!</p>';
        return;
      }
      list.innerHTML = items.map(n => `
        <div class="p-3 rounded-xl ${n.is_read ? 'bg-surface-container-low opacity-70' : 'bg-surface-container'} flex items-start justify-between gap-2">
          <div>
            <p class="font-headline-sm text-sm font-semibold text-on-surface">${Helpers.escapeHtml(n.title)}</p>
            <p class="font-body-sm text-xs text-on-surface-variant mt-0.5">${Helpers.escapeHtml(n.message)}</p>
          </div>
          ${!n.is_read ? `<button data-read-notif="${n.id}" class="text-xs font-label-code text-secondary shrink-0">Read</button>` : ''}
        </div>
      `).join('');
      list.querySelectorAll('[data-read-notif]').forEach(btn => {
        btn.addEventListener('click', async () => {
          await API.put(`/notifications/${btn.dataset.readNotif}/read`, {});
          await this.loadNotifications();
          await this.loadDashboard();
        });
      });
    } catch (err) {
      list.innerHTML = '<p class="text-center text-error py-4 font-body-sm">Failed to load alerts</p>';
    }
  }
};
