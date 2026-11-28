const NavigationComponent = {
    // Render the floating bottom dock
    renderDock(activeTab = 'dashboard') {
        const tabs = [
            { id: 'dashboard', icon: 'grid_view', label: 'Home' },
            { id: 'deadlines', icon: 'assignment', label: 'Deadlines' },
            { id: 'timetable', icon: 'calendar_today', label: 'Timetable' }
        ];

        return `
            <div class="fixed bottom-6 inset-x-0 z-50 pb-safe pointer-events-none flex justify-center px-4">
                <nav class="pointer-events-auto w-full max-w-[330px] bg-white/95 backdrop-blur-md rounded-full px-2 py-1.5 shadow-lg shadow-black/5 flex items-center justify-between border border-neutral-200/80 ring-1 ring-black/5">
                    ${tabs.map(tab => `
                        <a data-nav="${tab.id}" class="flex items-center gap-1.5 px-${tab.id === activeTab ? '4' : '3'} py-1.5 rounded-full ${
                            tab.id === activeTab 
                                ? 'bg-primary text-white font-medium text-xs tracking-tight shadow-sm' 
                                : 'text-neutral-500 hover:text-neutral-800 font-medium text-xs tracking-tight'
                        } transition-all duration-200 shrink-0 cursor-pointer" href="#${tab.id}">
                            <span class="material-symbols-outlined text-[18px]">${tab.icon}</span>
                            <span>${tab.label}</span>
                        </a>
                    `).join('')}
                </nav>
            </div>
        `;
    },

    // Render the app header
    renderHeader(title = 'Home', showBack = false, showSettings = true, showProfile = true) {
        const user = App.currentUser;
        return `
            <header class="sticky top-0 inset-x-0 z-50 bg-surface/75 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] pt-safe">
                <div class="h-16 px-gutter flex items-center justify-between w-full">
                    <div class="flex items-center gap-space-sm">
                        ${showBack ? `
                            <button onclick="history.back()" aria-label="Go back" class="w-11 h-11 -ml-2 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container-high transition-colors focus:outline-none">
                                <svg aria-hidden="true" class="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
                            </button>
                        ` : ''}
                        <div class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></div>
                        <span class="font-headline-sm text-headline-sm text-on-surface truncate max-w-[170px]">${Helpers.escapeHtml(title)}</span>
                    </div>
                    <div class="flex items-center gap-space-xs">
                        ${showSettings ? `
                            <a href="#settings" class="w-11 h-11 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors focus:outline-none cursor-pointer">
                                <span class="material-symbols-outlined text-[22px]">settings</span>
                            </a>
                        ` : ''}
                        ${showProfile && user ? `
                            <a href="#settings" class="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors focus:outline-none cursor-pointer">
                                <div class="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-label-code text-sm font-semibold ring-1 ring-surface-container-highest">
                                    ${user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                                </div>
                            </a>
                        ` : ''}
                    </div>
                </div>
            </header>
        `;
    }
};
