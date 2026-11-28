const DeadlinesComponent = {
  deadlines: [],
  subjects: [],
  selectedCourseId: '',
  selectedCategory: 'assignment',
  editingDeadlineId: null,
  editingOriginalCategory: null,
  isSubmitting: false,
  isTogglingId: null,
  isDeletingId: null,

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
                <h2 id="dl-modal-title" class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight mt-0.5">New Deliverable</h2>
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

            <div id="dl-custom-name-wrap" class="hidden bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
              <label class="block font-label-tag text-label-tag text-on-surface-variant uppercase tracking-wider mb-1">Custom Task Type *</label>
              <input id="dl-custom-name" type="text" placeholder="e.g., Viva, Presentation, Workshop"
                class="w-full bg-transparent font-body-md text-on-surface placeholder:text-outline-variant focus:outline-none">
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

            <button type="submit" id="dl-submit-btn" class="w-full h-12 rounded-full bg-primary text-on-primary font-label-code font-semibold tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all">
              <span class="material-symbols-outlined text-[20px]">check_circle</span>
              <span id="dl-submit-label">Schedule Deliverable</span>
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

    const seenIds = new Set();
    const uniqueDeadlines = (this.deadlines || []).filter(d => {
      if (!d || !d.id || seenIds.has(d.id)) return false;
      seenIds.add(d.id);
      return true;
    });

    const pending = uniqueDeadlines.filter(d => !d.is_completed);
    const completed = uniqueDeadlines.filter(d => d.is_completed);

    if (uniqueDeadlines.length === 0) {
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
        if (this.isTogglingId === id) return;
        const done = btn.dataset.done === '1';
        this.isTogglingId = id;
        btn.disabled = true;
        try {
          await API.put(`/deadlines/${id}/${done ? 'uncomplete' : 'complete'}`, {});
          Helpers.showToast(done ? 'Reopened task' : 'Task completed!');
          await this.loadData();
        } catch (err) {
          Helpers.showToast(err.message, 'error');
        } finally {
          this.isTogglingId = null;
          btn.disabled = false;
        }
      });
    });

    container.querySelectorAll('.edit-dl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = this.deadlines.find(d => d.id === btn.dataset.dlId);
        if (item && this.openModal) this.openModal(item);
      });
    });

    container.querySelectorAll('.del-dl-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.dlId;
        if (this.isDeletingId === id) return;
        const ok = await Helpers.confirm('Delete Deadline', 'Remove this deadline?', 'Delete');
        if (!ok) return;
        this.isDeletingId = id;
        btn.disabled = true;
        try {
          await API.delete(`/deadlines/${id}`);
          Helpers.showToast('Deadline deleted');
          await this.loadData();
        } catch (err) {
          Helpers.showToast(err.message, 'error');
        } finally {
          this.isDeletingId = null;
          btn.disabled = false;
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
    const categoryLabel = d.category === 'custom'
      ? Helpers.escapeHtml(d.description || 'Custom')
      : (catLabels[d.category] || 'Task');
    return `
      <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-3 ${isDone ? 'opacity-65' : ''}">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap min-w-0">
            ${d.subject_code ? `<span class="font-label-code text-label-code text-on-surface bg-surface-container px-2 py-0.5 rounded">${Helpers.escapeHtml(d.subject_code)}</span>` : ''}
            <span class="px-2 py-0.5 rounded-full bg-[#E89A68]/15 text-[#925B1D] font-label-tag text-label-tag">${categoryLabel}</span>
          </div>
          <div class="flex items-center gap-1">
            <button data-dl-id="${d.id}" class="edit-dl-btn text-outline hover:text-primary p-1" title="Edit">
              <span class="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button data-dl-id="${d.id}" class="del-dl-btn text-outline hover:text-error p-1" title="Delete">
              <span class="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </div>
        <div>
          <h3 class="font-headline-sm text-headline-sm text-on-surface leading-snug ${isDone ? 'line-through' : ''}">${Helpers.escapeHtml(d.title)}</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5 mt-1">
            <span class="material-symbols-outlined text-[15px]">schedule</span>
            <span>${Helpers.formatDateShort(d.due_date)} • ${Helpers.formatTime(d.due_time)}</span>
          </p>
        </div>
        <div class="border-t border-surface-container-high pt-2.5 flex items-center justify-end gap-2">
          <button data-dl-id="${d.id}" data-done="${isDone ? '1' : '0'}" class="toggle-dl-btn shrink-0 px-3 py-1.5 rounded-full ${isDone ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface'} font-label-tag text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-[16px]">check_circle</span>
            <span>${isDone ? 'Completed' : 'Mark Complete'}</span>
          </button>
        </div>
      </div>
    `;
  },

  setCategory(cat, customName = '') {
    this.selectedCategory = cat || 'assignment';
    document.querySelectorAll('.dl-cat-btn').forEach(b => {
      const isSelected = b.dataset.cat === this.selectedCategory;
      b.classList.toggle('bg-secondary-container', isSelected);
      b.classList.toggle('text-on-secondary-container', isSelected);
      b.classList.toggle('bg-surface-container-lowest', !isSelected);
      b.classList.toggle('text-on-surface', !isSelected);
    });

    const customWrap = document.getElementById('dl-custom-name-wrap');
    const customInput = document.getElementById('dl-custom-name');
    if (this.selectedCategory === 'custom') {
      customWrap?.classList.remove('hidden');
      if (customInput) customInput.value = customName || '';
    } else {
      customWrap?.classList.add('hidden');
      if (customInput) customInput.value = '';
    }
  },

  attachEvents() {
    const modal = document.getElementById('add-task-modal');
    const form = document.getElementById('dl-create-form');
    const modalTitle = document.getElementById('dl-modal-title');
    const submitLabel = document.getElementById('dl-submit-label');

    const open = (existing = null) => {
      form?.reset();
      if (existing && existing.id) {
        this.editingDeadlineId = existing.id;
        this.editingOriginalCategory = existing.category || 'assignment';
        if (modalTitle) modalTitle.textContent = 'Edit Deliverable';
        if (submitLabel) submitLabel.textContent = 'Save Changes';
        document.getElementById('dl-title').value = existing.title || '';
        document.getElementById('dl-subject').value = existing.subject_id || '';
        document.getElementById('dl-date').value = existing.due_date || new Date().toISOString().split('T')[0];
        document.getElementById('dl-time').value = existing.due_time || '23:59';
        this.setCategory(this.editingOriginalCategory, this.editingOriginalCategory === 'custom' ? (existing.description || '') : '');
      } else {
        this.editingDeadlineId = null;
        this.editingOriginalCategory = null;
        if (modalTitle) modalTitle.textContent = 'New Deliverable';
        if (submitLabel) submitLabel.textContent = 'Schedule Deliverable';
        document.getElementById('dl-date').value = new Date().toISOString().split('T')[0];
        this.setCategory('assignment', '');
      }
      modal?.classList.remove('hidden');
      modal?.classList.add('flex');
    };
    this.openModal = open;

    const close = () => {
      this.editingDeadlineId = null;
      this.editingOriginalCategory = null;
      modal?.classList.add('hidden');
      modal?.classList.remove('flex');
    };

    document.getElementById('add-deadline-btn')?.addEventListener('click', () => open(null));
    document.getElementById('dl-discard-btn')?.addEventListener('click', close);
    document.getElementById('dl-modal-backdrop')?.addEventListener('click', close);

    document.querySelectorAll('.dl-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const currentCustom = document.getElementById('dl-custom-name')?.value || '';
        this.setCategory(btn.dataset.cat, btn.dataset.cat === 'custom' ? currentCustom : '');
        if (btn.dataset.cat === 'custom') {
          document.getElementById('dl-custom-name')?.focus();
        }
      });
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.isSubmitting) return;

      const title = document.getElementById('dl-title').value.trim();
      if (!title) {
        Helpers.showToast('Please enter a deliverable name', 'error');
        return;
      }

      const customName = document.getElementById('dl-custom-name')?.value.trim() || '';
      if (this.selectedCategory === 'custom' && !customName) {
        Helpers.showToast('Please enter a custom task name', 'error');
        document.getElementById('dl-custom-name')?.focus();
        return;
      }

      const btn = document.getElementById('dl-submit-btn');
      this.isSubmitting = true;
      if (btn) btn.disabled = true;

      const payload = {
        title,
        subject_id: document.getElementById('dl-subject').value || null,
        category: this.selectedCategory,
        due_date: document.getElementById('dl-date').value,
        due_time: document.getElementById('dl-time').value || '23:59'
      };
      if (this.selectedCategory === 'custom') {
        payload.description = customName;
      } else if (!this.editingDeadlineId || this.editingOriginalCategory === 'custom') {
        payload.description = null;
      }

      try {
        if (this.editingDeadlineId) {
          await API.put(`/deadlines/${this.editingDeadlineId}`, payload);
          Helpers.showToast('Deadline updated!');
        } else {
          await API.post('/deadlines', payload);
          Helpers.showToast('Deadline scheduled!');
        }
        e.target.reset();
        this.setCategory('assignment', '');
        close();
        await this.loadData();
      } catch (err) {
        Helpers.showToast(err.message || 'Failed to save deadline', 'error');
      } finally {
        this.isSubmitting = false;
        if (btn) btn.disabled = false;
      }
    });
  }
};
