// ================================================================
//  DATA MANAGER
// ================================================================
const STORAGE_KEY = 'teacherPlannerData';

function getDefaultData() {
    return {
        activities: [],
        settings: {
            periodsPerDay: 8,
            supabaseUrl: 'https://syjhiqlfjieihhpymwdz.supabase.co',
            supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5amhpcWxmamllaWhocHltd2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDI5ODksImV4cCI6MjA5Nzk3ODk4OX0.AUeZ8FmGQ5ZcANqnzwzKN-0wgf4c8VJRnVjVu_9kqt0',
            supabaseTable: 'daily_activities',
        }
    };
}

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultData();
        const parsed = JSON.parse(raw);
        if (!parsed.settings) parsed.settings = getDefaultData().settings;
        if (!parsed.activities) parsed.activities = [];
        
        // Auto-correct common typo in default Supabase URL (missing trailing 'z')
        if (parsed.settings && parsed.settings.supabaseUrl === 'https://syjhiqlfjieihhpymwd.supabase.co') {
            parsed.settings.supabaseUrl = 'https://syjhiqlfjieihhpymwdz.supabase.co';
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
        
        return parsed;
    } catch {
        return getDefaultData();
    }
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getSettings() {
    const data = loadData();
    return data.settings;
}

function saveSettings(settings) {
    const data = loadData();
    data.settings = settings;
    
    // Auto-correct on save as well
    if (data.settings && data.settings.supabaseUrl === 'https://syjhiqlfjieihhpymwd.supabase.co') {
        data.settings.supabaseUrl = 'https://syjhiqlfjieihhpymwdz.supabase.co';
    }
    
    saveData(data);
}

function getActivities() {
    const data = loadData();
    return data.activities;
}

function saveActivities(activities) {
    const data = loadData();
    data.activities = activities;
    saveData(data);
}

function generateId() {
    return 'day_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function getTodayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function getDayEntry(dateStr) {
    const activities = getActivities();
    return activities.find(a => a.date === dateStr) || null;
}

function saveDayEntry(dateStr, periods) {
    const activities = getActivities();
    const existing = activities.findIndex(a => a.date === dateStr);
    const entry = { id: generateId(), date: dateStr, periods: periods };
    if (existing >= 0) {
        activities[existing] = entry;
    } else {
        activities.push(entry);
    }
    saveActivities(activities);
    return entry;
}

function deleteDayEntry(dateStr) {
    let activities = getActivities();
    activities = activities.filter(a => a.date !== dateStr);
    saveActivities(activities);
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}
