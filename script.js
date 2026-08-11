// CONSTANTS
const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PRAYER_NAMES = {
    fajr: 'Fajr',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha'
};

const STORAGE_KEY = 'prayertracker_app_state';

// STATE
let appState = {
    records: {}
};

let activeTab = 'today';
let currentCalDate = new Date();
let selectedCalDateStr = null;

// CAPACITOR NATIVE CONFIG (FULLSCREEN / CAMERA CUTOUT)
async function enableEdgeToEdge() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar) {
        const { StatusBar } = window.Capacitor.Plugins;
        try {
            // Draws webview under the status bar / camera cutout
            await StatusBar.setOverlaysWebView({ overlay: true });
            await StatusBar.setStyle({ style: 'DARK' });
        } catch (e) {
            console.log('StatusBar error:', e);
        }
    }
}

// DATE HELPERS
function getTodayStr() {
    return formatDateStr(new Date());
}

function formatDateStr(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateStr(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatDisplayDate(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// STORAGE
function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                appState.records = parsed.records || {};
            }
        }
    } catch (e) {
        console.error('Failed to load state:', e);
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
        console.error('Failed to save state:', e);
    }
}

// RECORD HELPERS
function getDayRecord(dateStr) {
    if (!appState.records[dateStr]) {
        appState.records[dateStr] = {
            fajr: false,
            dhuhr: false,
            asr: false,
            maghrib: false,
            isha: false
        };
    }
    return appState.records[dateStr];
}

function countCompletedPrayers(record) {
    if (!record) return 0;
    return PRAYERS.reduce((acc, p) => acc + (record[p] ? 1 : 0), 0);
}

function isPerfectDay(record) {
    return countCompletedPrayers(record) === 5;
}

// NAVIGATION
function switchTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
}

// STREAKS
function calculateStreaks() {
    const todayStr = getTodayStr();
    
    let currentStreak = 0;
    let checkDate = new Date();
    let checkStr = formatDateStr(checkDate);
    
    const todayRecord = appState.records[todayStr];
    if (todayRecord && isPerfectDay(todayRecord)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
        checkStr = formatDateStr(checkDate);
    } else {
        checkDate.setDate(checkDate.getDate() - 1);
        checkStr = formatDateStr(checkDate);
    }
    
    while (appState.records[checkStr] && isPerfectDay(appState.records[checkStr])) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
        checkStr = formatDateStr(checkDate);
    }
    
    let bestStreak = 0;
    const sortedDates = Object.keys(appState.records)
        .filter(d => d <= todayStr)
        .sort();
        
    let tempStreak = 0;
    let prevDate = null;
    
    for (const dateStr of sortedDates) {
        const rec = appState.records[dateStr];
        if (isPerfectDay(rec)) {
            if (prevDate) {
                const diffDays = Math.round((parseDateStr(dateStr) - parseDateStr(prevDate)) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    tempStreak++;
                } else {
                    tempStreak = 1;
                }
            } else {
                tempStreak = 1;
            }
            prevDate = dateStr;
            if (tempStreak > bestStreak) {
                bestStreak = tempStreak;
            }
        } else {
            tempStreak = 0;
            prevDate = null;
        }
    }
    
    return { currentStreak, bestStreak };
}

// RENDER FUNCTIONS
function renderHeaderDate() {
    document.getElementById('current-date-text').textContent = formatDisplayDate(new Date());
}

function renderTodayTracker() {
    const todayStr = getTodayStr();
    const record = getDayRecord(todayStr);
    const completedCount = countCompletedPrayers(record);
    const percentage = Math.round((completedCount / 5) * 100);

    document.getElementById('progress-count').textContent = `${completedCount} / 5`;
    document.getElementById('progress-percentage').textContent = `${percentage}%`;
    document.getElementById('progress-bar-fill').style.width = `${percentage}%`;

    const prayersList = document.getElementById('prayers-list');
    prayersList.innerHTML = '';

    PRAYERS.forEach(prayer => {
        const isCompleted = !!record[prayer];
        const row = document.createElement('div');
        row.className = `prayer-row ${isCompleted ? 'completed' : ''}`;
        
        row.innerHTML = `
            <span class="prayer-name">${PRAYER_NAMES[prayer]}</span>
            <div class="prayer-check-btn">
                <svg class="prayer-check-icon" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
        `;

        row.addEventListener('click', () => {
            record[prayer] = !record[prayer];
            saveState();
            renderAll();
        });

        prayersList.appendChild(row);
    });
}

function renderStreaks() {
    const { currentStreak, bestStreak } = calculateStreaks();
    document.getElementById('current-streak').textContent = currentStreak;
    document.getElementById('best-streak').textContent = bestStreak;
    document.getElementById('stat-best-streak').textContent = bestStreak;
}

function renderRecentHistory() {
    const recentList = document.getElementById('recent-list');
    recentList.innerHTML = '';

    const today = new Date();
    
    for (let i = 0; i < 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = formatDateStr(d);
        const record = appState.records[dateStr] || {};

        let label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

        const row = document.createElement('div');
        row.className = 'recent-row';

        const dotsHtml = PRAYERS.map(p => `<div class="recent-dot ${record[p] ? 'done' : ''}"></div>`).join('');

        row.innerHTML = `
            <span class="recent-day-label">${label}</span>
            <div class="recent-dots">${dotsHtml}</div>
        `;

        recentList.appendChild(row);
    }
}

// CALENDAR WITH CIRCULAR PROGRESS RINGS
function renderCalendar() {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;

    const daysGrid = document.getElementById('calendar-days-grid');
    daysGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon=0
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayStr = getTodayStr();

    for (let i = 0; i < offset; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-cell empty';
        daysGrid.appendChild(emptyCell);
    }

    const circumference = 2 * Math.PI * 14;

    for (let day = 1; day <= totalDays; day++) {
        const cellDate = new Date(year, month, day);
        const dateStr = formatDateStr(cellDate);
        const record = appState.records[dateStr];
        const count = countCompletedPrayers(record);

        const isFuture = dateStr > todayStr;
        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        if (dateStr === todayStr) cell.classList.add('today');
        if (selectedCalDateStr === dateStr) cell.classList.add('selected');

        const dashOffset = isFuture ? circumference : circumference - (count / 5) * circumference;

        cell.innerHTML = `
            <svg class="cal-ring-svg" viewBox="0 0 36 36">
                <circle class="cal-ring-bg" cx="18" cy="18" r="14" />
                <circle class="cal-ring-fill" cx="18" cy="18" r="14" 
                    stroke-dasharray="${circumference}" 
                    stroke-dashoffset="${dashOffset}" />
            </svg>
            <span class="cal-cell-num">${day}</span>
        `;

        if (!isFuture) {
            cell.addEventListener('click', () => {
                selectedCalDateStr = dateStr;
                renderCalendar();
                renderCalendarDetails(dateStr);
            });
        } else {
            cell.style.opacity = '0.3';
            cell.style.cursor = 'default';
        }

        daysGrid.appendChild(cell);
    }
}

// EDITABLE PAST PRAYER DETAILS
function renderCalendarDetails(dateStr) {
    const detailsContainer = document.getElementById('calendar-day-details');
    if (!dateStr) {
        detailsContainer.classList.add('hidden');
        return;
    }

    detailsContainer.classList.remove('hidden');

    const d = parseDateStr(dateStr);
    document.getElementById('details-date-title').textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    const record = getDayRecord(dateStr);
    const count = countCompletedPrayers(record);
    document.getElementById('details-summary').textContent = `${count} / 5`;

    const listEl = document.getElementById('details-prayers-list');
    listEl.innerHTML = '';

    PRAYERS.forEach(p => {
        const isDone = !!record[p];
        const row = document.createElement('div');
        row.className = `detail-row ${isDone ? 'completed' : ''}`;
        row.innerHTML = `
            <span class="detail-name">${PRAYER_NAMES[p]}</span>
            <span class="detail-status">${isDone ? '✓ Completed' : '○ Missed'}</span>
        `;

        row.addEventListener('click', () => {
            record[p] = !record[p];
            saveState();
            renderAll();
        });

        listEl.appendChild(row);
    });
}

function renderStatistics() {
    const todayStr = getTodayStr();
    let totalCompleted = 0;
    let perfectDaysCount = 0;

    Object.keys(appState.records).forEach(dateStr => {
        if (dateStr <= todayStr) {
            const rec = appState.records[dateStr];
            const count = countCompletedPrayers(rec);
            totalCompleted += count;
            if (count === 5) perfectDaysCount++;
        }
    });

    document.getElementById('stat-total').textContent = totalCompleted;
    document.getElementById('stat-perfect-days').textContent = perfectDaysCount;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysPassedInMonth = now.getDate();

    let monthCompleted = 0;
    for (let i = 1; i <= daysPassedInMonth; i++) {
        const d = new Date(currentYear, currentMonth, i);
        const dStr = formatDateStr(d);
        const rec = appState.records[dStr];
        monthCompleted += countCompletedPrayers(rec);
    }

    const monthPossible = daysPassedInMonth * 5;
    const monthRate = monthPossible > 0 ? Math.round((monthCompleted / monthPossible) * 100) : 0;

    document.getElementById('stat-month-rate').textContent = `${monthRate}%`;
}

function renderAll() {
    renderHeaderDate();
    renderTodayTracker();
    renderStreaks();
    renderRecentHistory();
    renderCalendar();
    if (selectedCalDateStr) renderCalendarDetails(selectedCalDateStr);
    renderStatistics();
}

function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    document.getElementById('prev-month').addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        renderCalendar();
    });
}

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    enableEdgeToEdge();
    loadState();
    setupEventListeners();

    selectedCalDateStr = getTodayStr();
    renderAll();
});