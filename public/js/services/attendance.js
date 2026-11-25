const AttendanceCalc = {
    percentage(attended, total) {
        if (total === 0) return 0;
        return (attended / total) * 100;
    },

    classesNeeded(attended, total, required) {
        const r = required / 100;
        if (total === 0) return 0;
        if (attended / total >= r) return 0;
        // (attended + x) / (total + x) >= r
        // attended + x >= r*total + r*x
        // x(1 - r) >= r*total - attended
        // x >= (r*total - attended) / (1 - r)
        if (r >= 1) return -1; // impossible
        const x = Math.ceil((r * total - attended) / (1 - r));
        return Math.max(0, x);
    },

    classesCanMiss(attended, total, required) {
        const r = required / 100;
        if (total === 0) return 0;
        if (attended / total < r) return 0;
        // attended / (total + x) >= r
        // attended >= r * (total + x)
        // attended / r - total >= x
        const x = Math.floor(attended / r - total);
        return Math.max(0, x);
    },

    getStatus(percentage, required) {
        if (percentage >= required + 5) return { status: 'safe', color: '#356143', bgColor: '#E8F3EB', label: 'Safe' };
        if (percentage >= required) return { status: 'warning', color: '#925B1D', bgColor: '#FEF3E2', label: 'Warning' };
        return { status: 'shortage', color: '#A63A37', bgColor: '#FDEAE8', label: 'Shortage' };
    },

    predictFuture(attended, total, remaining, plannedAbsences = 0) {
        const futureAttended = attended + remaining - plannedAbsences;
        const futureTotal = total + remaining;
        return this.percentage(futureAttended, futureTotal);
    },

    formatPercentage(value) {
        return Number(value).toFixed(1);
    }
};
