/**
 * Awrad & Enjaz Dashboard - Security Gatekeeper & PIN Lock Component
 * Protects personal dashboard and cloud data with a master PIN passcode.
 * Features:
 * - Native SHA-256 cryptographic hashing (crypto.subtle.digest)
 * - Fullscreen glassmorphic lock screen with animated PIN dots & keypad
 * - "Remember Device" session persistence
 * - On-screen touch keypad + physical keyboard support
 * - Change PIN / Lock Now controls
 */

class SecurityLock {
    constructor() {
        this.PIN_HASH_KEY = "AWRAD_PIN_HASH";
        this.AUTH_TOKEN_KEY = "AWRAD_AUTH_SESSION";
        this.SALT = "enjaz_secure_salt_v1";

        this.currentEnteredPin = "";
        this.isUnlocked = false;
        this.targetPinLength = 4; // default 4-6 digits
        this.onUnlockCallback = null;
    }

    /**
     * Compute SHA-256 hash of PIN string
     */
    async hashPin(pin) {
        if (!window.crypto || !window.crypto.subtle) {
            // Fallback lightweight hash if crypto.subtle is unavailable
            let hash = 0;
            const str = this.SALT + pin;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
            }
            return "simple_" + Math.abs(hash).toString(16);
        }

        const msgBuffer = new TextEncoder().encode(this.SALT + pin);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Check if a PIN is currently configured on this system
     */
    isPinSet() {
        return Boolean(localStorage.getItem(this.PIN_HASH_KEY));
    }

    /**
     * Check if the current device/session is already authorized
     */
    isSessionAuthorized() {
        if (!this.isPinSet()) return true; // No PIN set = freely accessible
        const sessionToken = localStorage.getItem(this.AUTH_TOKEN_KEY);
        const pinHash = localStorage.getItem(this.PIN_HASH_KEY);
        return Boolean(sessionToken && sessionToken === pinHash);
    }

    /**
     * Initialize security gatekeeper on page load
     */
    init(onUnlock = null) {
        if (onUnlock) this.onUnlockCallback = onUnlock;

        this.bindKeypadEvents();
        this.bindKeyboardEvents();

        if (this.isSessionAuthorized()) {
            this.isUnlocked = true;
            this.hideLockOverlay();
            if (typeof this.onUnlockCallback === "function") {
                this.onUnlockCallback();
            }
        } else {
            this.isUnlocked = false;
            this.showLockOverlay();
        }
    }

    /**
     * Show the fullscreen lock overlay
     */
    showLockOverlay() {
        const overlay = document.getElementById("pin-lock-overlay");
        const title = document.getElementById("pin-lock-title");
        const subtitle = document.getElementById("pin-lock-subtitle");
        if (!overlay) return;

        this.currentEnteredPin = "";
        this.updatePinDots();

        if (!this.isPinSet()) {
            if (title) title.textContent = "إنشاء رمز مرور جديد (PIN)";
            if (subtitle) subtitle.textContent = "قم بتعيين رمز مرور لحماية أورادك وسجلاتك من أي وصول غير مصرح به على الإنترنت.";
        } else {
            if (title) title.textContent = "لوحة أورادي وإنجازي مقفلة 🔒";
            if (subtitle) subtitle.textContent = "أدخل رمز المرور للمتابعة والوصول إلى مهامك اليومية.";
        }

        overlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }

    /**
     * Hide the fullscreen lock overlay
     */
    hideLockOverlay() {
        const overlay = document.getElementById("pin-lock-overlay");
        if (overlay) {
            overlay.classList.add("hidden");
            document.body.style.overflow = "";
        }
    }

    /**
     * Bind keypad button clicks
     */
    bindKeypadEvents() {
        const keys = document.querySelectorAll(".pin-key[data-num]");
        keys.forEach(btn => {
            btn.addEventListener("click", () => {
                const num = btn.getAttribute("data-num");
                this.appendPinDigit(num);
            });
        });

        const btnBack = document.getElementById("pin-key-backspace");
        if (btnBack) {
            btnBack.addEventListener("click", () => {
                this.removePinDigit();
            });
        }

        const btnClear = document.getElementById("pin-key-clear");
        if (btnClear) {
            btnClear.addEventListener("click", () => {
                this.clearPin();
            });
        }
    }

    /**
     * Bind physical keyboard inputs
     */
    bindKeyboardEvents() {
        window.addEventListener("keydown", (e) => {
            const overlay = document.getElementById("pin-lock-overlay");
            if (!overlay || overlay.classList.contains("hidden")) return;

            if (e.key >= "0" && e.key <= "9") {
                this.appendPinDigit(e.key);
            } else if (e.key === "Backspace") {
                this.removePinDigit();
            } else if (e.key === "Escape") {
                this.clearPin();
            }
        });
    }

    /**
     * Append digit to PIN
     */
    appendPinDigit(num) {
        if (this.currentEnteredPin.length >= 6) return;
        this.currentEnteredPin += num;
        this.updatePinDots();

        // Check automatically if at least 4 digits
        if (this.currentEnteredPin.length >= 4) {
            // If PIN is already set, check match
            if (this.isPinSet()) {
                this.verifyEnteredPin();
            } else if (this.currentEnteredPin.length === 4) {
                // If creating new PIN, prompt or set on 4 digits
                this.setNewPin(this.currentEnteredPin);
            }
        }
    }

    /**
     * Remove last entered digit
     */
    removePinDigit() {
        if (this.currentEnteredPin.length > 0) {
            this.currentEnteredPin = this.currentEnteredPin.slice(0, -1);
            this.updatePinDots();
        }
    }

    /**
     * Clear entered PIN
     */
    clearPin() {
        this.currentEnteredPin = "";
        this.updatePinDots();
    }

    /**
     * Update visual PIN dots
     */
    updatePinDots() {
        const dots = document.querySelectorAll(".pin-dot");
        dots.forEach((dot, index) => {
            if (index < this.currentEnteredPin.length) {
                dot.classList.add("filled");
            } else {
                dot.classList.remove("filled");
            }
        });
    }

    /**
     * Verify entered PIN against stored hash
     */
    async verifyEnteredPin() {
        const storedHash = localStorage.getItem(this.PIN_HASH_KEY);
        const enteredHash = await this.hashPin(this.currentEnteredPin);

        if (storedHash === enteredHash) {
            // Correct PIN!
            const rememberCheckbox = document.getElementById("pin-remember-device");
            const shouldRemember = rememberCheckbox ? rememberCheckbox.checked : true;

            if (shouldRemember) {
                localStorage.setItem(this.AUTH_TOKEN_KEY, storedHash);
            } else {
                sessionStorage.setItem(this.AUTH_TOKEN_KEY, storedHash);
            }

            this.isUnlocked = true;
            this.triggerSuccessAnimation();

            setTimeout(() => {
                this.hideLockOverlay();
                this.clearPin();
                if (typeof this.onUnlockCallback === "function") {
                    this.onUnlockCallback();
                }
            }, 300);
        } else {
            // Incorrect PIN
            if (this.currentEnteredPin.length >= 4) {
                this.triggerErrorShake();
            }
        }
    }

    /**
     * Set a new PIN for the first time
     */
    async setNewPin(pin) {
        if (!pin || pin.length < 4) {
            alert("يجب أن يتكون رمز المرور من 4 أرقام على الأقل.");
            return;
        }

        const hash = await this.hashPin(pin);
        localStorage.setItem(this.PIN_HASH_KEY, hash);
        localStorage.setItem(this.AUTH_TOKEN_KEY, hash);

        this.isUnlocked = true;
        this.triggerSuccessAnimation();

        setTimeout(() => {
            this.hideLockOverlay();
            this.clearPin();
            alert("🎉 تم تعيين رمز المرور (PIN) وتأمين لوحة الإنجاز بنجاح!");
            if (typeof this.onUnlockCallback === "function") {
                this.onUnlockCallback();
            }
        }, 300);
    }

    /**
     * Change existing PIN
     */
    async changePin(oldPin, newPin) {
        const storedHash = localStorage.getItem(this.PIN_HASH_KEY);
        if (storedHash) {
            const oldHash = await this.hashPin(oldPin);
            if (oldHash !== storedHash) {
                return { success: false, message: "رمز المرور القديم غير صحيح." };
            }
        }

        if (!newPin || newPin.length < 4) {
            return { success: false, message: "رمز المرور الجديد يجب أن يكون 4 أرقام على الأقل." };
        }

        const newHash = await this.hashPin(newPin);
        localStorage.setItem(this.PIN_HASH_KEY, newHash);
        localStorage.setItem(this.AUTH_TOKEN_KEY, newHash);
        return { success: true, message: "تم تغيير رمز المرور بنجاح! 🔒" };
    }

    /**
     * Disable/Remove PIN protection
     */
    async removePinProtection(currentPin) {
        const storedHash = localStorage.getItem(this.PIN_HASH_KEY);
        if (!storedHash) return { success: true };

        const enteredHash = await this.hashPin(currentPin);
        if (enteredHash !== storedHash) {
            return { success: false, message: "رمز المرور الحالي غير صحيح." };
        }

        localStorage.removeItem(this.PIN_HASH_KEY);
        localStorage.removeItem(this.AUTH_TOKEN_KEY);
        sessionStorage.removeItem(this.AUTH_TOKEN_KEY);
        return { success: true, message: "تم إلغاء قفل الحماية بنجاح." };
    }

    /**
     * Immediately lock current app & show lock overlay
     */
    lockNow() {
        localStorage.removeItem(this.AUTH_TOKEN_KEY);
        sessionStorage.removeItem(this.AUTH_TOKEN_KEY);
        this.isUnlocked = false;
        this.showLockOverlay();
    }

    /**
     * Shake animation on wrong PIN
     */
    triggerErrorShake() {
        const container = document.querySelector(".pin-dots-container");
        if (container) {
            container.classList.add("shake-error");
            setTimeout(() => {
                container.classList.remove("shake-error");
                this.clearPin();
            }, 500);
        } else {
            this.clearPin();
        }
    }

    /**
     * Success glow animation
     */
    triggerSuccessAnimation() {
        const dots = document.querySelectorAll(".pin-dot");
        dots.forEach(d => d.classList.add("dot-success"));
        setTimeout(() => {
            dots.forEach(d => d.classList.remove("dot-success"));
        }, 400);
    }
}

// Global Singleton Instance
window.securityLock = new SecurityLock();
