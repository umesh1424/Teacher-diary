// ================================================================
//  AUTH SERVICE (Supabase only - no local storage)
// ================================================================

function isSupabaseConfigValid() {
    const settings = getSettings();
    const url = settings.supabaseUrl || '';
    const key = settings.supabaseKey || '';
    return url.includes('.supabase.co') && key.startsWith('eyJ') && key.length > 100;
}

// ================================================================
//  AUTH UI LOGIC
// ================================================================
let isBypassedAuth = false;
let currentAuthTab = 'login';
let authListenerBound = false;
let currentBoundClientConfig = '';

function switchAuthTab(tab) {
    currentAuthTab = tab;
    const loginBtn = document.getElementById('tab-login-btn');
    const signupBtn = document.getElementById('tab-signup-btn');
    const submitBtn = document.getElementById('auth-submit-btn');
    const subtitle = document.querySelector('.auth-subtitle');
    const nameGroup = document.getElementById('register-name-group');
    const subjectGroup = document.getElementById('register-subject-group');
    const nameInput = document.getElementById('auth-name');
    
    if (tab === 'login') {
        loginBtn.classList.add('active');
        signupBtn.classList.remove('active');
        submitBtn.textContent = 'Sign In';
        subtitle.textContent = 'Sign in to your Teacher Planner account';
        if (nameGroup) nameGroup.style.display = 'none';
        if (subjectGroup) subjectGroup.style.display = 'none';
        if (nameInput) nameInput.removeAttribute('required');
    } else {
        loginBtn.classList.remove('active');
        signupBtn.classList.add('active');
        submitBtn.textContent = 'Register Account';
        subtitle.textContent = 'Create your Teacher Planner account';
        if (nameGroup) nameGroup.style.display = 'block';
        if (subjectGroup) subjectGroup.style.display = 'block';
        if (nameInput) nameInput.setAttribute('required', '');
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit-btn');
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Working...';
    
    try {
        if (!isSupabaseConfigValid()) {
            showToast('⚠️ Supabase is not configured. Please set up Supabase URL and Key in Settings.', 'error');
            return;
        }

        const client = getSupabaseClient();
        if (!client) {
            showToast('⚠️ Could not connect to Supabase. Please check your settings.', 'error');
            return;
        }
        
        if (currentAuthTab === 'login') {
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            handleAuthState(data.session);
            localStorage.setItem('lastLoggedInEmail', email);
            showToast('Welcome back! Successfully signed in.', 'success');
        } else {
            const name = document.getElementById('auth-name').value.trim();
            const subject = document.getElementById('auth-subject').value.trim();
            
            const signUpOptions = {
                email,
                password,
                options: {
                    data: {
                        full_name: name || '',
                        subject: subject || ''
                    }
                }
            };
            const { data, error } = await client.auth.signUp(signUpOptions);
            if (error) throw error;
            if (data.session) {
                handleAuthState(data.session);
                showToast('🎉 Registration successful! Welcome to Teacher Planner.', 'success');
            } else {
                showToast('📧 Verification email sent! Please check your inbox and verify your email before logging in.', 'info', 8000);
                switchAuthTab('login');
            }
        }
    } catch (err) {
        showToast(err.message || 'Authentication failed. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function handleGoogleSignIn(event) {
    if (event) event.preventDefault();
    
    if (!isSupabaseConfigValid()) {
        showToast('⚠️ Supabase is not configured. Please set up Supabase URL and Key in Settings.', 'error');
        return;
    }
    
    const googleBtn = document.getElementById('auth-google-btn');
    const submitBtn = document.getElementById('auth-submit-btn');
    
    const originalText = googleBtn.innerHTML;
    googleBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    googleBtn.innerHTML = '<span class="spinner"></span> Connecting...';
    
    try {
        const client = getSupabaseClient();
        if (!client) {
            showToast('⚠️ Could not connect to Supabase. Please check your settings.', 'error');
            return;
        }
        
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname,
                queryParams: {
                    prompt: 'select_account'
                }
            }
        });
        
        if (error) throw error;
    } catch (err) {
        showToast(err.message || 'Google Authentication failed. Please try again.', 'error');
        googleBtn.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
        googleBtn.innerHTML = originalText;
    }
}

async function handleSignOut() {
    const client = getSupabaseClient();
    if (client) {
        try {
            await client.auth.signOut();
        } catch (e) {
            console.warn('Supabase sign out failed:', e.message);
        }
    }
    
    handleAuthState(null);
    showToast('Successfully signed out.', 'info');
}

function bypassAuthToLocal() {
    isBypassedAuth = true;
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.remove('active');
    showToast('Using planner in Local Offline Mode. Data will not sync to Supabase.', 'info');
}

async function setupAuthListener() {
    if (isSupabaseConfigValid()) {
        const client = getSupabaseClient();
        if (client) {
            try {
                const { data: { session } } = await client.auth.getSession();
                if (session) {
                    handleAuthState(session);
                }
            } catch (e) {
                console.warn('Error fetching initial session:', e);
            }

            const settings = getSettings();
            const configKey = (settings.supabaseUrl || '') + '|' + (settings.supabaseKey || '');
            if (!authListenerBound || currentBoundClientConfig !== configKey) {
                client.auth.onAuthStateChange((event, session) => {
                    handleAuthState(session);
                });
                authListenerBound = true;
                currentBoundClientConfig = configKey;
            }
            return;
        }
    }
    
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.add('active');
    const lastEmail = localStorage.getItem('lastLoggedInEmail');
    const emailInput = document.getElementById('auth-email');
    if (lastEmail && emailInput && !emailInput.value) {
        emailInput.value = lastEmail;
    }
}

function handleAuthState(session) {
    const overlay = document.getElementById('auth-overlay');
    const userBanner = document.getElementById('headerUserBanner');
    const userEmail = document.getElementById('headerUserEmail');

    if (session && session.user) {
        overlay.classList.remove('active');
        userBanner.classList.remove('hidden');
        
        const meta = session.user.user_metadata || {};
        let displayName = meta.full_name || session.user.email;
        if (meta.full_name && meta.subject) {
            displayName += ` (${meta.subject})`;
        }
        
        if (meta.subject) {
            localStorage.setItem('userSubject', meta.subject);
        } else {
            localStorage.removeItem('userSubject');
        }
        
        // Render Google Profile Avatar if available
        const avatarEl = document.getElementById('headerUserAvatar');
        if (avatarEl) {
            const avatarUrl = meta.avatar_url || meta.picture || '';
            if (avatarUrl) {
                avatarEl.src = avatarUrl;
                avatarEl.style.display = 'block';
            } else {
                avatarEl.src = '';
                avatarEl.style.display = 'none';
            }
        }
        
        userEmail.textContent = displayName;
        userEmail.title = session.user.email;
        if (session.user.email) {
            localStorage.setItem('lastLoggedInEmail', session.user.email);
        }

        // Clean up the URL hash fragment to prevent token leakage and keep URL clean
        if (window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('type=recovery'))) {
            history.replaceState(null, document.title, window.location.pathname + window.location.search);
        }

        // Auto-select 'daily' dashboard tab when signed in
        const dailyTabButton = document.querySelector('[data-tab="daily"]');
        if (dailyTabButton && !dailyTabButton.classList.contains('active')) {
            dailyTabButton.click();
        }
    } else {
        localStorage.removeItem('userSubject');
        userBanner.classList.add('hidden');
        userEmail.textContent = '';
        
        const avatarEl = document.getElementById('headerUserAvatar');
        if (avatarEl) {
            avatarEl.src = '';
            avatarEl.style.display = 'none';
        }
        
        const settings = getSettings();
        if (settings.supabaseUrl && settings.supabaseKey && !isBypassedAuth) {
            overlay.classList.add('active');
            
            const lastEmail = localStorage.getItem('lastLoggedInEmail');
            const emailInput = document.getElementById('auth-email');
            if (lastEmail && emailInput && !emailInput.value) {
                emailInput.value = lastEmail;
            }
        } else {
            overlay.classList.remove('active');
        }
    }
}
