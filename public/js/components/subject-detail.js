const SubjectDetailComponent = {
  subject: null,
  records: [],
  projection: null,
  filter: 'all', // 'all' | 'present' | 'absent' | 'excused'
  subjectId: null,

  render(subjectId) {
    this.subjectId = subjectId;
    return `
      ${NavigationComponent.renderHeader('Subject Detail', true, true, true)}
      <main class="flex-1 flex flex-col relative w-full max-w-lg mx-auto px-gutter pt-4 pb-28 bg-surface">
        <div id="subject-detail-body" class="flex flex-col w-full space-y-4">
          ${Helpers.loadingSpinner()}
        </div>
      </main>

      <!-- Manual / Edit Attendance Modal -->
      <div id="attendance-modal" aria-modal="true" role="dialog" class="fixed inset-0 z-[100] hidden items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="bg-surface-container-lowest w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="material-symbols-outlined text-primary">add_circle</span>
              <h4 id="att-modal-title" class="font-headline-sm text-headline-sm text-on-surface">Add Past Entry</h4>
            </div>
            <button id="att-modal-close" class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <form id="att-entry-form" class="space-y-3">
            <input type="hidden" id="att-edit-id" value="">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">Session Date</label>
                <input id="att-date" type="date" required class="w-full bg-surface-container-low rounded-lg p-2.5 text-body-md text-on-surface focus:outline-none">
              </div>
              <div>
                <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">Start Time</label>
                <input id="att-time" type="time" class="w-full bg-surface-container-low rounded-lg p-2.5 text-body-md text-on-surface focus:outline-none">
              </div>
            </div>
            <div>
              <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">Session Type</label>
              <select id="att-session-type" class="w-full bg-surface-container-low rounded-lg p-2.5 text-body-md text-on-surface focus:outline-none">
                <option value="lecture">Lecture</option>
                <option value="lab">Lab Practical</option>
                <option value="tutorial">Tutorial</option>
                <option value="seminar">Seminar</option>
              </select>
            </div>
            <div>
              <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">Attendance Status</label>
              <div class="grid grid-cols-3 gap-2" id="att-status-group">
                <button type="button" data-status="present" class="att-status-btn py-2 px-1 rounded-lg bg-secondary-container text-on-secondary-container font-label-tag text-label-tag font-bold flex flex-col items-center">
                  <span class="material-symbols-outlined text-[18px] mb-0.5">check</span>Present
                </button>
                <button type="button" data-status="absent" class="att-status-btn py-2 px-1 rounded-lg bg-surface-container-low text-on-surface-variant font-label-tag text-label-tag flex flex-col items-center">
                  <span class="material-symbols-outlined text-[18px] mb-0.5">close</span>Absent
                </button>
                <button type="button" data-status="excused" class="att-status-btn py-2 px-1 rounded-lg bg-surface-container-low text-on-surface-variant font-label-tag text-label-tag flex flex-col items-center">
                  <span class="material-symbols-outlined text-[18px] mb-0.5">medication</span>Excused
                </button>
              </div>
            </div>
            <div>
              <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">Remarks / Note (Optional)</label>
              <input id="att-notes" type="text" placeholder="e.g., Attended makeup tutorial" class="w-full bg-surface-container-low rounded-lg p-2.5 text-body-sm text-on-surface focus:outline-none">
            </div>
            <div class="pt-2 flex space-x-2">
              <button type="button" id="att-modal-cancel" class="flex-1 py-3 rounded-xl bg-surface-container-high text-on-surface font-label-tag text-label-tag uppercase tracking-wider font-semibold">Discard</button>
              <button type="submit" id="att-modal-save" class="flex-1 py-3 rounded-xl bg-primary text-on-primary font-label-tag text-label-tag uppercase tracking-wider font-semibold">Save Entry</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Edit Subject Modal -->
      <div id="edit-subject-modal" class="fixed inset-0 z-[100] hidden items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="bg-surface-container-lowest w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 shadow-xl space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="font-headline-sm text-headline-sm text-on-surface">Subject Settings</h4>
            <button id="edit-subj-close" class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">close</span></button>
          </div>
          <form id="edit-subj-form" class="space-y-3">
            <div>
              <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">Subject Name</label>
              <input id="es-name" required class="w-full bg-surface-container-low rounded-lg p-2.5 text-on-surface">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">Code</label>
                <input id="es-code" required class="w-full bg-surface-container-low rounded-lg p-2.5 text-on-surface uppercase">
              </div>
              <div>
                <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">Required %</label>
                <input id="es-req" type="number" min="0" max="100" class="w-full bg-surface-container-low rounded-lg p-2.5 text-on-surface">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">Faculty</label>
                <input id="es-faculty" class="w-full bg-surface-container-low rounded-lg p-2.5 text-on-surface">
              </div>
              <div>
                <label class="font-label-tag text-label-tag uppercase text-on-surface-variant block mb-1">Room</label>
                <input id="es-room" class="w-full bg-surface-container-low rounded-lg p-2.5 text-on-surface">
              </div>
            </div>
            <div class="flex gap-2 pt-2">
              <button type="button" id="es-delete-btn" class="py-3 px-4 rounded-xl bg-error-container text-on-error-container font-label-tag uppercase font-semibold">Delete</button>
              <button type="submit" class="flex-1 py-3 rounded-xl bg-primary text-on-primary font-label-tag uppercase font-semibold">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  selectedStatus: 'present',

  async init(subjectId) {
    this.subjectId = subjectId;
    this.attachModalEvents();
    await this.loadData();
  },

  async loadData() {
    try {
      const [subject, records, projection] = await Promise.all([
        API.get(`/subjects/${this.subjectId}`),
        API.get(`/attendance/subject/${this.subjectId}`),
        API.get(`/calendar/projection/${this.subjectId}`).catch(() => null)
      ]);
      this.subject = subject;
      this.records = records;
      this.projection = projection;
      this.renderBody();
    } catch (err) {
      const body = document.getElementById('subject-detail-body');
      if (body) body.innerHTML = `<p class="text-center text-error py-8">${Helpers.escapeHtml(err.message || 'Subject not found')}</p>`;
    }
  },

  renderBody() {
    const body = document.getElementById('subject-detail-body');
    const s = this.subject;
    if (!body || !s) return;

    const pct = s.percentage || 0;
    const req = s.required_attendance || 75;
    const status = AttendanceCalc.getStatus(pct, req);
    const r = 46;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(pct, 100) / 100) * circ;
    const strokeColor = status.status === 'safe' ? '#7BB28D' : status.status === 'warning' ? '#E8A968' : 'rgb(248, 113, 113)';

    const filtered = this.records.filter(rec => this.filter === 'all' || rec.status === this.filter);
    const initials = (s.faculty_name || 'FA').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    // Recovery or bunk notice
    let noticeHtml = '';
    if (s.total === 0) {
      noticeHtml = `<div class="mt-3.5 bg-surface-container-low rounded-lg p-3"><p class="font-body-sm text-on-surface-variant">No classes recorded yet. Use quick mark or Manual Entry below to log attendance.</p></div>`;
    } else if (s.classes_needed > 0) {
      const projPct = AttendanceCalc.percentage(s.attended + s.classes_needed, s.total + s.classes_needed).toFixed(1);
      noticeHtml = `
        <div class="mt-3.5 rounded-lg p-3 flex items-start space-x-2.5" style="background-color: rgb(255, 241, 242); border: 1px solid rgb(255, 228, 230);">
          <div class="flex-1">
            <p class="font-headline-sm text-body-md font-semibold text-on-surface leading-snug">Recovery Path</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">
              Attend next <span class="font-semibold text-on-surface underline decoration-error/50">${s.classes_needed} consecutive class${s.classes_needed === 1 ? '' : 'es'}</span> to reach <span class="font-label-code font-medium text-secondary">${projPct}%</span> (Safe zone).
              ${this.projection?.lastSafeDate ? `<br><span class="text-[11px]">Est. recovery date: <strong>${Helpers.formatDateShort(this.projection.lastSafeDate)}</strong> (estimate)</span>` : ''}
            </p>
          </div>
        </div>
      `;
    } else if (s.classes_needed === -1) {
      noticeHtml = `
        <div class="mt-3.5 rounded-lg p-3 bg-error-container/50">
          <p class="font-headline-sm text-body-md font-semibold text-on-error-container">Target Unreachable</p>
          <p class="font-body-sm text-on-error-container/90 mt-0.5">Reaching ${req}% is not mathematically possible through future attendance alone.</p>
        </div>
      `;
    } else {
      const afterMiss1 = AttendanceCalc.percentage(s.attended, s.total + 1).toFixed(1);
      noticeHtml = `
        <div class="mt-3.5 rounded-lg p-3 bg-[#E8F3EB]">
          <p class="font-headline-sm text-body-md font-semibold text-[#356143]">Bunk Calculator</p>
          <p class="font-body-sm text-[#356143] mt-0.5">
            You can safely miss <strong>${s.classes_can_miss}</strong> upcoming class${s.classes_can_miss === 1 ? '' : 'es'} without dropping below ${req}%. Missing 1 class brings you to ${afterMiss1}%.
          </p>
        </div>
      `;
    }

    body.innerHTML = `
      <!-- Subject Identity -->
      <div class="flex items-center justify-between pt-1">
        <div class="min-w-0">
          <div class="flex items-center space-x-2">
            <span class="font-label-code text-label-code bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded uppercase">${Helpers.escapeHtml(s.code)}</span>
            <span class="font-label-tag text-label-tag uppercase tracking-wider text-secondary flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>Active Term
            </span>
          </div>
          <h2 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface truncate mt-1">${Helpers.escapeHtml(s.name)}</h2>
        </div>
        <button id="btn-edit-subject" aria-label="Course settings" class="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant shadow-sm active:scale-95 transition-transform">
          <span class="material-symbols-outlined text-[20px]">tune</span>
        </button>
      </div>

      <!-- Hero Stat Card -->
      <section class="bg-surface-container-lowest rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div class="flex items-center gap-4">
          <div class="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
            <svg class="w-full h-full -rotate-90 p-1" viewBox="0 0 112 112">
              <circle class="text-surface-container-highest" cx="56" cy="56" fill="transparent" r="${r}" stroke="currentColor" stroke-width="7"></circle>
              <circle cx="56" cy="56" fill="transparent" r="${r}" stroke="${strokeColor}" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" stroke-linecap="round" stroke-width="7"></circle>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none p-1">
              <span class="font-label-numeric text-[22px] font-bold text-on-surface leading-none tracking-tight">${Math.round(pct)}<span class="text-[11px] font-semibold align-top ml-0.5">%</span></span>
              <span class="font-label-tag text-[10px] tracking-wider font-bold uppercase mt-1 leading-none" style="color:${status.color}">${s.total === 0 ? 'NEW' : status.label}</span>
            </div>
          </div>
          <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div class="flex items-center justify-between mb-1.5">
              <span class="font-label-tag text-label-tag uppercase text-on-surface-variant">Req. Target</span>
              <span class="font-label-code text-label-code font-bold text-on-surface">${req.toFixed(1)}%</span>
            </div>
            <div class="bg-surface-container-low rounded-lg p-2.5 flex flex-col justify-center space-y-1">
              <div class="flex items-center justify-between text-body-sm">
                <span class="text-on-surface-variant font-body-sm">Attended / Total</span>
                <span class="font-label-code text-label-code font-medium text-on-surface">${s.attended} / ${s.total}</span>
              </div>
              <div class="flex items-center justify-between text-body-sm">
                <span class="text-on-surface-variant font-body-sm">Missed / Excused</span>
                <span class="font-label-code text-label-code font-medium text-on-surface">${s.absent} / ${s.excused}</span>
              </div>
            </div>
          </div>
        </div>
        ${noticeHtml}
      </section>

      <!-- Quick Mark Buttons -->
      <section class="grid grid-cols-2 gap-3 w-full">
        <button id="sd-mark-present" class="py-3 rounded-xl bg-secondary-container text-on-secondary-container font-label-code font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
          <span class="material-symbols-outlined text-[18px]">check_circle</span>Mark Attended
        </button>
        <button id="sd-mark-absent" class="py-3 rounded-xl bg-error-container text-on-error-container font-label-code font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
          <span class="material-symbols-outlined text-[18px]">cancel</span>Mark Missed
        </button>
      </section>

      <!-- Faculty & Metadata -->
      <div class="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5 min-w-0">
            <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0 text-on-surface-variant font-label-code font-semibold">${Helpers.escapeHtml(initials)}</div>
            <div class="min-w-0">
              <p class="font-headline-sm text-body-md font-semibold text-on-surface truncate">${Helpers.escapeHtml(s.faculty_name || 'Faculty Not Assigned')}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${Helpers.escapeHtml(s.code)} Instructor</p>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 pt-2">
          <div class="bg-surface-container-low rounded-lg p-2.5 flex flex-col justify-center space-y-1">
            <span class="font-label-tag text-label-tag uppercase text-on-surface-variant block">Credits</span>
            <span class="font-label-code text-body-lg font-bold text-on-surface">${s.credits || 3.0}</span>
          </div>
          <div class="bg-surface-container-low rounded-lg p-2.5 flex flex-col justify-center space-y-1">
            <span class="font-label-tag text-label-tag uppercase text-on-surface-variant block">Frequency</span>
            <span class="font-label-code text-body-lg font-bold text-on-surface">${s.frequency_per_week || 3} / wk</span>
          </div>
          <div class="bg-surface-container-low rounded-lg p-2.5 flex flex-col justify-center space-y-1">
            <span class="font-label-tag text-label-tag uppercase text-on-surface-variant block">Room</span>
            <span class="font-label-code text-body-lg font-bold text-on-surface">${Helpers.escapeHtml(s.room || 'TBA')}</span>
          </div>
        </div>
      </div>

      <!-- Attendance History -->
      <section class="space-y-3 pt-1">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-1.5">
            <span class="material-symbols-outlined text-[18px] text-on-surface">history</span>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Attendance Log</h3>
          </div>
          <button id="btn-manual-entry" class="text-primary font-label-tag text-label-tag uppercase tracking-wider flex items-center space-x-1 py-1.5 px-2.5 rounded-lg bg-surface-container-high active:scale-95 transition-transform">
            <span class="material-symbols-outlined text-[16px]">add</span>
            <span>Manual Entry</span>
          </button>
        </div>

        <div class="flex items-center space-x-1.5 overflow-x-auto py-0.5 no-scrollbar">
          ${[
            { k: 'all', label: `All (${this.records.length})` },
            { k: 'present', label: `Attended (${s.attended})` },
            { k: 'absent', label: `Absent (${s.absent})` },
            { k: 'excused', label: `Excused (${s.excused})` }
          ].map(tab => `
            <button data-filter="${tab.k}" class="log-filter-btn px-3 py-1 rounded-full ${this.filter === tab.k ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'} font-label-tag text-label-tag tracking-wider flex-shrink-0 transition-colors">
              ${tab.label}
            </button>
          `).join('')}
        </div>

        <div class="space-y-2">
          ${filtered.length === 0 ? '<p class="text-center text-on-surface-variant py-6 font-body-sm">No attendance entries in this view.</p>' : filtered.map(rec => {
            const isPresent = rec.status === 'present';
            const isExcused = rec.status === 'excused';
            const iconBg = isPresent ? 'bg-secondary-container text-on-secondary-container' : isExcused ? 'bg-[#FEF3E2] text-[#925B1D]' : 'bg-error-container/60 text-error';
            const iconName = isPresent ? 'check' : isExcused ? 'medication' : 'close';
            return `
              <div class="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex items-center justify-between gap-3">
                <div class="flex items-center space-x-3 min-w-0 flex-1">
                  <div class="w-9 h-9 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-[18px]">${iconName}</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-headline-sm text-body-md font-semibold text-on-surface truncate leading-tight">${Helpers.formatDate(rec.date)}</p>
                    <p class="font-label-code text-body-sm text-on-surface-variant truncate mt-0.5">${rec.start_time ? Helpers.formatTime(rec.start_time) + ' • ' : ''}${rec.session_type}${rec.notes ? ' • ' + Helpers.escapeHtml(rec.notes) : ''}</p>
                  </div>
                </div>
                <div class="flex items-center space-x-1 flex-shrink-0">
                  <button data-edit-rec="${rec.id}" class="w-8 h-8 flex items-center justify-center text-outline hover:text-on-surface rounded-full transition-colors" title="Edit">
                    <span class="material-symbols-outlined text-[18px]">edit_note</span>
                  </button>
                  <button data-del-rec="${rec.id}" class="w-8 h-8 flex items-center justify-center text-outline hover:text-error rounded-full transition-colors" title="Delete">
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;

    this.attachBodyEvents();
  },

  attachBodyEvents() {
    document.getElementById('sd-mark-present')?.addEventListener('click', () => this.quickMark('present'));
    document.getElementById('sd-mark-absent')?.addEventListener('click', () => this.quickMark('absent'));

    document.getElementById('btn-manual-entry')?.addEventListener('click', () => this.openEntryModal());
    document.getElementById('btn-edit-subject')?.addEventListener('click', () => this.openEditSubjectModal());

    document.querySelectorAll('.log-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filter = btn.dataset.filter;
        this.renderBody();
      });
    });

    document.querySelectorAll('[data-edit-rec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = this.records.find(r => r.id === btn.dataset.editRec);
        if (rec) this.openEntryModal(rec);
      });
    });

    document.querySelectorAll('[data-del-rec]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Helpers.confirm('Delete Entry', 'Remove this attendance record?', 'Delete');
        if (!ok) return;
        try {
          await API.delete(`/attendance/${btn.dataset.delRec}`);
          Helpers.showToast('Entry removed');
          await this.loadData();
        } catch (err) {
          Helpers.showToast(err.message, 'error');
        }
      });
    });
  },

  async quickMark(status) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toTimeString().slice(0, 8);
      await API.post('/attendance', {
        subject_id: this.subjectId,
        date: today,
        status,
        start_time: nowTime,
        session_type: 'lecture'
      });
      Helpers.showToast(status === 'present' ? 'Marked Attended' : 'Marked Missed');
      await this.loadData();
    } catch (err) {
      Helpers.showToast(err.message, 'error');
    }
  },

  openEntryModal(rec = null) {
    const modal = document.getElementById('attendance-modal');
    document.getElementById('att-modal-title').textContent = rec ? 'Edit Attendance Entry' : 'Add Past Entry';
    document.getElementById('att-edit-id').value = rec ? rec.id : '';
    document.getElementById('att-date').value = rec ? rec.date : new Date().toISOString().split('T')[0];
    document.getElementById('att-time').value = rec?.start_time ? rec.start_time.slice(0, 5) : '09:00';
    document.getElementById('att-session-type').value = rec?.session_type || 'lecture';
    document.getElementById('att-notes').value = rec?.notes || '';
    this.setSelectedStatus(rec?.status || 'present');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  setSelectedStatus(status) {
    this.selectedStatus = status;
    document.querySelectorAll('.att-status-btn').forEach(btn => {
      const active = btn.dataset.status === status;
      btn.className = `att-status-btn py-2 px-1 rounded-lg font-label-tag text-label-tag flex flex-col items-center ${
        active
          ? (status === 'absent' ? 'bg-error-container text-on-error-container font-bold' : 'bg-secondary-container text-on-secondary-container font-bold')
          : 'bg-surface-container-low text-on-surface-variant'
      }`;
    });
  },

  openEditSubjectModal() {
    const s = this.subject;
    if (!s) return;
    document.getElementById('es-name').value = s.name;
    document.getElementById('es-code').value = s.code;
    document.getElementById('es-req').value = s.required_attendance || 75;
    document.getElementById('es-faculty').value = s.faculty_name || '';
    document.getElementById('es-room').value = s.room || '';
    const m = document.getElementById('edit-subject-modal');
    m.classList.remove('hidden');
    m.classList.add('flex');
  },

  attachModalEvents() {
    const modal = document.getElementById('attendance-modal');
    const closeAtt = () => { modal?.classList.add('hidden'); modal?.classList.remove('flex'); };
    document.getElementById('att-modal-close')?.addEventListener('click', closeAtt);
    document.getElementById('att-modal-cancel')?.addEventListener('click', closeAtt);

    document.querySelectorAll('.att-status-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setSelectedStatus(btn.dataset.status));
    });

    document.getElementById('att-entry-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('att-edit-id').value;
      const payload = {
        subject_id: this.subjectId,
        date: document.getElementById('att-date').value,
        start_time: document.getElementById('att-time').value || null,
        session_type: document.getElementById('att-session-type').value,
        status: this.selectedStatus,
        notes: document.getElementById('att-notes').value.trim() || null
      };
      try {
        if (editId) {
          await API.put(`/attendance/${editId}`, payload);
          Helpers.showToast('Entry updated');
        } else {
          await API.post('/attendance', payload);
          Helpers.showToast('Entry recorded');
        }
        closeAtt();
        await this.loadData();
      } catch (err) {
        Helpers.showToast(err.message, 'error');
      }
    });

    const editSubjModal = document.getElementById('edit-subject-modal');
    const closeEditSubj = () => { editSubjModal?.classList.add('hidden'); editSubjModal?.classList.remove('flex'); };
    document.getElementById('edit-subj-close')?.addEventListener('click', closeEditSubj);

    document.getElementById('edit-subj-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await API.put(`/subjects/${this.subjectId}`, {
          name: document.getElementById('es-name').value.trim(),
          code: document.getElementById('es-code').value.trim().toUpperCase(),
          required_attendance: parseFloat(document.getElementById('es-req').value) || 75,
          faculty_name: document.getElementById('es-faculty').value.trim() || null,
          room: document.getElementById('es-room').value.trim() || null
        });
        Helpers.showToast('Subject updated');
        closeEditSubj();
        await this.loadData();
      } catch (err) {
        Helpers.showToast(err.message, 'error');
      }
    });

    document.getElementById('es-delete-btn')?.addEventListener('click', async () => {
      const ok = await Helpers.confirm('Delete Subject', 'Delete this subject and all its attendance records?', 'Delete');
      if (!ok) return;
      try {
        await API.delete(`/subjects/${this.subjectId}`);
        Helpers.showToast('Subject deleted');
        closeEditSubj();
        Router.navigate('dashboard');
      } catch (err) {
        Helpers.showToast(err.message, 'error');
      }
    });
  }
};
