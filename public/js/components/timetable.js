const TimetableComponent = {
  entries: [],
  subjects: [],
  editingSlotId: null,
  isSubmittingSlot: false,
  isDeletingSlotId: null,

  render() {
    return `
      ${NavigationComponent.renderHeader('Class Schedule', false, true, true)}
      <main class="flex-1 flex flex-col relative w-full max-w-lg mx-auto px-gutter pt-4 pb-32 bg-surface">
        <div class="flex flex-col w-full space-y-4">
          <div class="flex items-center justify-between">
            <span class="font-label-tag text-label-tag uppercase text-on-surface-variant">Weekly Matrix</span>
            <div class="flex items-center gap-2">
              <button id="btn-export-ics" class="h-9 px-3 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px]">ios_share</span><span>Export .ics</span>
              </button>
              <button id="btn-add-slot" class="h-9 px-3.5 rounded-full bg-primary text-on-primary text-xs font-semibold flex items-center gap-1 active:scale-95 transition-transform">
                <span class="material-symbols-outlined text-[16px]">add</span><span>Add Slot</span>
              </button>
            </div>
          </div>

          <div id="timetable-matrix-container">
            ${Helpers.loadingSpinner()}
          </div>
        </div>
      </main>

      <!-- Add Class Slot Modal -->
      <div id="add-slot-modal" class="fixed inset-0 z-[100] hidden items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-surface-container-lowest w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
          <div class="flex items-center justify-between">
            <h3 id="slot-modal-title" class="font-headline-sm text-headline-sm text-on-surface">Add Timetable Class</h3>
            <button id="close-slot-modal" class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">close</span></button>
          </div>
          <form id="add-slot-form" class="space-y-3">
            <div>
              <label id="slot-subject-label" class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Subject *</label>
              <select id="slot-subject" required class="w-full rounded-xl bg-surface-container-low p-2.5 text-on-surface focus:outline-none"></select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Day *</label>
                <select id="slot-day" class="w-full rounded-xl bg-surface-container-low p-2.5 text-on-surface focus:outline-none">
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                  <option value="0">Sunday</option>
                  <option value="weekdays">Mon – Fri (All)</option>
                </select>
              </div>
              <div>
                <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Type</label>
                <select id="slot-type" class="w-full rounded-xl bg-surface-container-low p-2.5 text-on-surface focus:outline-none">
                  <option value="lecture">Lecture</option>
                  <option value="lab">Lab</option>
                  <option value="tutorial">Tutorial</option>
                  <option value="seminar">Seminar</option>
                  <option value="break">Break</option>
                  <option value="lunch">Lunch Break</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Start</label>
                <input id="slot-start" type="time" required value="09:00" class="w-full rounded-xl bg-surface-container-low p-2.5 text-on-surface">
              </div>
              <div>
                <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">End</label>
                <input id="slot-end" type="time" required value="10:30" class="w-full rounded-xl bg-surface-container-low p-2.5 text-on-surface">
              </div>
              <div>
                <label class="block font-label-tag text-label-tag uppercase text-on-surface-variant mb-1">Room</label>
                <input id="slot-room" type="text" placeholder="Hall 3B" class="w-full rounded-xl bg-surface-container-low p-2.5 text-on-surface">
              </div>
            </div>
            <button type="submit" id="slot-submit-btn" class="w-full py-3 rounded-xl bg-primary text-on-primary font-label-tag uppercase tracking-wider font-semibold">Save Class Slot</button>
          </form>
        </div>
      </div>

      ${NavigationComponent.renderDock('timetable')}
    `;
  },

  async init() {
    this.attachEvents();
    await this.loadData();
  },

  async loadData() {
    try {
      const [tt, subjects] = await Promise.all([
        API.get('/timetable'),
        API.get('/subjects')
      ]);
      this.entries = tt.entries || [];
      this.subjects = subjects;

      const subjSelect = document.getElementById('slot-subject');
      if (subjSelect) {
        subjSelect.innerHTML = subjects.length === 0
          ? '<option value="">Add a subject first</option>'
          : subjects.map(s => `<option value="${s.id}">${Helpers.escapeHtml(s.code)} — ${Helpers.escapeHtml(s.name)}</option>`).join('');
      }

      this.renderMatrix();
    } catch (err) {
      Helpers.showToast(err.message || 'Failed to load timetable', 'error');
    }
  },

  renderMatrix() {
    const container = document.getElementById('timetable-matrix-container');
    if (!container) return;

    if (this.entries.length === 0) {
      container.innerHTML = `
        <div class="bg-surface-container-lowest rounded-2xl p-8 text-center shadow-sm space-y-2">
          <span class="material-symbols-outlined text-4xl text-outline-variant">calendar_view_week</span>
          <p class="font-headline-sm text-on-surface">Your timetable is empty</p>
          <p class="font-body-sm text-on-surface-variant">Tap "+ Add Slot" to schedule your weekly classes.</p>
        </div>
      `;
      return;
    }

    const days = [1, 2, 3, 4, 5, 6, 0];
    const todayDow = new Date().getDay();
    const timeSlots = [...new Set(this.entries.map(e => e.start_time))].sort();

    container.innerHTML = `
      <div class="bg-surface-container-lowest rounded-2xl border border-surface-variant/40 p-3 shadow-sm overflow-hidden">
        <div class="overflow-x-auto pb-2 -mx-1 px-2">
          <table class="w-full min-w-[600px] border-collapse text-left">
            <thead class="border-b border-surface-container">
              <tr class="text-[11px] font-label-tag text-on-surface-variant uppercase tracking-wider">
                <th class="py-2 px-2.5 w-24 font-semibold text-on-surface">Time</th>
                ${days.map(d => `
                  <th class="py-2 px-2 font-semibold ${d === todayDow ? 'text-primary' : ''}">
                    <div class="flex items-center gap-1">
                      <span>${Helpers.dayNameShort(d)}</span>
                      ${d === todayDow ? '<span class="w-1.5 h-1.5 rounded-full bg-primary"></span>' : ''}
                    </div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-container text-body-sm">
              ${timeSlots.map(slot => `
                <tr class="align-top">
                  <td class="py-2.5 px-2.5 bg-surface-container-low/60 rounded-l-lg">
                    <div class="font-label-code font-semibold text-[11px] text-on-surface">${Helpers.formatTime(slot)}</div>
                  </td>
                  ${days.map(d => {
      const match = this.entries.find(e => e.day_of_week === d && e.start_time === slot);
      if (!match) {
        return `<td class="p-1.5"><div class="p-2 rounded-lg bg-surface-container-low border border-dashed border-surface-variant/60 flex items-center justify-center min-h-[52px]"><span class="text-[10px] text-on-surface-variant/60 italic">Open</span></div></td>`;
      }
      if (match.session_type === 'lunch' || match.session_type === 'break') {
        const isLunch = match.session_type === 'lunch';
        return `
                        <td class="p-1.5">
                          <div class="p-2 rounded-lg bg-surface-container-low border border-dashed border-secondary/40 relative">
                            <div class="flex items-center justify-between gap-1">
                              <span class="font-label-tag font-semibold text-[10px] text-secondary uppercase">${isLunch ? 'Lunch' : 'Break'}</span>
                              <div class="flex items-center gap-1 shrink-0">
                                <button type="button" data-edit-slot="${match.id}" aria-label="Edit timetable entry" class="p-0.5 text-outline hover:text-primary" title="Edit">
                                  <span class="material-symbols-outlined text-[14px]">edit</span>
                                </button>
                                <button type="button" data-del-slot="${match.id}" aria-label="Delete timetable entry" class="p-0.5 text-outline hover:text-error" title="Delete">
                                  <span class="material-symbols-outlined text-[14px]">delete</span>
                                </button>
                              </div>
                            </div>
                            <div class="font-headline-sm text-[11px] font-semibold text-on-surface mt-0.5 leading-tight truncate">${isLunch ? 'Lunch Break' : 'Break / Recess'}</div>
                            <div class="text-[10px] text-on-surface-variant truncate mt-0.5">${Helpers.formatTime(match.start_time)} – ${Helpers.formatTime(match.end_time)}${match.room ? ` • ${Helpers.escapeHtml(match.room)}` : ''}</div>
                          </div>
                        </td>
                      `;
      }
      const isLab = match.session_type === 'lab';
      return `
                      <td class="p-1.5">
                        <div class="p-2 rounded-lg ${isLab ? 'bg-secondary-container/60 border border-secondary-container' : 'bg-surface-container-high/60 border border-surface-variant/40'} relative group">
                          <div class="flex items-center justify-between gap-1">
                            <span class="font-label-code font-semibold text-[11px] ${isLab ? 'text-on-secondary-container' : 'text-secondary'}">${Helpers.escapeHtml(match.subject_code)}</span>
                            <div class="flex items-center gap-1 shrink-0">
                              <button type="button" data-edit-slot="${match.id}" aria-label="Edit timetable entry" class="p-0.5 text-outline hover:text-primary" title="Edit">
                                <span class="material-symbols-outlined text-[14px]">edit</span>
                              </button>
                              <button type="button" data-del-slot="${match.id}" aria-label="Delete timetable entry" class="p-0.5 text-outline hover:text-error" title="Delete">
                                <span class="material-symbols-outlined text-[14px]">delete</span>
                              </button>
                            </div>
                          </div>
                          <div class="font-headline-sm text-[11px] font-semibold text-on-surface mt-0.5 leading-tight truncate">${Helpers.escapeHtml(match.subject_name)}</div>
                          <div class="text-[10px] text-on-surface-variant truncate mt-0.5">${Helpers.formatTime(match.start_time)} – ${Helpers.formatTime(match.end_time)}</div>
                          <div class="text-[10px] text-on-surface-variant truncate">${Helpers.escapeHtml(match.room || match.session_type)}</div>
                        </div>
                      </td>
                    `;
    }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="flex items-center justify-between px-1 text-[11px] font-label-tag text-on-surface-variant">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-surface-container-highest inline-block"></span> Lecture</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-secondary-container inline-block"></span> Lab</span>
        </div>
        <span class="font-medium text-on-surface">${this.entries.length} Weekly Sessions</span>
      </div>
    `;

    container.querySelectorAll('[data-edit-slot]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const entry = this.entries.find(item => item.id === btn.dataset.editSlot);
        if (entry && this.openSlotModal) this.openSlotModal(entry);
      });
    });

    container.querySelectorAll('[data-del-slot]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const slotId = btn.dataset.delSlot;
        if (this.isDeletingSlotId === slotId) return;
        const ok = await Helpers.confirm('Delete Timetable Entry', 'Remove this slot from your weekly timetable?', 'Delete');
        if (!ok) return;
        this.isDeletingSlotId = slotId;
        btn.disabled = true;
        try {
          await API.delete(`/timetable/${slotId}`);
          Helpers.showToast('Slot removed');
          await this.loadData();
        } catch (err) {
          Helpers.showToast(err.message || 'Failed to delete slot', 'error');
        } finally {
          this.isDeletingSlotId = null;
          btn.disabled = false;
        }
      });
    });
  },

  applyTypeState(typeValue) {
    const isBreak = typeValue === 'lunch' || typeValue === 'break';
    const subjSelect = document.getElementById('slot-subject');
    const subjLabel = document.getElementById('slot-subject-label');
    const roomInput = document.getElementById('slot-room');
    if (subjSelect) {
      subjSelect.disabled = isBreak;
      subjSelect.required = !isBreak;
      subjSelect.classList.toggle('opacity-50', isBreak);
    }
    if (subjLabel) subjLabel.textContent = isBreak ? 'Subject (Not needed for break)' : 'Subject *';
    if (roomInput) {
      roomInput.placeholder = typeValue === 'lunch' ? 'Cafeteria / Break' : typeValue === 'break' ? 'Recess / Break' : 'Hall 3B';
    }
  },

  attachEvents() {
    const modal = document.getElementById('add-slot-modal');
    const modalTitle = document.getElementById('slot-modal-title');
    const submitBtn = document.getElementById('slot-submit-btn');
    const weekdaysOption = document.querySelector('#slot-day option[value="weekdays"]');

    const toggle = (show) => {
      if (!show) this.editingSlotId = null;
      modal?.classList.toggle('hidden', !show);
      modal?.classList.toggle('flex', show);
    };

    this.openSlotModal = (entry = null) => {
      if (entry && entry.id) {
        this.editingSlotId = entry.id;
        if (modalTitle) modalTitle.textContent = 'Edit Timetable Class';
        if (submitBtn) submitBtn.textContent = 'Save Changes';
        if (weekdaysOption) weekdaysOption.hidden = true;
        document.getElementById('slot-day').value = String(entry.day_of_week ?? 1);
        document.getElementById('slot-type').value = entry.session_type || 'lecture';
        document.getElementById('slot-start').value = String(entry.start_time || '09:00').slice(0, 5);
        document.getElementById('slot-end').value = String(entry.end_time || '10:30').slice(0, 5);
        document.getElementById('slot-room').value = entry.room || '';
        const subjSelect = document.getElementById('slot-subject');
        if (subjSelect && entry.subject_id) subjSelect.value = entry.subject_id;
        this.applyTypeState(entry.session_type || 'lecture');
      } else {
        this.editingSlotId = null;
        if (modalTitle) modalTitle.textContent = 'Add Timetable Class';
        if (submitBtn) submitBtn.textContent = 'Save Class Slot';
        if (weekdaysOption) weekdaysOption.hidden = false;
        document.getElementById('add-slot-form')?.reset();
        document.getElementById('slot-start').value = '09:00';
        document.getElementById('slot-end').value = '10:30';
        this.applyTypeState(document.getElementById('slot-type')?.value || 'lecture');
      }
      toggle(true);
    };

    document.getElementById('btn-add-slot')?.addEventListener('click', () => this.openSlotModal(null));
    document.getElementById('close-slot-modal')?.addEventListener('click', () => toggle(false));

    document.getElementById('slot-type')?.addEventListener('change', (e) => {
      this.applyTypeState(e.target.value);
      if (!this.editingSlotId) {
        const startInput = document.getElementById('slot-start');
        const endInput = document.getElementById('slot-end');
        if (e.target.value === 'lunch') {
          if (startInput) startInput.value = '12:45';
          if (endInput) endInput.value = '13:30';
        } else if (e.target.value === 'break') {
          if (startInput) startInput.value = '10:30';
          if (endInput) endInput.value = '11:00';
        }
      }
    });

    document.getElementById('add-slot-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.isSubmittingSlot) return;

      const sessionType = document.getElementById('slot-type').value;
      const isBreak = sessionType === 'lunch' || sessionType === 'break';
      const subjectId = document.getElementById('slot-subject').value;
      if (!isBreak && !subjectId) {
        Helpers.showToast('Please add a subject first', 'warning');
        return;
      }

      const startTime = document.getElementById('slot-start').value;
      const endTime = document.getElementById('slot-end').value;
      if (!startTime || !endTime || endTime <= startTime) {
        Helpers.showToast('End time must be later than start time', 'error');
        return;
      }

      this.isSubmittingSlot = true;
      if (submitBtn) submitBtn.disabled = true;

      const room = document.getElementById('slot-room').value.trim() || null;
      const dayVal = document.getElementById('slot-day').value;

      try {
        if (this.editingSlotId) {
          await API.put(`/timetable/${this.editingSlotId}`, {
            subject_id: isBreak ? null : subjectId,
            day_of_week: parseInt(dayVal, 10),
            start_time: startTime,
            end_time: endTime,
            session_type: sessionType,
            room
          });
          Helpers.showToast('Timetable entry updated');
        } else {
          const daysToCreate = dayVal === 'weekdays' ? [1, 2, 3, 4, 5] : [parseInt(dayVal, 10)];
          for (const d of daysToCreate) {
            await API.post('/timetable', {
              subject_id: isBreak ? null : subjectId,
              day_of_week: d,
              start_time: startTime,
              end_time: endTime,
              session_type: sessionType,
              room
            });
          }
          Helpers.showToast(sessionType === 'lunch' ? 'Lunch break added' : sessionType === 'break' ? 'Break slot added' : 'Class slot added');
        }
        toggle(false);
        await this.loadData();
      } catch (err) {
        Helpers.showToast(err.message || 'Failed to save timetable entry', 'error');
      } finally {
        this.isSubmittingSlot = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.getElementById('btn-export-ics')?.addEventListener('click', () => {
      if (this.entries.length === 0) {
        Helpers.showToast('Add classes before exporting', 'warning');
        return;
      }
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MONDAY//Attendance Tracker//EN'];
      this.entries.forEach(e => {
        lines.push('BEGIN:VEVENT');
        const summary = e.session_type === 'lunch' ? 'Lunch Break' : e.session_type === 'break' ? 'Break / Recess' : `${e.subject_code} - ${e.subject_name}`;
        lines.push(`SUMMARY:${summary}`);
        lines.push(`DESCRIPTION:${e.session_type}${e.room ? ' in ' + e.room : ''}`);
        lines.push('END:VEVENT');
      });
      lines.push('END:VCALENDAR');
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'monday-schedule.ics';
      a.click();
      Helpers.showToast('Exported monday-schedule.ics');
    });
  }
};
