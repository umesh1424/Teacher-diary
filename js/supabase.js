// ================================================================
//  SUPABASE SERVICE
// ================================================================
let supabaseClient = null;
let supabaseClientConfig = '';

function getSupabaseClient() {
    const settings = getSettings();
    if (!settings.supabaseUrl || !settings.supabaseKey) return null;
    let url = settings.supabaseUrl.trim();
    if (url.endsWith('/')) url = url.slice(0, -1);
    if (url.endsWith('/rest/v1')) url = url.slice(0, -8);
    if (url.endsWith('/')) url = url.slice(0, -1);

    const configKey = url + '|' + settings.supabaseKey;
    if (supabaseClient && supabaseClientConfig !== configKey) {
        supabaseClient = null;
    }

    if (!supabaseClient) {
        try {
            supabaseClient = window.supabase.createClient(url, settings.supabaseKey);
            supabaseClientConfig = configKey;
        } catch {
            return null;
        }
    }
    return supabaseClient;
}

async function testSupabaseConnection() {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Supabase not configured' };
    try {
        const { error } = await client.from(getSettings().supabaseTable || 'daily_activities').select('count', {
            count: 'exact', head: true
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

async function pushToSupabase() {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Supabase not configured. Go to Settings and enter your Supabase URL and API Key.' };

    let userId = null;
    try {
        const { data: { session } } = await client.auth.getSession();
        userId = session?.user?.id;
    } catch (e) {
        console.warn('Could not get Supabase session:', e.message);
    }

    if (!userId) return { ok: false, error: 'No active session. Please sign in first via the login page.' };

    const table = getSettings().supabaseTable || 'daily_activities';
    const activities = getActivities();

    let updatedActivitiesLocal = false;
    const rows = [];

    for (const day of activities) {
        for (const p of day.periods) {
            let photoUrl = p.photoUrl || '';
            if (photoUrl.startsWith('data:image/')) {
                try {
                    const fileBlob = dataURLtoBlob(photoUrl);
                    const fileName = `activities/${day.date}_p${p.periodNumber}.jpg`;

                    const { data, error } = await client.storage
                        .from('activity_photos')
                        .upload(fileName, fileBlob, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });

                    if (!error) {
                        const { data: urlData } = client.storage
                            .from('activity_photos')
                            .getPublicUrl(fileName);
                        photoUrl = urlData.publicUrl;
                        p.photoUrl = photoUrl;
                        updatedActivitiesLocal = true;
                    }
                } catch (err) {
                    console.error('Failed to upload local image on push:', err);
                }
            }

            rows.push({
                user_id: userId,
                date: day.date,
                period_number: p.periodNumber,
                class_section: p.classSection || '',
                subject_topics: p.subjectTopics || '',
                classwork: p.classwork || '',
                homework: p.homework || '',
                photo_url: photoUrl
            });
        }
    }

    if (updatedActivitiesLocal) {
        saveActivities(activities);
    }

    if (rows.length === 0) return { ok: true, message: 'No data to push.' };

    try {
        const { error } = await client
            .from(table)
            .upsert(rows, { onConflict: 'user_id,date,period_number' });
        if (error) return { ok: false, error: error.message };
        return { ok: true, message: `Pushed ${rows.length} period entries.` };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

async function pullFromSupabase() {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Supabase not configured' };
    const table = getSettings().supabaseTable || 'daily_activities';
    try {
        const { data, error } = await client
            .from(table)
            .select('*')
            .order('date', { ascending: true });
        if (error) return { ok: false, error: error.message };
        if (!data || data.length === 0) return { ok: true, message: 'No data found in Supabase.', data: [] };

        const grouped = {};
        for (const row of data) {
            if (!grouped[row.date]) grouped[row.date] = [];
            grouped[row.date].push({
                periodNumber: row.period_number,
                classSection: row.class_section || '',
                subjectTopics: row.subject_topics || '',
                classwork: row.classwork || '',
                homework: row.homework || '',
                photoUrl: row.photo_url || ''
            });
        }
        const activities = Object.keys(grouped).map(date => ({
            id: generateId(),
            date: date,
            periods: grouped[date].sort((a, b) => a.periodNumber - b.periodNumber)
        }));
        return { ok: true, message: `Pulled ${data.length} period entries (${activities.length} days).`, data: activities };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}
