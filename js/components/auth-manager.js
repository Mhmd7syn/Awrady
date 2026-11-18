/**
 * Awrady Dashboard - Authentication Gateway Component
 * Native Supabase Auth integration with Row-Level Security (RLS) support
 * and local storage Guest Mode retention.
 */

class AuthManager {
    constructor() {
        this.SESSION_KEY = APP_CONSTANTS.STORAGE_KEYS.SESSION_USER;
        this.GUEST_USER = APP_CONSTANTS.GUEST_USER;
        this.currentUser = null;
        this.currentUserId = null;
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
        return this.currentUserId || null;
    }

    isLoggedIn() {
        return Boolean(this.getCurrentUser());
    }

    init() {
        if (window.awradyAPI && !window.awradyAPI.client) {
            window.awradyAPI.init();
        }
        this._bindEvents();

        const savedUser = localStorage.getItem(this.SESSION_KEY);
        if (savedUser === this.GUEST_USER) {
            this.currentUser = this.GUEST_USER;
            this.currentUserId = null;
            if (window.awradyAPI) {
                window.awradyAPI.setCurrentUser(this.GUEST_USER, null);
            }
            this.hide();
            this.updateUI();
            return true;
        }

        const client = window.awradyAPI?.client;
        if (client?.auth) {
            client.auth.getSession().then(({ data: { session } }) => {
                if (session?.user) {
                    this.currentUserId = session.user.id;
                    this.currentUser = session.user.user_metadata?.username || session.user.email?.split("@")[0] || session.user.id;
                    localStorage.setItem(this.SESSION_KEY, this.currentUser);
                    if (window.awradyAPI) {
                        window.awradyAPI.setCurrentUser(this.currentUser, this.currentUserId);
                    }
                    this.hide();
                    this.updateUI();
                } else if (!savedUser) {
                    this.show();
                }
            }).catch(() => {
                if (!savedUser) this.show();
            });

            client.auth.onAuthStateChange((event, session) => {
                if (event === "SIGNED_OUT") {
                    this.currentUser = null;
                    this.currentUserId = null;
                    localStorage.removeItem(this.SESSION_KEY);
                    if (window.awradyAPI) {
                        window.awradyAPI.setCurrentUser(this.GUEST_USER, null);
                    }
                    this.show();
                    this.updateUI();
                } else if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
                    this.currentUserId = session.user.id;
                    this.currentUser = session.user.user_metadata?.username || session.user.email?.split("@")[0] || session.user.id;
                    localStorage.setItem(this.SESSION_KEY, this.currentUser);
                    if (window.awradyAPI) {
                        window.awradyAPI.setCurrentUser(this.currentUser, this.currentUserId);
                    }
                    this.hide();
                    this.updateUI();
                }
            });
        }

        if (savedUser) {
            this.currentUser = savedUser;
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

        if (btnLoginTab) btnLoginTab.addEventListener("click", () => this.setMode("login"));
        if (btnRegisterTab) btnRegisterTab.addEventListener("click", () => this.setMode("register"));
        if (btnSubmit) btnSubmit.addEventListener("click", () => this.submit());
        if (btnGuest) btnGuest.addEventListener("click", () => this.loginAsGuest());
        if (btnLogout) btnLogout.addEventListener("click", () => this.logout());

        ["auth-username", "auth-password", "auth-confirm-password"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("keydown", (e) => {
                if (e.key === "Enter") this.submit();
            });
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
                const { data, error } = await client.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { username }
                    }
                });

                if (error) {
                    if (error.message.includes("already registered") || error.message.includes("User already registered")) {
                        return this.showMsg("اسم المستخدم مسجل مسبقاً، يمكنك تسجيل الدخول به.");
                    }
                    if (error.message.includes("rate limit") || error.message.includes("rate_limit")) {
                        return this.showMsg("تم تجاوز حد إرسال الإيميلات. يرجى إيقاف خاصية 'Confirm email' في لوحة Supabase.");
                    }
                    if (error.message.includes("Password should be")) {
                        return this.showMsg(`كلمة المرور ضعيفة: ${error.message}`);
                    }
                    return this.showMsg(error.message || "حدث خطأ أثناء إنشاء الحساب.");
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
                        return this.showMsg("البريد الإلكتروني لم يتم تأكيده. يرجى إيقاف خاصية 'Confirm email' في لوحة تحكم Supabase.");
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
        if (window.awradyAPI) {
            window.awradyAPI.setCurrentUser(username, userId);
        }
        this.showMsg("تم الدخول بنجاح!", false);
        setTimeout(() => {
            this.hide();
            this.updateUI();
            if (typeof window.startApp === "function") {
                window.startApp(username);
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
        this.currentUser = null;
        this.currentUserId = null;
        if (window.awradyAPI) {
            window.awradyAPI.setCurrentUser(this.GUEST_USER, null);
        }
        this.show();
        this.updateUI();
        if (typeof window.logoutApp === "function") {
            window.logoutApp();
        }
    }
}

if (typeof window !== "undefined") {
    window.authManager = new AuthManager();
}
