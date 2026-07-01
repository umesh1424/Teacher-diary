// ================================================================
//  UI: DAILY TAB
// ================================================================
function renderDailyTab() {
    const dateInput = document.getElementById('dailyDate');
    if (!dateInput.value) dateInput.value = getTodayStr();
    const dateStr = dateInput.value;
    const settings = getSettings();
    const periodsPerDay = settings.periodsPerDay || 8;
    const entry = getDayEntry(dateStr);
    const periods = entry ? entry.periods : [];

    const tbody = document.getElementById('periodTableBody');
    tbody.innerHTML = '';
    for (let i = 1; i <= periodsPerDay; i++) {
        const existing = periods.find(p => p.periodNumber === i) || {
            periodNumber: i, classSection: '', subjectTopics: '',
            classwork: '', homework: '', photoUrl: ''
        };
        const tr = document.createElement('tr');
        
        let photoHtml = '';
        const pUrl = existing.photoUrl || '';
        if (pUrl) {
            photoHtml = `
                <div class="photo-cell">
                    <div class="photo-preview-container">
                        <img src="${pUrl}" class="photo-preview-thumb" onclick="openLightbox('${pUrl}')" />
                        <button class="photo-remove-btn" onclick="removePhotoRow(${i})" title="Remove photo">&times;</button>
                    </div>
                    <input type="hidden" class="daily-photo-url" data-period="${i}" value="${escHtml(pUrl)}" />
                </div>
            `;
        } else {
            photoHtml = `
                <div class="photo-cell">
                    <button class="btn btn-outline btn-xs btn-photo-trigger" onclick="triggerPhotoUpload(${i})" style="margin: 0 auto; display: flex;">📷 Add</button>
                    <input type="file" id="photo-input-${i}" class="hidden" accept="image/*" onchange="handlePhotoSelect(event, ${i})" />
                    <input type="hidden" class="daily-photo-url" data-period="${i}" value="" />
                </div>
            `;
        }

        tr.innerHTML = `
          <td class="period-num">${i}</td>
          <td><input type="text" class="daily-class" data-period="${i}" value="${escHtml(existing.classSection || '')}" placeholder="e.g. 10-A" /></td>
          <td><input type="text" class="daily-work" data-period="${i}" value="${escHtml(existing.classwork || '')}" placeholder="What was taught?" /></td>
          <td><input type="text" class="daily-home" data-period="${i}" value="${escHtml(existing.homework || '')}" placeholder="Homework assigned?" /></td>
          <td>${photoHtml}</td>
        `;
        tbody.appendChild(tr);
    }
    document.getElementById('dailyStatus').textContent = entry ? `✅ Loaded entry for ${formatDate(dateStr)}` :
        `📝 No entry yet for ${formatDate(dateStr)}`;
}

function triggerPhotoUpload(periodNumber) {
    document.getElementById(`photo-input-${periodNumber}`).click();
}

function removePhotoRow(periodNumber) {
    const cell = document.querySelector(`#photo-input-${periodNumber}`)?.closest('.photo-cell') || 
                 document.querySelectorAll('.photo-cell')[periodNumber - 1];
    if (cell) {
        cell.innerHTML = `
            <button class="btn btn-outline btn-xs btn-photo-trigger" onclick="triggerPhotoUpload(${periodNumber})" style="margin: 0 auto; display: flex;">📷 Add</button>
            <input type="file" id="photo-input-${periodNumber}" class="hidden" accept="image/*" onchange="handlePhotoSelect(event, ${periodNumber})" />
            <input type="hidden" class="daily-photo-url" data-period="${periodNumber}" value="" />
        `;
    }
}

function handlePhotoSelect(event, periodNumber) {
    const file = event.target.files[0];
    if (!file) return;

    const cell = event.target.closest('.photo-cell');
    const triggerBtn = cell.querySelector('.btn-photo-trigger');
    const originalText = triggerBtn.textContent;
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = '⏳...';

    compressImage(file, 800, 800, 0.7).then(dataUrl => {
        cell.innerHTML = `
            <div class="photo-preview-container">
                <img src="${dataUrl}" class="photo-preview-thumb" onclick="openLightbox('${dataUrl}')" />
                <button class="photo-remove-btn" onclick="removePhotoRow(${periodNumber})" title="Remove photo">&times;</button>
            </div>
            <input type="hidden" class="daily-photo-url" data-period="${periodNumber}" value="${escHtml(dataUrl)}" />
        `;
    }).catch(err => {
        showToast('Image processing failed: ' + err.message, 'error');
        triggerBtn.disabled = false;
        triggerBtn.textContent = originalText;
    });
}

function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = err => reject(err);
        };
        reader.onerror = err => reject(err);
    });
}

async function saveDaily() {
    const dateStr = document.getElementById('dailyDate').value;
    if (!dateStr) { showToast('Please select a date.', 'warning'); return; }
    const rows = document.querySelectorAll('#periodTableBody tr');
    const periods = [];
    let hasData = false;

    const saveBtn = document.getElementById('saveDailyBtn');
    const originalBtnHtml = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        for (const tr of rows) {
            const periodNum = parseInt(tr.querySelector('.period-num')?.textContent || '0');
            const classVal = tr.querySelector('.daily-class')?.value?.trim() || '';
            const workVal = tr.querySelector('.daily-work')?.value?.trim() || '';
            const homeVal = tr.querySelector('.daily-home')?.value?.trim() || '';
            let photoVal = tr.querySelector('.daily-photo-url')?.value || '';

            if (photoVal.startsWith('data:image/')) {
                const client = getSupabaseClient();
                if (client) {
                    try {
                        const fileBlob = dataURLtoBlob(photoVal);
                        const fileName = `activities/${dateStr}_p${periodNum}.jpg`;
                        
                        const { data, error } = await client.storage
                            .from('activity_photos')
                            .upload(fileName, fileBlob, {
                                contentType: 'image/jpeg',
                                upsert: true
                            });
                        
                        if (error) {
                            console.warn(`Photo upload failed for Period ${periodNum}: ${error.message}`);
                            showToast(`⚠️ Photo upload failed (Supabase bucket 'activity_photos' not found or misconfigured). Saving locally instead!`, 'warning', 6000);
                        } else {
                            const { data: urlData } = client.storage
                                .from('activity_photos')
                                .getPublicUrl(fileName);
                            photoVal = urlData.publicUrl;
                        }
                    } catch (uploadErr) {
                        console.warn(`Photo upload failed:`, uploadErr);
                        showToast(`⚠️ Photo upload failed. Saved locally.`, 'warning', 5000);
                    }
                }
            }

            periods.push({
                periodNumber: periodNum,
                classSection: classVal,
                subjectTopics: '',
                classwork: workVal,
                homework: homeVal,
                photoUrl: photoVal
            });

            if (classVal || workVal || homeVal || photoVal) hasData = true;
        }

        if (!hasData) {
            if (!confirm('All fields are empty. Do you want to clear this day\'s entry?')) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnHtml;
                return;
            }
        }

        saveDayEntry(dateStr, periods);
        showToast(`✅ Saved activities for ${formatDate(dateStr)}`, 'success');
        renderDailyTab();
        updateBadge();
        if (document.getElementById('tab-view').classList.contains('active')) renderViewTab();
    } catch (err) {
        showToast(`❌ Error saving: ${err.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnHtml;
    }
}

function copyPreviousDay() {
    const dateStr = document.getElementById('dailyDate').value;
    if (!dateStr) { showToast('Please select a date.', 'warning'); return; }
    const activities = getActivities();
    const sorted = activities.map(a => a.date).sort();
    const idx = sorted.indexOf(dateStr);
    let prevDate = null;
    if (idx > 0) prevDate = sorted[idx - 1];
    else if (sorted.length > 0 && sorted[0] !== dateStr) prevDate = sorted[sorted.length - 1];
    if (!prevDate) { showToast('No previous day found to copy from.', 'info'); return; }
    const prevEntry = getDayEntry(prevDate);
    if (!prevEntry) { showToast('No data for previous day.', 'info'); return; }

    const tbody = document.getElementById('periodTableBody');
    const trs = tbody.querySelectorAll('tr');
    trs.forEach(tr => {
        const periodNum = parseInt(tr.querySelector('.period-num')?.textContent || '0');
        const prevPeriod = prevEntry.periods.find(p => p.periodNumber === periodNum);
        if (prevPeriod) {
            tr.querySelector('.daily-class').value = prevPeriod.classSection || '';
            tr.querySelector('.daily-work').value = prevPeriod.classwork || '';
            tr.querySelector('.daily-home').value = prevPeriod.homework || '';
            
            const photoCell = tr.querySelector('.photo-cell');
            if (photoCell) {
                const pUrl = prevPeriod.photoUrl || '';
                if (pUrl) {
                    photoCell.innerHTML = `
                        <div class="photo-preview-container">
                            <img src="${pUrl}" class="photo-preview-thumb" onclick="openLightbox('${pUrl}')" />
                            <button class="photo-remove-btn" onclick="removePhotoRow(${periodNum})" title="Remove photo">&times;</button>
                        </div>
                        <input type="hidden" class="daily-photo-url" data-period="${periodNum}" value="${escHtml(pUrl)}" />
                    `;
                } else {
                    photoCell.innerHTML = `
                        <button class="btn btn-outline btn-xs btn-photo-trigger" onclick="triggerPhotoUpload(${periodNum})" style="margin: 0 auto; display: flex;">📷 Add</button>
                        <input type="file" id="photo-input-${periodNum}" class="hidden" accept="image/*" onchange="handlePhotoSelect(event, ${periodNum})" />
                        <input type="hidden" class="daily-photo-url" data-period="${periodNum}" value="" />
                    `;
                }
            }
        }
    });
    showToast(`📋 Copied from ${formatDate(prevDate)}`, 'info');
    document.getElementById('dailyStatus').textContent = `📋 Copied from ${formatDate(prevDate)} — click Save to confirm.`;
}

function resetDaily() {
    if (!confirm('Reset current day\'s entries? Unsaved changes will be lost.')) return;
    const dateStr = document.getElementById('dailyDate').value;
    if (!dateStr) return;
    const tbody = document.getElementById('periodTableBody');
    tbody.querySelectorAll('tr').forEach(tr => {
        tr.querySelector('.daily-class').value = '';
        tr.querySelector('.daily-work').value = '';
        tr.querySelector('.daily-home').value = '';
        const periodNum = parseInt(tr.querySelector('.period-num')?.textContent || '0');
        removePhotoRow(periodNum);
    });
    document.getElementById('dailyStatus').textContent = `🔄 Reset for ${formatDate(dateStr)}`;
    showToast('Reset complete.', 'info');
}

// ================================================================
//  UI: VIEW TAB
// ================================================================
function renderViewTab() {
    const activities = getActivities();
    const search = document.getElementById('viewSearch').value.toLowerCase().trim();
    const dateFrom = document.getElementById('viewDateFrom').value;
    const dateTo = document.getElementById('viewDateTo').value;
    const sort = document.getElementById('viewSort').value;

    let filtered = [...activities];

    if (search) {
        filtered = filtered.filter(day => {
            const match = day.periods.some(p =>
                (p.classSection || '').toLowerCase().includes(search) ||
                (p.classwork || '').toLowerCase().includes(search) ||
                (p.homework || '').toLowerCase().includes(search)
            );
            return match || day.date.includes(search);
        });
    }

    if (dateFrom) filtered = filtered.filter(d => d.date >= dateFrom);
    if (dateTo) filtered = filtered.filter(d => d.date <= dateTo);

    filtered.sort((a, b) => {
        if (sort === 'date-asc') return a.date.localeCompare(b.date);
        return b.date.localeCompare(a.date);
    });

    const container = document.getElementById('viewResults');
    if (filtered.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="emoji">📭</span>
            <h3>No activities found</h3>
            <p>${activities.length === 0 ? 'Start adding your daily activities in the Daily Entry tab!' : 'Try adjusting your search or filters.'}</p>
          </div>
        `;
        return;
    }

    let html = '';
    for (const day of filtered) {
        const dateDisplay = formatDate(day.date);
        const periodCount = day.periods.filter(p => p.classSection || p.classwork || p.homework || p.photoUrl).length;
        const total = day.periods.length;
        html += `
          <div class="day-card" data-date="${day.date}">
            <div class="day-header" onclick="toggleDayCard(this)">
              <span class="day-date">${dateDisplay} <small>${periodCount}/${total} periods filled</small></span>
              <div class="day-actions">
                <button class="btn btn-outline btn-xs" onclick="editDay('${day.date}')">✏️ Edit</button>
                <button class="btn btn-danger btn-xs" onclick="deleteDay('${day.date}')">🗑</button>
              </div>
            </div>
            <div class="period-list">
              ${day.periods.map(p => `
                <div class="period-item">
                  <span class="p-label">P${p.periodNumber}</span>
                  <span class="p-class" title="Class & Section">${escHtml(p.classSection) || '—'}</span>
                  <span class="p-work" title="Classwork">📖 ${escHtml(p.classwork) || '—'}</span>
                  <span class="p-home" title="Homework">📝 ${escHtml(p.homework) || '—'}</span>
                  <span class="p-photo" title="Photo">
                    ${p.photoUrl ? `<img src="${p.photoUrl}" class="view-photo-thumb" onclick="openLightbox('${p.photoUrl}')" alt="Activity Photo" />` : '—'}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
    }
    container.innerHTML = html;
}

function toggleDayCard(el) {
    const card = el.closest('.day-card');
    if (card) card.classList.toggle('expanded');
}

function editDay(dateStr) {
    document.querySelector('[data-tab="daily"]').click();
    document.getElementById('dailyDate').value = dateStr;
    renderDailyTab();
    showToast(`✏️ Editing ${formatDate(dateStr)}`, 'info');
}

function deleteDay(dateStr) {
    if (!confirm(`Delete entry for ${formatDate(dateStr)}?`)) return;
    deleteDayEntry(dateStr);
    showToast(`🗑 Deleted ${formatDate(dateStr)}`, 'warning');
    renderViewTab();
    updateBadge();
    const dailyDate = document.getElementById('dailyDate').value;
    if (dailyDate === dateStr) renderDailyTab();
}

// ================================================================
//  UI: SETTINGS TAB
// ================================================================
function loadSettingsUI() {
    const settings = getSettings();
    document.getElementById('settingsPeriods').value = settings.periodsPerDay || 8;
    document.getElementById('settingsSupabaseUrl').value = settings.supabaseUrl || '';
    document.getElementById('settingsSupabaseKey').value = settings.supabaseKey || '';
    document.getElementById('settingsSupabaseTable').value = settings.supabaseTable || 'daily_activities';
}

function savePeriodsSetting() {
    const val = parseInt(document.getElementById('settingsPeriods').value);
    if (val < 1 || val > 20) { showToast('Please enter a number between 1 and 20.', 'warning'); return; }
    const settings = getSettings();
    settings.periodsPerDay = val;
    saveSettings(settings);
    showToast(`✅ Periods per day set to ${val}`, 'success');
    if (document.getElementById('tab-daily').classList.contains('active')) renderDailyTab();
}

function saveSupabaseSettings(quiet = false) {
    const settings = getSettings();
    const urlVal = document.getElementById('settingsSupabaseUrl').value.trim();
    const keyVal = document.getElementById('settingsSupabaseKey').value.trim();
    const tableVal = document.getElementById('settingsSupabaseTable').value.trim() || 'daily_activities';

    if (settings.supabaseUrl !== urlVal || settings.supabaseKey !== keyVal || settings.supabaseTable !== tableVal) {
        settings.supabaseUrl = urlVal;
        settings.supabaseKey = keyVal;
        settings.supabaseTable = tableVal;
        saveSettings(settings);
        supabaseClient = null;
        if (!quiet) {
            showToast('✅ Supabase settings saved.', 'success');
            document.getElementById('supabaseStatus').textContent = 'Settings saved.';
        }
        setupAuthListener();
    }
}

async function testSupabase() {
    const btn = document.getElementById('settingsSupabaseTest');
    const statusEl = document.getElementById('supabaseStatus');
    const originalContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Testing...';
    statusEl.textContent = '⏳ Testing connection...';

    saveSupabaseSettings(true);
    const result = await testSupabaseConnection();

    btn.disabled = false;
    btn.innerHTML = originalContent;

    if (result.ok) {
        statusEl.textContent = '✅ Connected!';
        showToast('✅ Supabase connection successful!', 'success');
    } else {
        statusEl.textContent = '❌ Connection failed.';
        showToast('❌ Connection failed: ' + result.error, 'error');
    }
}

async function doPushSupabase() {
    const btn = document.getElementById('settingsSupabasePush');
    const statusEl = document.getElementById('supabaseStatus');
    const originalContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Pushing...';
    statusEl.textContent = '⏳ Pushing to Supabase...';

    saveSupabaseSettings(true);
    const result = await pushToSupabase();

    btn.disabled = false;
    btn.innerHTML = originalContent;

    if (result.ok) {
        statusEl.textContent = '✅ ' + (result.message || 'Push complete.');
        showToast('✅ ' + (result.message || 'Push to Supabase complete!'), 'success');
    } else {
        statusEl.textContent = '❌ Push failed.';
        showToast('❌ Push failed: ' + result.error, 'error');
    }
}

async function doPullSupabase() {
    const btn = document.getElementById('settingsSupabasePull');
    const statusEl = document.getElementById('supabaseStatus');
    const originalContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Pulling...';
    statusEl.textContent = '⏳ Pulling from Supabase...';

    saveSupabaseSettings(true);
    const result = await pullFromSupabase();

    btn.disabled = false;
    btn.innerHTML = originalContent;

    if (result.ok) {
        if (result.data) {
            const existing = getActivities();
            const merged = [...existing];
            for (const act of result.data) {
                const idx = merged.findIndex(a => a.date === act.date);
                if (idx >= 0) merged[idx] = act;
                else merged.push(act);
            }
            saveActivities(merged);
            updateBadge();
            if (document.getElementById('tab-view').classList.contains('active')) renderViewTab();
            if (document.getElementById('tab-daily').classList.contains('active')) renderDailyTab();
        }
        statusEl.textContent = '✅ ' + (result.message || 'Pull complete.');
        showToast('✅ ' + (result.message || 'Pull from Supabase complete!'), 'success');
    } else {
        statusEl.textContent = '❌ Pull failed.';
        showToast('❌ Pull failed: ' + result.error, 'error');
    }
}

function clearAllData() {
    if (!confirm('⚠️ Are you sure you want to delete ALL local activities? This cannot be undone!')) return;
    if (!confirm('⚠️ Final confirmation: delete all data?')) return;
    saveActivities([]);
    updateBadge();
    renderDailyTab();
    if (document.getElementById('tab-view').classList.contains('active')) renderViewTab();
    showToast('🗑 All data cleared.', 'warning');
}

// ================================================================
//  UI: BADGE
// ================================================================
function updateBadge() {
    const activities = getActivities();
    const total = activities.reduce((sum, d) => sum + d.periods.filter(p => p.classSection || p.subjectTopics || p.classwork || p.homework || p.photoUrl)
        .length, 0);
    document.getElementById('viewBadge').textContent = total;
}

// ================================================================
//  UI: LIGHTBOX
// ================================================================
function openLightbox(url) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = url;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
}

// ================================================================
//  UI: SQL HELPER
// ================================================================
function toggleSqlHelper() {
    const box = document.getElementById('sqlHelperBox');
    const content = document.getElementById('sqlHelperContent');
    const chevron = document.getElementById('sqlHelperChevron');
    if (box.classList.contains('expanded')) {
        box.classList.remove('expanded');
        content.style.maxHeight = '0px';
        chevron.textContent = '▼';
    } else {
        box.classList.add('expanded');
        content.style.maxHeight = content.scrollHeight + 'px';
        chevron.textContent = '▲';
    }
}

function copySqlScript(event) {
    if (event) event.stopPropagation();
    const sqlText = `-- ============================================
-- TEACHER PLANNER - COMPLETE SUPABASE SQL SETUP
-- ============================================

-- 1. USER PROFILES TABLE (stores registered user info)
DROP TABLE IF EXISTS user_profiles CASCADE;

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
ON user_profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, subject)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'subject', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. DAILY ACTIVITIES TABLE
DROP TABLE IF EXISTS daily_activities CASCADE;

CREATE TABLE daily_activities (
  user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  date DATE NOT NULL,
  period_number INTEGER NOT NULL,
  class_section TEXT DEFAULT '',
  classwork TEXT DEFAULT '',
  homework TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, date, period_number)
);

ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read own data"
ON daily_activities FOR SELECT TO authenticated, anon USING (auth.uid() = user_id);

CREATE POLICY "Allow users to modify own data"
ON daily_activities FOR ALL TO authenticated, anon USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`;

    navigator.clipboard.writeText(sqlText).then(() => {
        const btn = event ? (event.currentTarget || event.target) : null;
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '✅ Copied!';
            btn.style.background = '#059669';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
            }, 2000);
        }
        showToast('SQL script copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy: ' + err.message, 'error');
    });
}

// ================================================================
//  UI: TEST PHOTO HELPER
// ================================================================
function loadTestPhoto() {
    const dailyTabBtn = document.querySelector('[data-tab="daily"]');
    if (dailyTabBtn) dailyTabBtn.click();
    
    setTimeout(() => {
        const mockBase64 = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const cell = document.querySelector('#photo-input-1')?.closest('.photo-cell');
        if (cell) {
            cell.innerHTML = `
                <div class="photo-preview-container">
                    <img src="${mockBase64}" class="photo-preview-thumb" onclick="openLightbox('${mockBase64}')" />
                    <button class="photo-remove-btn" onclick="removePhotoRow(1)" title="Remove photo">&times;</button>
                </div>
                <input type="hidden" class="daily-photo-url" data-period="1" value="${mockBase64}" />
            `;
            showToast('🔬 Loaded mock test photo for Period 1!', 'success');
        } else {
            showToast('Could not find Period 1 photo cell.', 'warning');
        }
    }, 100);
}
