/**
 * Awrady Dashboard - Authentication Gateway Component
 * Native Supabase Auth integration with Row-Level Security (RLS) support
 * and local storage Guest Mode retention.
 */

class AuthManager {
    constructor() {
        this.SESSION_KEY = APP_CONSTANTS.STORAGE_KEYS.SESSION_USER;
        this.SESSION_UID_KEY = "AWRAD_AUTH_UID";
        this.SESSION_EMAIL_KEY = "AWRAD_AUTH_EMAIL";
        this.GUEST_USER = APP_CONSTANTS.GUEST_USER;
        this.currentUser = null;
        this.currentUserId = null;
        this.currentUserEmail = null;
        this.mode = "login"; // "login" | "register"
    }

    _formatEmail(input) {
        const trimmed = (input || "").trim().toLowerCase();
        if (trimmed.includes("@")) return trimmed;
        const safe = trimmed.replace(/[^a-z0-9._-]/g, "");
        return `${safe || "user"}.awrady@gmail.com`;
    }

    _extractUsername(input, metadata) {
        if (metadata?.username) return metadata.username;
        const trimmed = (input || "").trim();
        if (trimmed.includes("@")) return trimmed.split("@")[0];
        return trimmed;
    }

    getCurrentUser() {
        return this.currentUser || localStorage.getItem(this.SESSION_KEY) || null;
    }

    getCurrentUserId() {
        return this.currentUserId || localStorage.getItem(this.SESSION_UID_KEY) || null;
    }

    isLoggedIn() {
        return Boolean(this.getCurrentUser());
    }

    isGuest() {
        return !this.getCurrentUserId() || this.getCurrentUser() === this.GUEST_USER;
    }

    async init() {
        if (window.awradyAPI && !window.awradyAPI.client) {
            window.awradyAPI.init();
        }
        this._bindEvents();

        this.currentUser = localStorage.getItem(this.SESSION_KEY);
        this.currentUserId = localStorage.getItem(this.SESSION_UID_KEY);
        this.currentUserEmail = localStorage.getItem(this.SESSION_EMAIL_KEY);

        if (this.currentUser === this.GUEST_USER) {
            this.currentUserId = null;
            this.currentUserEmail = null;
            if (window.awradyAPI) {
                window.awradyAPI.setCurrentUser(this.GUEST_USER, null);
            }
            this.hide();
            this.updateUI();
            return true;
        }

        const client = window.awradyAPI?.client;
        if (client?.auth) {
            try {
                const { data: { session } } = await client.auth.getSession();
                if (session?.user) {
                    this.currentUserId = session.user.id;
                    this.currentUser = session.user.user_metadata?.username || session.user.email?.split("@")[0] || session.user.id;
                    this.currentUserEmail = session.user.email || "";
                    localStorage.setItem(this.SESSION_KEY, this.currentUser);
                    localStorage.setItem(this.SESSION_UID_KEY, this.currentUserId);
                    if (this.currentUserEmail) {
                        localStorage.setItem(this.SESSION_EMAIL_KEY, this.currentUserEmail);
                    }
                    if (window.awradyAPI) {
                        window.awradyAPI.setCurrentUser(this.currentUser, this.currentUserId);
                    }
                    this.hide();
                    this.updateUI();
                    return true;
                }
            } catch (_) {}

            client.auth.onAuthStateChange((event, session) => {
                if (event === "SIGNED_OUT") {
                    this.currentUser = null;
                    this.currentUserId = null;
                    this.currentUserEmail = null;
                    localStorage.removeItem(this.SESSION_KEY);
                    localStorage.removeItem(this.SESSION_UID_KEY);
                    localStorage.removeItem(this.SESSION_EMAIL_KEY);
                    if (window.awradyAPI) {
                        window.awradyAPI.setCurrentUser(this.GUEST_USER, null);
                    }
                    this.show();
                    this.updateUI();
                } else if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED")) {
                    this.currentUserId = session.user.id;
                    this.currentUser = session.user.user_metadata?.username || session.user.email?.split("@")[0] || session.user.id;
                    this.currentUserEmail = session.user.email || "";
                    localStorage.setItem(this.SESSION_KEY, this.currentUser);
                    localStorage.setItem(this.SESSION_UID_KEY, this.currentUserId);
                    if (this.currentUserEmail) {
                        localStorage.setItem(this.SESSION_EMAIL_KEY, this.currentUserEmail);
                    }
                    if (window.awradyAPI) {
                        window.awradyAPI.setCurrentUser(this.currentUser, this.currentUserId);
                    }
                    this.hide();
                    this.updateUI();

                    // If redirected from an email confirmation link, clean the hash from address bar
                    if (typeof window !== "undefined" && window.location.hash && (window.location.hash.includes("access_token") || window.location.hash.includes("type="))) {
                        try {
                            window.history.replaceState(null, "", window.location.pathname + window.location.search);
                        } catch (_) {}
                    }
                }
            });
        }

        if (this.currentUser) {
            this.hide();
            this.updateUI();
            return true;
        } else {
            this.show();
            return false;
        }
    }

    _bindEvents() {
        const btnLoginTab = document.getElementById("btn-auth-tab-login");
        const btnRegisterTab = document.getElementById("btn-auth-tab-register");
        const btnSubmit = document.getElementById("btn-auth-submit");
        const btnGuest = document.getElementById("btn-auth-guest");
        const btnLogout = document.getElementById("btn-header-logout");
        const btnSettings = document.getElementById("btn-header-settings");
        const userIcon = document.getElementById("header-user-icon");
        const userInfo = document.getElementById("header-user-info");
        const btnCloseAccount = document.getElementById("btn-close-account-modal");
        const accountModal = document.getElementById("account-settings-modal");
        const btnUpdateName = document.getElementById("btn-update-display-name");
        const btnUpdateEmail = document.getElementById("btn-update-email");
        const btnUpdatePwd = document.getElementById("btn-update-password");

        if (btnLoginTab) btnLoginTab.addEventListener("click", () => this.setMode("login"));
        if (btnRegisterTab) btnRegisterTab.addEventListener("click", () => this.setMode("register"));
        if (btnSubmit) btnSubmit.addEventListener("click", () => this.submit());
        if (btnGuest) btnGuest.addEventListener("click", () => this.loginAsGuest());
        if (btnLogout) btnLogout.addEventListener("click", () => this.logout());
        if (btnSettings) btnSettings.addEventListener("click", () => this.openAccountModal());
        if (userIcon) userIcon.addEventListener("click", () => this.openAccountModal());
        if (userInfo) userInfo.addEventListener("click", () => this.openAccountModal());
        if (btnCloseAccount) btnCloseAccount.addEventListener("click", () => this.closeAccountModal());
        if (btnUpdateName) btnUpdateName.addEventListener("click", () => this.saveDisplayName());
        if (btnUpdateEmail) btnUpdateEmail.addEventListener("click", () => this.saveEmail());
        if (btnUpdatePwd) btnUpdatePwd.addEventListener("click", () => this.savePassword());

        if (accountModal) {
            accountModal.addEventListener("click", (e) => {
                if (e.target === accountModal) this.closeAccountModal();
            });
        }

        ["auth-username", "auth-password", "auth-confirm-password"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("keydown", (e) => {
                if (e.key === "Enter") this.submit();
            });
        });

        const inputDisplayName = document.getElementById("account-display-name");
        if (inputDisplayName) {
            inputDisplayName.addEventListener("keydown", (e) => {
                if (e.key === "Enter") this.saveDisplayName();
            });
        }

        const inputEmail = document.getElementById("account-email");
        if (inputEmail) {
            inputEmail.addEventListener("keydown", (e) => {
                if (e.key === "Enter") this.saveEmail();
            });
        }

        ["account-new-password", "account-confirm-password"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("keydown", (e) => {
                if (e.key === "Enter") this.savePassword();
            });
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                const modal = document.getElementById("account-settings-modal");
                if (modal && !modal.classList.contains("hidden")) {
                    this.closeAccountModal();
                }
            }
        });
    }

    setMode(mode) {
        this.mode = mode;
        this.clearMsg();
        const tabLogin = document.getElementById("btn-auth-tab-login");
        const tabReg = document.getElementById("btn-auth-tab-register");
        const confirmBox = document.getElementById("auth-confirm-container");
        const submitBtnText = document.querySelector("#btn-auth-submit span");

        if (mode === "register") {
            if (tabLogin) tabLogin.classList.remove("active");
            if (tabReg) tabReg.classList.add("active");
            if (confirmBox) confirmBox.style.display = "block";
            if (submitBtnText) submitBtnText.textContent = "إنشاء الحساب والبدء";
        } else {
            if (tabReg) tabReg.classList.remove("active");
            if (tabLogin) tabLogin.classList.add("active");
            if (confirmBox) confirmBox.style.display = "none";
            if (submitBtnText) submitBtnText.textContent = "تسجيل الدخول";
        }
    }

    showMsg(msg, isError = true) {
        const el = document.getElementById("auth-msg");
        if (el) {
            el.className = `auth-msg ${isError ? 'error' : 'success'}`;
            el.textContent = msg;
        }
    }

    clearMsg() {
        const el = document.getElementById("auth-msg");
        if (el) {
            el.className = "auth-msg";
            el.textContent = "";
        }
    }

    show() {
        const overlay = document.getElementById("auth-overlay");
        if (overlay) overlay.classList.remove("hidden");
    }

    hide() {
        const overlay = document.getElementById("auth-overlay");
        if (overlay) overlay.classList.add("hidden");
    }

    updateUI() {
        const nameEl = document.getElementById("header-username-display");
        if (nameEl) nameEl.textContent = this.currentUser || "-";
    }

    async submit() {
        const userInput = document.getElementById("auth-username");
        const pwdInput = document.getElementById("auth-password");
        const confirmInput = document.getElementById("auth-confirm-password");

        const rawInput = (userInput?.value || "").trim();
        const password = pwdInput?.value || "";

        const minUserLen = APP_CONSTANTS.LIMITS.USERNAME_MIN;
        const minPwdLen = APP_CONSTANTS.LIMITS.PASSWORD_MIN;

        if (!rawInput || rawInput.length < minUserLen) {
            return this.showMsg(`اسم المستخدم أو البريد الإلكتروني يجب أن يكون ${minUserLen} أحرف على الأقل.`);
        }
        if (!password || password.length < minPwdLen) {
            return this.showMsg(`كلمة المرور يجب أن تكون ${minPwdLen} أحرف على الأقل.`);
        }

        if (window.awradyAPI && !window.awradyAPI.client) {
            window.awradyAPI.init();
        }
        const client = window.awradyAPI?.client;
        if (!client || !client.auth) {
            return this.showMsg("تعذر الاتصال بخدمة المصادقة السحابية.");
        }

        const email = this._formatEmail(rawInput);
        const username = this._extractUsername(rawInput);

        if (this.mode === "register") {
            const confirmPwd = confirmInput?.value || "";
            if (password !== confirmPwd) {
                return this.showMsg("كلمة المرور وتأكيد كلمة المرور غير متطابقتين.");
            }

            try {
                const isWeb = typeof window !== "undefined" && window.location.origin && !window.location.origin.startsWith("file:");
                const redirectTo = isWeb ? (window.location.origin + window.location.pathname) : "https://awrady.vercel.app/";
                const { data, error } = await client.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { username },
                        emailRedirectTo: redirectTo
                    }
                });

                if (error) {
                    if (error.message.includes("already registered") || error.message.includes("User already registered")) {
                        return this.showMsg("اسم المستخدم أو البريد مسجل مسبقاً، يمكنك تسجيل الدخول به.");
                    }
                    if (error.message.includes("rate limit") || error.message.includes("rate_limit")) {
                        return this.showMsg("تم تجاوز حد إرسال الإيميلات. يرجى الانتظار قليلاً والمحاولة لاحقاً.");
                    }
                    if (error.message.includes("Password should be")) {
                        return this.showMsg(`كلمة المرور ضعيفة: ${error.message}`);
                    }
                    return this.showMsg(error.message || "حدث خطأ أثناء إنشاء الحساب.");
                }

                // If real email is used and confirmation is required by Supabase:
                if (!data.session && rawInput.includes("@")) {
                    return this.showMsg(`📨 تم إنشاء الحساب بنجاح! تم إرسال رابط تأكيد إلى ${rawInput}. يرجى فتح بريدك والضغط على الرابط لتفعيل الحساب.`, false);
                }

                const uid = data.user?.id || null;
                const displayName = data.user?.user_metadata?.username || username;
                this.loginSuccess(displayName, uid);

            } catch (e) {
                this.showMsg("فشل الاتصال بخادم المصادقة: " + (e.message || ""));
            }

        } else {
            try {
                const { data, error } = await client.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    if (error.message.includes("Invalid login credentials")) {
                        return this.showMsg("البريد الإلكتروني أو كلمة المرور غير صحيحة. (إذا كنت تسجل لأول مرة، يرجى التبديل إلى تبويب 'إنشاء حساب جديد').");
                    }
                    if (error.message.includes("Email not confirmed")) {
                        return this.showMsg("البريد الإلكتروني لم يتم تأكيده بعد. يرجى مراجعة بريدك الإلكتروني والضغط على رابط التفعيل.");
                    }
                    return this.showMsg(error.message || "فشل تسجيل الدخول.");
                }

                const uid = data.user?.id || null;
                const displayName = data.user?.user_metadata?.username || username;
                this.loginSuccess(displayName, uid);

            } catch (e) {
                this.showMsg("فشل الاتصال بخادم المصادقة: " + (e.message || ""));
            }
        }
    }

    loginAsGuest() {
        this.loginSuccess(this.GUEST_USER, null);
    }

    loginSuccess(username, userId = null) {
        this.currentUser = username;
        this.currentUserId = userId;
        localStorage.setItem(this.SESSION_KEY, username);
        if (userId) {
            localStorage.setItem(this.SESSION_UID_KEY, userId);
            if (window.awradyAPI?.client?.auth) {
                window.awradyAPI.client.auth.getSession().then(({ data: { session } }) => {
                    if (session?.user?.email) {
                        this.currentUserEmail = session.user.email;
                        localStorage.setItem(this.SESSION_EMAIL_KEY, this.currentUserEmail);
                    }
                }).catch(() => {});
            }
        } else {
            localStorage.removeItem(this.SESSION_UID_KEY);
            localStorage.removeItem(this.SESSION_EMAIL_KEY);
            this.currentUserEmail = null;
        }
        if (window.awradyAPI) {
            window.awradyAPI.setCurrentUser(username, userId);
        }
        this.showMsg("تم الدخول بنجاح!", false);
        setTimeout(async () => {
            this.hide();
            this.updateUI();
            if (typeof window.startApp === "function") {
                await window.startApp(username);
            }
        }, 300);
    }

    async logout() {
        if (!confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) return;
        const client = window.awradyAPI?.client;
        if (client?.auth) {
            try {
                await client.auth.signOut();
            } catch (_) {}
        }
        localStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem(this.SESSION_UID_KEY);
        localStorage.removeItem(this.SESSION_EMAIL_KEY);
        this.currentUser = null;
        this.currentUserId = null;
        this.currentUserEmail = null;
        if (window.awradyAPI) {
            window.awradyAPI.setCurrentUser(this.GUEST_USER, null);
        }
        this.show();
        this.updateUI();
        if (typeof window.logoutApp === "function") {
            window.logoutApp();
        }
    }

    openAccountModal() {
        if (this.isGuest()) {
            this.show();
            this.showMsg("يرجى تسجيل الدخول أو إنشاء حساب للوصول إلى إعدادات الحساب.");
            return;
        }
        const modal = document.getElementById("account-settings-modal");
        if (!modal) return;
        const nameInput = document.getElementById("account-display-name");
        if (nameInput) nameInput.value = this.currentUser || "";

        const emailInput = document.getElementById("account-email");
        let displayEmail = this.currentUserEmail || "";
        if (displayEmail.endsWith(".awrady@gmail.com") || displayEmail.endsWith("@awrady.internal")) {
            displayEmail = "";
        }
        if (emailInput) emailInput.value = displayEmail;

        const pwdInput = document.getElementById("account-new-password");
        if (pwdInput) pwdInput.value = "";
        const confirmInput = document.getElementById("account-confirm-password");
        if (confirmInput) confirmInput.value = "";
        this.clearAccountMsg();
        modal.classList.remove("hidden");
        if (nameInput) nameInput.focus();

        // Fetch fresh email from Supabase Auth session if not loaded yet
        const client = window.awradyAPI?.client;
        if (client?.auth) {
            client.auth.getUser().then(({ data }) => {
                if (data?.user?.email) {
                    this.currentUserEmail = data.user.email;
                    localStorage.setItem(this.SESSION_EMAIL_KEY, this.currentUserEmail);
                    let freshEmail = data.user.email;
                    if (freshEmail.endsWith(".awrady@gmail.com") || freshEmail.endsWith("@awrady.internal")) {
                        freshEmail = "";
                    }
                    if (emailInput && !emailInput.value) {
                        emailInput.value = freshEmail;
                    }
                }
            }).catch(() => {});
        }
    }

    closeAccountModal() {
        const modal = document.getElementById("account-settings-modal");
        if (modal) modal.classList.add("hidden");
        this.clearAccountMsg();
    }

    showAccountMsg(msg, isError = true) {
        const el = document.getElementById("account-msg");
        if (el) {
            el.className = `auth-msg ${isError ? 'error' : 'success'}`;
            el.textContent = msg;
        }
    }

    clearAccountMsg() {
        const el = document.getElementById("account-msg");
        if (el) {
            el.className = "auth-msg";
            el.textContent = "";
        }
    }

    async saveDisplayName() {
        const input = document.getElementById("account-display-name");
        const rawName = (input?.value || "").trim();
        const minLen = APP_CONSTANTS.LIMITS?.USERNAME_MIN || 3;

        if (!rawName || rawName.length < minLen) {
            return this.showAccountMsg(`اسم المستخدم يجب أن يكون ${minLen} أحرف على الأقل.`, true);
        }

        const cleanName = rawName.toLowerCase();
        if (cleanName === (this.currentUser || "").toLowerCase()) {
            return this.showAccountMsg("لم يتم تغيير اسم المستخدم.", false);
        }

        const btn = document.getElementById("btn-update-display-name");
        if (btn) btn.disabled = true;
        this.showAccountMsg("جاري حفظ الاسم المعروض...", false);

        try {
            if (!window.awradyAPI) throw new Error("خدمة الاتصال غير متوفرة.");
            await window.awradyAPI.updateDisplayName(cleanName);

            const oldName = this.currentUser;
            this.currentUser = cleanName;
            localStorage.setItem(this.SESSION_KEY, cleanName);

            // Migrate local cache key if Store is active
            if (window.AppStore && typeof window.AppStore.getUserStorageKey === "function") {
                try {
                    const oldKey = window.AppStore.getUserStorageKey(oldName);
                    const newKey = window.AppStore.getUserStorageKey(cleanName);
                    const cached = localStorage.getItem(oldKey);
                    if (cached && oldKey !== newKey) {
                        localStorage.setItem(newKey, cached);
                    }
                } catch (_) {}
            }

            this.updateUI();
            this.showAccountMsg("✅ تم تحديث اسم المستخدم بنجاح!", false);
        } catch (err) {
            this.showAccountMsg(err.message || "فشل تحديث اسم المستخدم.", true);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async saveEmail() {
        const input = document.getElementById("account-email");
        const rawEmail = (input?.value || "").trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!rawEmail || !emailRegex.test(rawEmail)) {
            return this.showAccountMsg("يرجى إدخال عنوان بريد إلكتروني صالح.", true);
        }

        if (rawEmail === (this.currentUserEmail || "").toLowerCase()) {
            return this.showAccountMsg("لم يتم تغيير البريد الإلكتروني.", false);
        }

        const btn = document.getElementById("btn-update-email");
        if (btn) btn.disabled = true;
        this.showAccountMsg("جاري حفظ البريد الإلكتروني والمزامنة...", false);

        try {
            if (!window.awradyAPI) throw new Error("خدمة الاتصال غير متوفرة.");
            const data = await window.awradyAPI.updateEmail(rawEmail);

            this.currentUserEmail = rawEmail;
            localStorage.setItem(this.SESSION_EMAIL_KEY, rawEmail);

            if (data?.user?.new_email) {
                this.showAccountMsg("📨 تم حفظ البريد وإرسال رابط تأكيد للبريد الجديد، يرجى تأكيده لإتمام العملية.", false);
            } else {
                this.showAccountMsg("✅ تم تحديث وحفظ البريد الإلكتروني في قاعدة البيانات بنجاح!", false);
            }
        } catch (err) {
            this.showAccountMsg(err.message || "فشل تحديث البريد الإلكتروني.", true);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async savePassword() {
        const pwdInput = document.getElementById("account-new-password");
        const confirmInput = document.getElementById("account-confirm-password");
        const newPwd = pwdInput?.value || "";
        const confirmPwd = confirmInput?.value || "";
        const minLen = APP_CONSTANTS.LIMITS?.PASSWORD_MIN || 6;

        if (!newPwd || newPwd.length < minLen) {
            return this.showAccountMsg(`كلمة المرور الجديدة يجب أن تكون ${minLen} أحرف على الأقل.`, true);
        }
        if (newPwd !== confirmPwd) {
            return this.showAccountMsg("كلمة المرور وتأكيد كلمة المرور غير متطابقتين.", true);
        }

        const btn = document.getElementById("btn-update-password");
        if (btn) btn.disabled = true;
        this.showAccountMsg("جاري تحديث كلمة المرور...", false);

        try {
            if (!window.awradyAPI) throw new Error("خدمة الاتصال غير متوفرة.");
            await window.awradyAPI.updatePassword(newPwd);
            if (pwdInput) pwdInput.value = "";
            if (confirmInput) confirmInput.value = "";
            this.showAccountMsg("✅ تم تغيير كلمة المرور بنجاح!", false);
        } catch (err) {
            this.showAccountMsg(err.message || "فشل تغيير كلمة المرور.", true);
        } finally {
            if (btn) btn.disabled = false;
        }
    }
}

if (typeof window !== "undefined") {
    window.authManager = new AuthManager();
}
