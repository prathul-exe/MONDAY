const Helpers = {
    // Format date for display
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const options = { weekday: 'long', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    },

    formatDateShort(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    formatTime(timeStr) {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${m} ${ampm}`;
    },

    // Show toast notification
    showToast(message, type = 'success') {
        const existing = document.getElementById('app-toast');
        if (existing) existing.remove();

        const iconMap = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };

        const toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface font-label-tag text-label-tag tracking-wider shadow-lg flex items-center gap-2 z-[100] transition-all duration-300 opacity-0 translate-y-2';
        toast.innerHTML = `
            <span class="material-symbols-outlined text-[18px] text-secondary-fixed">${iconMap[type] || 'info'}</span>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', 'translate-y-2');
            toast.classList.add('opacity-100', 'translate-y-0');
        });

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            toast.classList.remove('opacity-100', 'translate-y-0');
            setTimeout(() => toast.remove(), 300);
        }, 2600);
    },

    // Show confirmation dialog
    async confirm(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm';
            overlay.innerHTML = `
                <div class="bg-surface-container-lowest rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl space-y-4">
                    <h3 class="font-headline-sm text-headline-sm text-on-surface">${title}</h3>
                    <p class="font-body-md text-body-md text-on-surface-variant">${message}</p>
                    <div class="flex gap-3 pt-2">
                        <button id="confirm-cancel" class="flex-1 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-tag text-label-tag uppercase tracking-wider font-semibold active:scale-95 transition-transform">${cancelText}</button>
                        <button id="confirm-ok" class="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-label-tag text-label-tag uppercase tracking-wider font-semibold active:scale-95 transition-transform">${confirmText}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            
            overlay.querySelector('#confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
            overlay.querySelector('#confirm-ok').onclick = () => { overlay.remove(); resolve(true); };
        });
    },

    // SVG circular progress gauge
    circularGauge(percentage, size = 44, strokeWidth = 3.5, statusObj = null) {
        const r = (size - strokeWidth * 2) / 2;
        const circumference = 2 * Math.PI * r;
        const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
        const status = statusObj || AttendanceCalc.getStatus(percentage, 75);
        
        const strokeColor = status.status === 'safe' ? '#7BB28D' : 
                           status.status === 'warning' ? '#E8A968' : '#E88B88';
        const bgColor = status.status === 'safe' ? '#E8F3EB' : 
                        status.status === 'warning' ? '#FEF3E2' : '#FDEAE8';
        const textColor = status.color;
        
        return `
            <div class="relative w-[${size}px] h-[${size}px] flex items-center justify-center shrink-0">
                <svg class="w-[${size}px] h-[${size}px] -rotate-90" viewBox="0 0 ${size} ${size}">
                    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${bgColor}" stroke-width="${strokeWidth}"></circle>
                    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${strokeColor}" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(2)}" stroke-linecap="round" stroke-width="${strokeWidth}"></circle>
                </svg>
                <span class="absolute font-label-code text-[11px] font-semibold" style="color: ${textColor}">${Math.round(percentage)}%</span>
            </div>
        `;
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Day names
    dayName(dayNum) {
        return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayNum] || '';
    },

    dayNameShort(dayNum) {
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayNum] || '';
    },

    // Get greeting based on time
    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    },

    // Loading spinner HTML
    loadingSpinner() {
        return '<div class="flex items-center justify-center py-12"><div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>';
    }
};
