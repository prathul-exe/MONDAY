/**
 * Smart Attendance Calculation Engine
 * Core computation module - pure functions, no side effects
 */

/**
 * Calculate attendance percentage
 * @param {number} attended - Classes attended
 * @param {number} total - Total classes conducted
 * @returns {number} Percentage (0-100)
 */
function calculatePercentage(attended, total) {
  if (total <= 0) return 0;
  if (attended < 0) attended = 0;
  return (attended / total) * 100;
}

/**
 * Calculate how many consecutive classes must be attended to reach required percentage
 * Formula: (A + x) / (T + x) >= R/100
 * Solving: x >= (R*T - 100*A) / (100 - R)
 * @param {number} attended
 * @param {number} total
 * @param {number} requiredPercentage (e.g. 75)
 * @returns {number} Classes needed (0 if already met, -1 if unreachable)
 */
function calculateClassesNeeded(attended, total, requiredPercentage) {
  if (total <= 0) return 0;
  const r = requiredPercentage / 100;
  const currentPct = attended / total;
  if (currentPct >= r) return 0;
  if (r >= 1) return -1; // Can never reach 100%
  const x = Math.ceil((r * total - attended) / (1 - r));
  return Math.max(0, x);
}

/**
 * Calculate maximum classes that can be missed while staying above required%
 * Formula: A / (T + x) >= R/100
 * Solving: x <= (100*A / R) - T
 * @param {number} attended
 * @param {number} total
 * @param {number} requiredPercentage
 * @returns {number} Classes that can be missed (never negative)
 */
function calculateClassesCanMiss(attended, total, requiredPercentage) {
  if (total <= 0) return 0;
  const r = requiredPercentage / 100;
  if (r <= 0) return Infinity;
  const currentPct = attended / total;
  if (currentPct < r) return 0;
  const x = Math.floor(attended / r - total);
  return Math.max(0, x);
}

/**
 * Predict future attendance percentage
 * @param {number} attended - Current attended
 * @param {number} total - Current total
 * @param {number} remainingClasses - Remaining scheduled classes
 * @param {number} plannedAbsences - Planned absences from remaining
 * @returns {number} Projected percentage
 */
function predictFutureAttendance(attended, total, remainingClasses, plannedAbsences = 0) {
  const futureAttended = attended + Math.max(0, remainingClasses - plannedAbsences);
  const futureTotal = total + remainingClasses;
  return calculatePercentage(futureAttended, futureTotal);
}

/**
 * Calculate recovery path details
 * @param {number} attended
 * @param {number} total
 * @param {number} requiredPercentage
 * @param {number} classesPerWeek
 * @returns {{classesNeeded: number, weeksNeeded: number, projectedPercentage: number, isRecoverable: boolean}}
 */
function calculateRecoveryPath(attended, total, requiredPercentage, classesPerWeek = 3) {
  const classesNeeded = calculateClassesNeeded(attended, total, requiredPercentage);
  
  if (classesNeeded === 0) {
    return {
      classesNeeded: 0,
      weeksNeeded: 0,
      projectedPercentage: calculatePercentage(attended, total),
      isRecoverable: true
    };
  }
  
  if (classesNeeded === -1) {
    return {
      classesNeeded: -1,
      weeksNeeded: -1,
      projectedPercentage: calculatePercentage(attended, total),
      isRecoverable: false
    };
  }
  
  const weeksNeeded = classesPerWeek > 0 ? Math.ceil(classesNeeded / classesPerWeek) : -1;
  const projectedPercentage = calculatePercentage(attended + classesNeeded, total + classesNeeded);
  
  return { classesNeeded, weeksNeeded, projectedPercentage, isRecoverable: true };
}

/**
 * Get attendance status category
 * @param {number} percentage
 * @param {number} requiredPercentage
 * @returns {{status: string, color: string, bgColor: string, label: string}}
 */
function getAttendanceStatus(percentage, requiredPercentage) {
  if (percentage >= requiredPercentage + 5) {
    return { status: 'safe', color: '#356143', bgColor: '#E8F3EB', label: 'Safe', strokeColor: '#7BB28D' };
  }
  if (percentage >= requiredPercentage) {
    return { status: 'warning', color: '#925B1D', bgColor: '#FEF3E2', label: 'Warning', strokeColor: '#E8A968' };
  }
  return { status: 'shortage', color: '#A63A37', bgColor: '#FDEAE8', label: 'Shortage', strokeColor: '#E88B88' };
}

/**
 * Calculate overall attendance from multiple subjects
 * Uses weighted calculation: sum(attended) / sum(total)
 * @param {Array<{attended: number, total: number}>} subjects
 * @returns {number} Overall percentage
 */
function calculateOverallAttendance(subjects) {
  if (!subjects || subjects.length === 0) return 0;
  let totalAttended = 0;
  let totalClasses = 0;
  for (const s of subjects) {
    totalAttended += (s.attended || 0);
    totalClasses += (s.total || 0);
  }
  return calculatePercentage(totalAttended, totalClasses);
}

/**
 * Estimate the last safe date to recover attendance
 * @param {number} attended
 * @param {number} total
 * @param {number} requiredPercentage
 * @param {Array} timetableEntries - [{day_of_week, start_time}]
 * @param {Array<string>} holidays - Array of date strings
 * @param {string} semesterEnd - Semester end date string
 * @returns {{lastSafeDate: string|null, classesRemaining: number, canRecover: boolean}}
 */
function calculateDeadlineDate(attended, total, requiredPercentage, timetableEntries = [], holidays = [], semesterEnd = null) {
  const classesNeeded = calculateClassesNeeded(attended, total, requiredPercentage);
  
  if (classesNeeded === 0) {
    return { lastSafeDate: null, classesRemaining: 0, canRecover: true, message: 'Already above required attendance' };
  }
  if (classesNeeded === -1) {
    return { lastSafeDate: null, classesRemaining: 0, canRecover: false, message: 'Cannot reach required attendance even with 100% future attendance' };
  }
  
  // Count remaining classes from timetable
  const today = new Date();
  const endDate = semesterEnd ? new Date(semesterEnd) : new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000);
  const holidaySet = new Set(holidays);
  
  let remainingClasses = 0;
  let lastClassDate = null;
  const scheduledDays = new Set(timetableEntries.map(e => e.day_of_week));
  
  const d = new Date(today);
  d.setDate(d.getDate() + 1); // Start from tomorrow
  
  while (d <= endDate) {
    const dateStr = d.toISOString().split('T')[0];
    if (scheduledDays.has(d.getDay()) && !holidaySet.has(dateStr)) {
      remainingClasses++;
      lastClassDate = dateStr;
    }
    d.setDate(d.getDate() + 1);
  }
  
  const canRecover = remainingClasses >= classesNeeded;
  
  // Find the date by which all needed classes must be attended
  let classCount = 0;
  let targetDate = null;
  const d2 = new Date(today);
  d2.setDate(d2.getDate() + 1);
  
  while (d2 <= endDate && classCount < classesNeeded) {
    const dateStr = d2.toISOString().split('T')[0];
    if (scheduledDays.has(d2.getDay()) && !holidaySet.has(dateStr)) {
      classCount++;
      targetDate = dateStr;
    }
    d2.setDate(d2.getDate() + 1);
  }
  
  return {
    lastSafeDate: targetDate,
    classesRemaining: remainingClasses,
    canRecover,
    message: canRecover 
      ? `Attend next ${classesNeeded} classes to reach ${requiredPercentage}%` 
      : `Need ${classesNeeded} classes but only ${remainingClasses} remaining`
  };
}

module.exports = {
  calculatePercentage,
  calculateClassesNeeded,
  calculateClassesCanMiss,
  predictFutureAttendance,
  calculateRecoveryPath,
  getAttendanceStatus,
  calculateOverallAttendance,
  calculateDeadlineDate
};
