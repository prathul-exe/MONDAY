const DeadlinesComponent = {
  deadlines: [],
  subjects: [],
  selectedCourseId: '',
  selectedCategory: 'assignment',
  selectedPlatform: 'Moodle Portal',

  render() {
    return `
      ${NavigationComponent.renderHeader('Tasks & Deadlines', false, true, true)}
      <main class="flex-1 flex flex-col relative w-full max-w-lg mx-auto px-gutter pt-4 pb-32 bg-surface">
        <div class="flex flex-col w-full gap-space-md">
          <button id="add-deadline-btn" class="w-full bg-[#171717] text-white py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer">
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>New Task / Exam Deadline</span>
          </button>

          <div id="deadlines-content" class="space-y-4">
            ${Helpers.loadingSpinner()}
          </div>
        </div>
      </main>

      <!-- New Deliverable Modal -->
      <div id="add-task-modal" class="fixed inset-0 z-[100] hidden items-end justify-center">
        <div id="dl-modal-backdrop" class="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-lg bg-surface rounded-t-[28px] max-h-[90vh] flex flex-col shadow-2xl z-10 border-t border-surface-variant/40 pb-safe">
          <div class="pt-3 pb-2 px-gutter flex flex-col shrink-0 border-b border-surface-variant/30">
            <div class="w-10 h-1.5 bg-surface-container-highest rounded-full mx-auto mb-2.5"></div>
            <div class="flex items-center justify-between">
              <div>
                <span class="font-label-tag text-label-tag text-secondary uppercase tracking-widest font-semibold">Academic Horizon</span>
                <h2 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight mt-0.5">New Deliverable</h2>
              </div>
              <button id="dl-discard-btn" class="px-space-md py-space-xs rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm font-medium flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px]">close</span><span>Discard</span>
              </button>
            </div>
          </div>

          <form id="dl-create-form" class="flex-1 overflow-y-auto px-gutter py-space-md space-y-space-md">
            <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
              <label class="block font-label-tag text-label-tag text-on-surface-variant uppercase tracking-wider mb-1">Deliverable Name *</label>
              <input id="dl-title" required type="text" placeholder="e.g., Midterm Exam or Lab Report 3"
                class="w-full bg-transparent font-headline-sm text-headline-sm text-on-surface placeholder:text-outline-variant focus:outline-none">
            </div>

            <div>
              <span class="block font-label-tag text-label-tag text-on-surface-variant uppercase tracking-wider mb-1 px-1">Course</span>
              <select id="dl-subject" class="w-full rounded-xl bg-surface-container-lowest p-3 text-on-surface shadow-sm focus:outline-none">
                <option value="">General / All Courses</option>
              </select>
            </div>

            <div>
              <span class="block font-label-tag text-label-tag text-on-surface-variant uppercase tracking-wider mb-1 px-1">Category</span>
              <div class="grid grid-cols-3 gap-2">
                ${[
                  { k: 'assignment', label: 'Assignment', icon: 'assignment' },
                  { k: 'tp_lab', label: 'TP / Lab', icon: 'science' },
                  { k: 'project', label: 'Project', icon: 'account_tree' },
                  { k: 'exam_quiz', label: 'Exam / Quiz', icon: 'timer' },
                  { k: 'reading', label: 'Reading', icon: 'auto_stories' },
                  { k: 'custom', label: 'Custom', icon: 'add_circle' }
                ].map(c => `
                  <button type="button" data-cat="${c.k}" class="dl-cat-btn flex flex-col items-center justify-center p-2.5 rounded-xl shadow-sm transition-all ${c.k === 'assignment' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface'}">
                    <span class="material-symbols-outlined text-[20px] mb-1">${c.icon}</span>
                    <span class="font-label-code text-xs font-medium">${c.label}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm grid grid-cols-2 gap-3">
              <div>
                <label class="font-label-tag text-label-tag text-on-surface-variant uppercase block mb-1">Due Date *</label>
                <input id="dl-date" type="date" required class="w-full rounded-lg bg-surface-container-low p-2.5 text-on-surface focus:outline-none">
              </div>
              <div>
                <label class="font-label-tag text-label-tag text-on-surface-variant uppercase block mb-1">Due Time</label>
                <input id="dl-time" type="time" value="23:59" class="w-full rounded-lg bg-surface-container-low p-2.5 text-on-surface focus:outline-none">
              </div>
            </div>

            <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center justify-between gap-3">
              <div>
                <span class="font-label-tag text-label-tag text-on-surface-variant uppercase block">Platform</span>
                <select id="dl-platform" class="bg-transparent font-label-code text-sm text-on-surface focus:outline-none mt-0.5">
                  <option value="Moodle Portal">Moodle Portal</option>
                  <option value="Canvas LMS">Canvas LMS</option>
                  <option value="Direct PDF Upload">Direct PDF Upload</option>
                  <option value="In-Person / Hall">In-Person / Hall</option>
                </select>
              </div>
              <div class="text-right">
                <span class="font-label-tag text-label-tag text-on-surface-variant uppercase block">Grade %</span>
                <input id="dl-weight" type="number" min="0" max="100" value="10" class="w-16 text-right bg-surface-container-low rounded-lg px-2 py-1 font-label-code text-sm text-on-surface">
              </div>
            </div>

            <button type="submit" id="dl-submit-btn" class="w-full h-12 rounded-full bg-primary text-on-primary font-label-code font-semibold tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all">
              <span class="material-symbols-outlined text-[20px]">check_circle</span>
              <span>Schedule Deliverable</span>
            </button>
          </form>
        </div>
      </div>

      ${NavigationComponent.renderDock('deadlines')}
    `;
  },

  async init() {
    this.attachEvents();
    await this.loadData();
  },

  async loadData() {
    try {
      const [deadlines, subjects] = await Promise.all([
        API.get('/deadlines'),
        API.get('/subjects')
      ]);
      this.deadlines = deadlines;
      this.subjects = subjects;

      const select = document.getElementById('dl-subject');
      if (select) {
        select.innerHTML = '<option value="">General / All Courses</option>' +
          subjects.map(s => `<option value="${s.id}">${Helpers.escapeHtml(s.code)} — ${Helpers.escapeHtml(s.name)}</option>`).join('');
      }

      this.renderList();
    } catch (err) {
      Helpers.showToast(err.message || 'Failed to load deadlines', 'error');
    }
  },

  renderList() {
    const container = document.getElementById('deadlines-content');
    if (!container) return;

    const pending = this.deadlines.filter(d => !d.is_completed);
    const completed = this.deadlines.filter(d => d.is_completed);

    if (this.deadlines.length === 0) {
      container.innerHTML = `
        <div class="bg-surface-container-lowest rounded-xl p-8 text-center shadow-sm space-y-2">
          <span class="material-symbols-outlined text-4xl text-outline-variant">assignment</span>
          <p class="font-headline-sm text-on-surface">No deadlines scheduled</p>
          <p class="font-body-sm text-on-surface-variant">Add exams, eligibility cutoffs, or assignments above.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-code text-[11px] font-semibold">${pending.length} Pending</span>
      </div>
      <div class="space-y-3">
        ${pending.map(d => this.renderCard(d, false)).join('')}
      </div>

      ${completed.length > 0 ? `
        <div class="pt-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-label-tag text-label-tag text-on-surface-variant font-semibold uppercase tracking-widest">Completed Tasks</span>
            <span class="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-code text-[10px]">${completed.length} Done</span>
          </div>
          ${completed.map(d => this.renderCard(d, true)).join('')}
        </div>
      ` : ''}
    `;

    container.querySelectorAll('.toggle-dl-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.dlId;
        const done = btn.dataset.done === '1';
        try {
          await API.put(`/deadlines/${id}/${done ? 'uncomplete' : 'complete'}`, {});
          Helpers.showToast(done ? 'Reopened task' : 'Task completed!');
          await this.loadData();
        } catch (err) {
          Helpers.showToast(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('.del-dl-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Helpers.confirm('Delete Deadline', 'Remove this deadline?', 'Delete');
        if (!ok) return;
        try {
          await API.delete(`/deadlines/${btn.dataset.dlId}`);
          Helpers.showToast('Deadline deleted');
          await this.loadData();
        } catch (err) {
          Helpers.showToast(err.message, 'error');
        }
      });
    });
  },

  renderCard(d, isDone) {
    const catLabels = {
      assignment: 'Assignment',
      tp_lab: 'TP / Lab',
      project: 'Project',
      exam_quiz: 'Exam / Quiz',
      reading: 'Reading',
      custom: 'Custom'
    };
    return `
      <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-3 ${isDone ? 'opacity-65' : ''}">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap min-w-0">
            ${d.subject_code ? `<span class="font-label-code text-label-code text-on-surface bg-surface-container px-2 py-0.5 rounded">${Helpers.escapeHtml(d.subject_code)}</span>` : ''}
            <span class="px-2 py-0.5 rounded-full bg-[#E89A68]/15 text-[#925B1D] font-label-tag text-label-tag">${catLabels[d.category] || 'Task'}</span>
          </div>
          <button data-dl-id="${d.id}" class="del-dl-btn text-outline hover:text-error p-1" title="Delete">
            <span class="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
        <div>
          <h3 class="font-headline-sm text-headline-sm text-on-surface leading-snug ${isDone ? 'line-through' : ''}">${Helpers.escapeHtml(d.title)}</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5 mt-1">
            <span class="material-symbols-outlined text-[15px]">schedule</span>
            <span>${Helpers.formatDateShort(d.due_date)} • ${Helpers.formatTime(d.due_time)}${d.grade_weight ? ` • ${d.grade_weight}% Weight` : ''}</span>
          </p>
        </div>
        <div class="border-t border-surface-container-high pt-2.5 flex items-center justify-between gap-2">
          <span class="font-label-code text-xs text-on-surface-variant truncate">${Helpers.escapeHtml(d.platform || 'Local Task')}</span>
          <button data-dl-id="${d.id}" data-done="${isDone ? '1' : '0'}" class="toggle-dl-btn shrink-0 px-3 py-1.5 rounded-full ${isDone ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface'} font-label-tag text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-[16px]">check_circle</span>
            <span>${isDone ? 'Completed' : 'Mark Complete'}</span>
          </button>
        </div>
      </div>
    `;
  },

  attachEvents() {
    const modal = document.getElementById('add-task-modal');
    const open = () => {
      document.getElementById('dl-date').value = new Date().toISOString().split('T')[0];
      modal?.classList.remove('hidden');
      modal?.classList.add('flex');
    };
    const close = () => {
      modal?.classList.add('hidden');
      modal?.classList.remove('flex');
    };

    document.getElementById('add-deadline-btn')?.addEventListener('click', open);
    document.getElementById('dl-discard-btn')?.addEventListener('click', close);
    document.getElementById('dl-modal-backdrop')?.addEventListener('click', close);

    document.querySelectorAll('.dl-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.dataset.cat;
        document.querySelectorAll('.dl-cat-btn').forEach(b => {
          b.classList.remove('bg-secondary-container', 'text-on-secondary-container');
          b.classList.add('bg-surface-container-lowest', 'text-on-surface');
        });
        btn.classList.remove('bg-surface-container-lowest', 'text-on-surface');
        btn.classList.add('bg-secondary-container', 'text-on-secondary-container');
      });
    });

    document.getElementById('dl-create-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('dl-submit-btn');
      btn.disabled = true;
      try {
        await API.post('/deadlines', {
          title: document.getElementById('dl-title').value.trim(),
          subject_id: document.getElementById('dl-subject').value || null,
          category: this.selectedCategory,
          due_date: document.getElementById('dl-date').value,
          due_time: document.getElementById('dl-time').value || '23:59',
          platform: document.getElementById('dl-platform').value,
          grade_weight: parseFloat(document.getElementById('dl-weight').value) || 0
        });
        Helpers.showToast('Deadline scheduled!');
        e.target.reset();
        close();
        await this.loadData();
      } catch (err) {
        Helpers.showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }
};
