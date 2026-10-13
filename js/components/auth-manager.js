/**
 * Awrady Dashboard - Authentication Gateway Component
 */

class AuthManager {
    constructor() {
        this.SESSION_KEY = "AWRAD_AUTH_USER";
        this.LOCAL_KEY = "AWRAD_USERS_DB";
        this.SALT = "awrady_salt_v1";
        this.currentUser = null;
        this.mode = "login"; // "login" | "register"
    }

    async hashPassword(password) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(this.SALT + password));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    getCurrentUser() {
        return localStorage.getItem(this.SESSION_KEY) || null;
    }

    isLoggedIn() {
        return Boolean(this.getCurrentUser());
    }

    getLocalUsers() {
        try { return JSON.parse(localStorage.getItem(this.LOCAL_KEY)) || {}; } catch (_) { return {}; }
    }

    saveLocalUser(username, hash) {
        try {
            const u = this.getLocalUsers();
            u[username] = hash;
            localStorage.setItem(this.LOCAL_KEY, JSON.stringify(u));
        } catch (_) {}
    }

    init() {
        if (window.enjazAPI && !window.enjazAPI.client) {
            window.enjazAPI.init();
        }
        this.currentUser = this.getCurrentUser();
        this._bindEvents();

        if (this.isLoggedIn()) {
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

        const username = (userInput?.value || "").toLowerCase().trim();
        const password = pwdInput?.value || "";

        if (!username || username.length < 3) {
            return this.showMsg("اسم المستخدم يجب أن يكون 3 أحرف على الأقل.");
        }
        if (!password || password.length < 4) {
            return this.showMsg("كلمة المرور يجب أن تكون 4 أحرف على الأقل.");
        }

        const hash = await this.hashPassword(password);
        if (window.enjazAPI && !window.enjazAPI.client) {
            window.enjazAPI.init();
        }
        const client = window.enjazAPI?.client;

        if (this.mode === "register") {
            const confirmPwd = confirmInput?.value || "";
            if (password !== confirmPwd) {
                return this.showMsg("كلمة المرور وتأكيد كلمة المرور غير متطابقتين.");
            }

            // Check if username already exists locally
            const localUsers = this.getLocalUsers();
            if (localUsers[username]) {
                return this.showMsg("اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم آخر.");
            }

            // Check if username already exists in Cloud (Supabase)
            if (client) {
                try {
                    const { data: existing, error } = await client.from("users").select("username").eq("username", username).maybeSingle();
                    if (!error && existing) {
                        return this.showMsg("اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم آخر.");
                    }
                    if (!error) {
                        await client.from("users").insert([{ username, password_hash: hash }]);
                    }
                } catch (e) {
                    console.warn("[Auth] Cloud register fallback:", e.message);
                }
            }

            this.saveLocalUser(username, hash);
            this.loginSuccess(username);

        } else {
            let valid = false;
            let cloudChecked = false;

            if (client) {
                try {
                    const { data: user, error } = await client.from("users").select("*").eq("username", username).maybeSingle();
                    if (!error) {
                        cloudChecked = true;
                        if (user) {
                            if (!user.password_hash || user.password_hash === hash) {
                                valid = true;
                            } else {
                                return this.showMsg("كلمة المرور غير صحيحة.");
                            }
                        } else {
                            const localUsers = this.getLocalUsers();
                            if (!localUsers[username] && username !== "primary_user") {
                                return this.showMsg("اسم المستخدم غير مسجل، يرجى إنشاء حساب جديد.");
                            }
                        }
                    }
                } catch (e) {
                    console.warn("[Auth] Cloud login check fallback:", e.message);
                }
            }

            if (!valid) {
                const localUsers = this.getLocalUsers();
                if (localUsers[username]) {
                    if (localUsers[username] === hash) {
                        valid = true;
                    } else {
                        return this.showMsg("كلمة المرور غير صحيحة.");
                    }
                } else if (username === "primary_user") {
                    valid = true;
                } else if (!cloudChecked) {
                    return this.showMsg("اسم المستخدم غير مسجل، يرجى إنشاء حساب جديد.");
                }
            }

            if (!valid) {
                return this.showMsg("اسم المستخدم أو كلمة المرور غير صحيحة.");
            }

            this.loginSuccess(username);
        }
    }

    loginAsGuest() {
        this.loginSuccess("primary_user");
    }

    loginSuccess(username) {
        this.currentUser = username;
        localStorage.setItem(this.SESSION_KEY, username);
        this.showMsg("تم الدخول بنجاح!", false);
        setTimeout(() => {
            this.hide();
            this.updateUI();
            if (typeof window.startApp === "function") {
                window.startApp(username);
            }
        }, 300);
    }

    logout() {
        if (!confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) return;
        localStorage.removeItem(this.SESSION_KEY);
        this.currentUser = null;
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
