/**
 * Awrady Dashboard - Authentication Gateway Component
 * Native Supabase Auth integration with Row-Level Security (RLS) support.
 */

import { APP_CONSTANTS } from '../config/constants.js';
import { awradyAPI } from '../api.js';
import { showToast } from './toast.js';

class AuthManager {
    constructor() {
        this.SESSION_KEY = APP_CONSTANTS.STORAGE_KEYS.SESSION_USER;
        this.SESSION_UID_KEY = "AWRAD_AUTH_UID";
        this.SESSION_EMAIL_KEY = "AWRAD_AUTH_EMAIL";
        this.currentUser = null;
        this.currentUserId = null;
        this.currentUserEmail = null;
        this.mode = "login"; // "login" | "register"
    }

    _formatEmail(input) {
        const trimmed = (input || "").trim().toLowerCase();
        if (trimmed.includes("@")) return trimmed;
        const safe = trimmed.replace(/[^a-z0-9._-]/g, "");
        return `${safe || "user"}@awrady.internal`;
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
        return Boolean(this.getCurrentUser() && this.getCurrentUserId());
    }

    isGuest() {
        return !this.isLoggedIn();
    }

    async init() {
        if (window.awradyAPI && !window.awradyAPI.client) {
            window.awradyAPI.init();
        }
        this._bindEvents();

        const hash = typeof window !== "undefined" ? (window.location.hash || "") : "";
        const isIncomingAuthToken = hash.includes("access_token") && (hash.includes("type=signup") || hash.includes("type=email_change") || hash.includes("type=recovery"));

        // If opening via confirmation or recovery link, purge any previous saved session so it strictly mounts the confirmed account
        if (isIncomingAuthToken) {
            localStorage.removeItem(this.SESSION_KEY);
            localStorage.removeItem(this.SESSION_UID_KEY);
            localStorage.removeItem(this.SESSION_EMAIL_KEY);
            this.currentUser = null;
            this.currentUserId = null;
            this.currentUserEmail = null;
            if (typeof window.logoutApp === "function") {
                window.logoutApp();
            }
        } else {
            this.currentUser = localStorage.getItem(this.SESSION_KEY);
            this.currentUserId = localStorage.getItem(this.SESSION_UID_KEY);
            this.currentUserEmail = localStorage.getItem(this.SESSION_EMAIL_KEY);
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

                    const isSignupConfirm = typeof window !== "undefined" && window.location.hash && window.location.hash.includes("type=signup");
                    const isEmailChange = typeof window !== "undefined" && window.location.hash && window.location.hash.includes("type=email_change");

                    if (typeof window !== "undefined" && window.location.hash && (window.location.hash.includes("access_token") || window.location.hash.includes("type="))) {
                        try {
                            window.history.replaceState(null, "", window.location.pathname + window.location.search);
                        } catch (_) {}
                    }

                    if (isSignupConfirm) {
                        setTimeout(() => {
                            showToast(`🎉 تم تأكيد وتفعيل بريدك الإلكتروني بنجاح!\nمرحباً بك (${this.currentUser})، تم فتح حسابك المؤكد وهو الآن نشط بالكامل ومربوط بالمزامنة السحابية.`, "success", 5000);
                        }, 400);
                        if (typeof window.startApp === "function") {
                            window.startApp(this.currentUser);
                        }
                    } else if (isEmailChange) {
                        setTimeout(() => {
                            showToast("✅ تم تأكيد وتحديث البريد الإلكتروني الجديد بنجاح!", "success");
                        }, 400);
                    }

                    return true;
                }
            } catch (_) {}

            client.auth.onAuthStateChange((event, session) => {
                if (event === "PASSWORD_RECOVERY") {
                    this.handlePasswordRecovery();
                } else if (event === "SIGNED_OUT") {
                    this.currentUser = null;
                    this.currentUserId = null;
                    this.currentUserEmail = null;
                    localStorage.removeItem(this.SESSION_KEY);
                    localStorage.removeItem(this.SESSION_UID_KEY);
                    localStorage.removeItem(this.SESSION_EMAIL_KEY);
                    if (window.awradyAPI) {
                        window.awradyAPI.setCurrentUser(null, null);
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

                    const isSignupConfirm = typeof window !== "undefined" && window.location.hash && window.location.hash.includes("type=signup");
                    const isEmailChange = typeof window !== "undefined" && window.location.hash && window.location.hash.includes("type=email_change");

                    // If redirected from an email confirmation link, clean the hash from address bar
                    if (typeof window !== "undefined" && window.location.hash && (window.location.hash.includes("access_token") || window.location.hash.includes("type="))) {
                        try {
                            window.history.replaceState(null, "", window.location.pathname + window.location.search);
                        } catch (_) {}
                    }

                    if (isSignupConfirm) {
                        setTimeout(() => {
                            showToast(`🎉 تم تأكيد وتفعيل بريدك الإلكتروني بنجاح!\nمرحباً بك (${this.currentUser})، تم فتح حسابك المؤكد وهو الآن نشط بالكامل ومربوط بالمزامنة السحابية.`, "success", 5000);
                        }, 400);
                        if (typeof window.startApp === "function") {
                            window.startApp(this.currentUser);
                        }
                    } else if (isEmailChange) {
                        setTimeout(() => {
                            showToast("✅ تم تأكيد تحديث البريد الإلكتروني الجديد بنجاح!", "success");
                        }, 400);
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
        const btnLogout = document.getElementById("btn-header-logout");
        const btnSettings = document.getElementById("btn-header-settings");
        const userIcon = document.getElementById("header-user-icon");
        const userInfo = document.getElementById("header-user-info");
        const btnCloseAccount = document.getElementById("btn-close-account-modal");
        const accountModal = document.getElementById("account-settings-modal");
        const btnUpdateName = document.getElementById("btn-update-display-name");
        const btnUpdateEmail = document.getElementById("btn-update-email");
        const btnUpdatePwd = document.getElementById("btn-update-password");
        const btnDeleteAccount = document.getElementById("btn-delete-account");
        const btnForgot = document.getElementById("btn-auth-forgot");

        if (btnLoginTab) btnLoginTab.addEventListener("click", () => this.setMode("login"));
        if (btnRegisterTab) btnRegisterTab.addEventListener("click", () => this.setMode("register"));
        if (btnSubmit) btnSubmit.addEventListener("click", () => this.submit());
        if (btnLogout) btnLogout.addEventListener("click", () => this.logout());
        if (btnSettings) btnSettings.addEventListener("click", () => this.openAccountModal());
        if (userIcon) userIcon.addEventListener("click", () => this.openAccountModal());
        if (userInfo) userInfo.addEventListener("click", () => this.openAccountModal());
        if (btnCloseAccount) btnCloseAccount.addEventListener("click", () => this.closeAccountModal());
        if (btnUpdateName) btnUpdateName.addEventListener("click", () => this.saveDisplayName());
        if (btnUpdateEmail) btnUpdateEmail.addEventListener("click", () => this.saveEmail());
        if (btnUpdatePwd) btnUpdatePwd.addEventListener("click", () => this.savePassword());
        if (btnDeleteAccount) btnDeleteAccount.addEventListener("click", () => this.deleteAccount());
        if (btnForgot) btnForgot.addEventListener("click", () => this.forgotPassword());

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
        const btnForgot = document.getElementById("btn-auth-forgot");
        const submitBtnText = document.querySelector("#btn-auth-submit span");

        if (mode === "register") {
            if (tabLogin) tabLogin.classList.remove("active");
            if (tabReg) tabReg.classList.add("active");
            if (confirmBox) confirmBox.style.display = "block";
            if (btnForgot) btnForgot.style.display = "none";
            if (submitBtnText) submitBtnText.textContent = "إنشاء الحساب والبدء";
        } else {
            if (tabReg) tabReg.classList.remove("active");
            if (tabLogin) tabLogin.classList.add("active");
            if (confirmBox) confirmBox.style.display = "none";
            if (btnForgot) btnForgot.style.display = "inline-block";
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

            const isRealEmail = rawInput.includes("@");

            // Option 1: Username-only registration
            // Creates confirmed user directly in auth.users via RPC so GoTrue never dispatches a fake confirmation email
            if (!isRealEmail) {
                try {
                    const { data: rpcData, error: rpcError } = await client.rpc("register_username_user", {
                        p_username: username,
                        p_password: password
                    });

                    if (rpcError) {
                        const errMsg = rpcError.message || "";
                        if (errMsg.includes("مسجل مسبقاً") || errMsg.includes("already registered") || errMsg.includes("already exists") || rpcError.code === "23505") {
                            return this.showMsg("اسم المستخدم مسجل مسبقاً، يمكنك تسجيل الدخول به.");
                        }
                        if (errMsg.includes("function") && errMsg.includes("does not exist")) {
                            // RPC not deployed yet: fallback to standard signUp
                            return await this._registerViaSignUp(client, email, password, username, rawInput);
                        }
                        return this.showMsg(errMsg || "حدث خطأ أثناء إنشاء الحساب.");
                    }

                    // Pre-confirmed user created in DB: sign in directly without sending any verification email
                    const { data: signData, error: signError } = await client.auth.signInWithPassword({
                        email,
                        password
                    });

                    if (signError) {
                        return this.showMsg(signError.message || "فشل تسجيل الدخول بالحساب الجديد.");
                    }

                    const uid = signData.user?.id || rpcData?.id || null;
                    const displayName = signData.user?.user_metadata?.username || username;
                    this.loginSuccess(displayName, uid);
                    return;

                } catch (e) {
                    console.warn("[AuthManager] RPC username registration fallback:", e);
                    return await this._registerViaSignUp(client, email, password, username, rawInput);
                }
            } else {
                // Option 2: Real email registration -> sends official Supabase verification email
                return await this._registerViaSignUp(client, email, password, username, rawInput);
            }

        } else {
            try {
                let loginEmail = email;

                if (!rawInput.includes("@")) {
                    try {
                        const { data: resolvedEmail } = await client.rpc("resolve_login_email", {
                            p_username: username
                        });
                        if (resolvedEmail) {
                            loginEmail = resolvedEmail;
                        }
                    } catch (_) {}
                }

                let { data, error } = await client.auth.signInWithPassword({
                    email: loginEmail,
                    password
                });

                // Backward compatibility: fallback if user was created with legacy .awrady@gmail.com
                if (error && !rawInput.includes("@") && loginEmail === email) {
                    const legacyEmail = `${rawInput.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") || "user"}.awrady@gmail.com`;
                    const fallbackRes = await client.auth.signInWithPassword({
                        email: legacyEmail,
                        password
                    });
                    if (!fallbackRes.error && fallbackRes.data) {
                        data = fallbackRes.data;
                        error = null;
                        // Silently migrate user to @awrady.internal to prevent future bounce-backs
                        try {
                            await client.auth.updateUser({ email });
                        } catch (_) {}
                    }
                }

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
        if (typeof window.logoutApp === "function") {
            window.logoutApp();
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
            window.awradyAPI.setCurrentUser(null, null);
        }
        this.show();
        this.updateUI();
        if (typeof window.logoutApp === "function") {
            window.logoutApp();
        }
    }

    openAccountModal() {
        if (!this.isLoggedIn()) {
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
        const btnDelete = document.getElementById("btn-delete-account");
        if (btnDelete) btnDelete.disabled = false;
        this.clearAccountMsg();
        modal.classList.remove("hidden");
        if (nameInput) nameInput.focus();

        // Fetch fresh email from Supabase Auth session if not loaded yet
        const client = window.awradyAPI?.client;
        if (client?.auth) {
            client.auth.getUser().then(({ data }) => {
                if (data?.user?.email) {
                    let freshEmail = data.user.email;
                    if (freshEmail.endsWith(".awrady@gmail.com") || freshEmail.endsWith("@awrady.internal")) {
                        this.currentUserEmail = null;
                        localStorage.removeItem(this.SESSION_EMAIL_KEY);
                        freshEmail = "";
                    } else {
                        this.currentUserEmail = data.user.email;
                        localStorage.setItem(this.SESSION_EMAIL_KEY, this.currentUserEmail);
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

        // User cleared the email field: remove email and rely only on username
        if (!rawEmail) {
            let currentRealEmail = this.currentUserEmail || "";
            if (currentRealEmail.endsWith(".awrady@gmail.com") || currentRealEmail.endsWith("@awrady.internal")) {
                currentRealEmail = "";
            }

            if (!currentRealEmail) {
                return this.showAccountMsg("لا يوجد بريد إلكتروني مسجل حالياً لإزالته.", false);
            }

            const btn = document.getElementById("btn-update-email");
            if (btn) btn.disabled = true;
            this.showAccountMsg("جاري حذف البريد الإلكتروني والاعتماد على اسم المستخدم...", false);

            try {
                if (!window.awradyAPI) throw new Error("خدمة الاتصال غير متوفرة.");
                await window.awradyAPI.updateEmail("");

                this.currentUserEmail = null;
                localStorage.removeItem(this.SESSION_EMAIL_KEY);
                if (input) input.value = "";

                this.showAccountMsg("✅ تم حذف البريد الإلكتروني بنجاح! يمكنك الآن تسجيل الدخول باسم المستخدم فقط.", false);
            } catch (err) {
                this.showAccountMsg(err.message || "فشل حذف البريد الإلكتروني.", true);
            } finally {
                if (btn) btn.disabled = false;
            }
            return;
        }

        if (!emailRegex.test(rawEmail)) {
            return this.showAccountMsg("يرجى إدخال عنوان بريد إلكتروني صالح أو إفراغ الحقل لحذفه.", true);
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

            if (data?.user?.new_email || data?.sentConfirmation) {
                this.showAccountMsg("📨 تم إرسال رابط تأكيد للبريد الجديد، يرجى مراجعة بريدك الإلكتروني لتأكيده.", false);
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

    async deleteAccount() {
        const username = this.currentUser || "";
        const confirmFirst = confirm(`⚠️ تحذير نهائي:\nهل أنت متأكد من رغبتك في حذف حسابك (${username}) نهائياً؟\n\nسيتم مسح جميع بياناتك وسجلاتك ومهامك بشكل دائم ولا يمكن استعادتها.`);
        if (!confirmFirst) return;

        const confirmPrompt = prompt(`لتأكيد الحذف النهائي، اكتب "حذف" أو اسم حسابك "${username}":`);
        if (!confirmPrompt) return;
        const cleanPrompt = confirmPrompt.trim().toLowerCase();
        if (cleanPrompt !== "حذف" && cleanPrompt !== username.toLowerCase()) {
            this.showAccountMsg("لم تتطابق عبارة التأكيد. تم إلغاء عملية حذف الحساب.", true);
            return;
        }

        const btn = document.getElementById("btn-delete-account");
        if (btn) btn.disabled = true;
        this.showAccountMsg("جاري حذف الحساب وكافة البيانات المرتبطة به نهائياً...", false);

        try {
            if (!window.awradyAPI) throw new Error("خدمة الاتصال غير متوفرة.");
            await window.awradyAPI.deleteAccount();

            // Clear local storage cache for this user
            if (window.AppStore && typeof window.AppStore.getUserStorageKey === "function") {
                try {
                    const userKey = window.AppStore.getUserStorageKey(username);
                    localStorage.removeItem(userKey);
                } catch (_) {}
            }

            localStorage.removeItem(this.SESSION_KEY);
            localStorage.removeItem(this.SESSION_UID_KEY);
            localStorage.removeItem(this.SESSION_EMAIL_KEY);

            this.currentUser = null;
            this.currentUserId = null;
            this.currentUserEmail = null;

            if (window.awradyAPI) {
                window.awradyAPI.setCurrentUser(null, null);
            }

            if (typeof window.logoutApp === "function") {
                window.logoutApp();
            }

            this.closeAccountModal();
            showToast("✅ تم حذف حسابك وكافة البيانات المرتبطة به بنجاح.", "success", 2000, () => window.location.reload());
            setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
            this.showAccountMsg(err.message || "حدث خطأ أثناء محاولة حذف الحساب.", true);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async forgotPassword() {
        const userInput = document.getElementById("auth-username");
        const rawInput = (userInput?.value || "").trim();

        if (!rawInput) {
            return this.showMsg("يرجى كتابة اسم المستخدم أو البريد الإلكتروني أولاً في الحقل أعلاه لاستعادة كلمة المرور.", true);
        }

        if (window.awradyAPI && !window.awradyAPI.client) {
            window.awradyAPI.init();
        }
        const client = window.awradyAPI?.client;
        if (!client || !client.auth) {
            return this.showMsg("تعذر الاتصال بخدمة المصادقة.", true);
        }

        const btnForgot = document.getElementById("btn-auth-forgot");
        if (btnForgot) btnForgot.disabled = true;
        this.showMsg("جاري التحقق وإرسال رابط استعادة كلمة المرور...", false);

        try {
            let targetEmail = "";

            if (rawInput.includes("@")) {
                targetEmail = rawInput.toLowerCase();
            } else {
                // Look up email by username via resolve_login_email RPC or public.users
                const cleanUser = rawInput.toLowerCase();
                let resolved = null;
                try {
                    const { data: res } = await client.rpc("resolve_login_email", { p_username: cleanUser });
                    resolved = res;
                } catch (_) {}

                if (!resolved) {
                    const { data: userRow } = await client
                        .from("users")
                        .select("email")
                        .eq("username", cleanUser)
                        .maybeSingle();
                    resolved = userRow?.email || null;
                }

                if (!resolved || resolved.endsWith("@awrady.internal") || resolved.endsWith(".awrady@gmail.com")) {
                    return this.showMsg("هذا الحساب مسجل باسم مستخدم فقط بدون بريد إلكتروني، تعذر إرسال رابط الاستعادة.", true);
                }
                targetEmail = resolved;
            }

            const isWeb = typeof window !== "undefined" && window.location.origin && !window.location.origin.startsWith("file:");
            const redirectTo = isWeb ? (window.location.origin + window.location.pathname) : "https://awrady.vercel.app/";

            const { error } = await client.auth.resetPasswordForEmail(targetEmail, {
                redirectTo
            });

            if (error) {
                if (error.message && (error.message.includes("rate limit") || error.message.includes("rate_limit"))) {
                    return this.showMsg("تم تجاوز حد إرسال الإيميلات. يرجى الانتظار قليلاً والمحاولة لاحقاً.", true);
                }
                return this.showMsg(error.message || "فشل إرسال رابط استعادة كلمة المرور.", true);
            }

            // Mask email for display: e.g. a***d@gmail.com
            const parts = targetEmail.split("@");
            const maskedUser = parts[0].length > 2 ? `${parts[0][0]}***${parts[0].slice(-1)}` : `${parts[0][0]}***`;
            const maskedEmail = `${maskedUser}@${parts[1]}`;

            this.showMsg(`📨 تم إرسال رابط استعادة كلمة المرور بنجاح إلى: ${maskedEmail}. يرجى فتح بريدك والضغط على الرابط لإعادة التعيين.`, false);

        } catch (e) {
            this.showMsg("حدث خطأ أثناء طلب استعادة كلمة المرور: " + (e.message || ""), true);
        } finally {
            if (btnForgot) btnForgot.disabled = false;
        }
    }

    handlePasswordRecovery() {
        setTimeout(async () => {
            const client = window.awradyAPI?.client;
            if (!client?.auth) return;

            const newPwd = prompt("🔑 استعادة كلمة المرور:\nيرجى إدخال كلمة المرور الجديدة (6 أحرف على الأقل):");
            if (!newPwd || newPwd.trim().length < 6) {
                showToast("لم يتم تغيير كلمة المرور: يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.", "warning");
                return;
            }

            try {
                const { error } = await client.auth.updateUser({ password: newPwd.trim() });
                if (error) {
                    showToast("فشل تحديث كلمة المرور: " + error.message, "error");
                } else {
                    showToast("✅ تم تعيين كلمة المرور الجديدة بنجاح! يمكنك الآن استخدامها لتسجيل الدخول.", "success");
                    if (typeof window !== "undefined" && window.location.hash) {
                        try {
                            window.history.replaceState(null, "", window.location.pathname + window.location.search);
                        } catch (_) {}
                    }
                }
            } catch (err) {
                showToast("حدث خطأ أثناء تحديث كلمة المرور: " + (err.message || ""), "error");
            }
        }, 500);
    }
}

const authManager = (typeof window !== "undefined" && window.authManager) ? window.authManager : new AuthManager();

if (typeof window !== "undefined") {
    window.AuthManager = AuthManager;
    window.authManager = authManager;
}

export { AuthManager, authManager };
