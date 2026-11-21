/**
 * Awrady Dashboard - Global Toast Notifications Component
 * Provides non-blocking, accessible glassmorphism notifications.
 */

let container = null;

function getOrCreateContainer() {
    if (!container || !document.body.contains(container)) {
        container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.className = "toast-container";
            container.setAttribute("aria-live", "polite");
            container.setAttribute("aria-atomic", "true");
            document.body.appendChild(container);
        }
    }
    return container;
}

const TYPE_ICONS = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️"
};

/**
 * Display a non-blocking toast notification.
 * @param {string} message - Notification text (supports \n).
 * @param {"success"|"error"|"warning"|"info"} [type="info"] - Notification variant.
 * @param {number} [duration=3500] - Duration in ms (0 for persistent until closed).
 * @param {function} [onClose] - Optional callback executed when toast closes.
 * @returns {{ dismiss: function }}
 */
export function showToast(message, type = "info", duration = 3500, onClose = null) {
    if (!message) return { dismiss: () => {} };

    const toastBox = getOrCreateContainer();
    const toast = document.createElement("div");
    const normalizedType = TYPE_ICONS[type] ? type : "info";
    toast.className = `toast-item toast-${normalizedType}`;
    toast.setAttribute("role", normalizedType === "error" ? "alert" : "status");

    let displayIcon = TYPE_ICONS[normalizedType];
    let textContent = message;
    if (typeof message === "string") {
        const leadMatch = message.match(/^([✅❌⚠️ℹ️🎉🔄🧹])\s*/);
        if (leadMatch) {
            displayIcon = leadMatch[1];
            textContent = message.slice(leadMatch[0].length);
        }
    }

    const iconSpan = document.createElement("span");
    iconSpan.className = "toast-icon";
    iconSpan.textContent = displayIcon;

    const textSpan = document.createElement("div");
    textSpan.className = "toast-text";
    textSpan.textContent = textContent;

    const closeBtn = document.createElement("button");
    closeBtn.className = "toast-close";
    closeBtn.setAttribute("type", "button");
    closeBtn.setAttribute("aria-label", "إغلاق التنبيه");
    closeBtn.innerHTML = "&times;";

    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);
    toast.appendChild(closeBtn);

    let isDismissed = false;
    let timer = null;

    const dismiss = () => {
        if (isDismissed) return;
        isDismissed = true;
        if (timer) clearTimeout(timer);
        toast.classList.add("toast-hiding");
        
        const handleFinish = () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            if (typeof onClose === "function") {
                try {
                    onClose();
                } catch (e) {
                    console.error("[Toast] onClose error:", e);
                }
            }
        };

        toast.addEventListener("animationend", handleFinish, { once: true });
        setTimeout(handleFinish, 350);
    };

    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dismiss();
    });

    toast.addEventListener("click", () => {
        dismiss();
    });

    toastBox.appendChild(toast);

    if (duration > 0) {
        timer = setTimeout(dismiss, duration);
        toast.addEventListener("mouseenter", () => {
            if (timer) clearTimeout(timer);
        });
        toast.addEventListener("mouseleave", () => {
            if (!isDismissed) timer = setTimeout(dismiss, 1500);
        });
    }

    return { dismiss };
}

if (typeof window !== "undefined") {
    window.showToast = showToast;
}
