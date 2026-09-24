# 🚀 دليل النشر السحابي المجاني (24/7 Deployment Guide)

> **أورادي وإنجازي (Awrad & Enjaz Dashboard)**  
> يمكنك استضافة هذا الموقع مجاناً 100% ليعمل على مدار الساعة (24/7) دون الحاجة لتشغيل جهاز الكمبيوتر، والوصول إليه من هاتفك عبر نطاق آمن (HTTPS).

---

## 🌟 الطريقة الأسهل والأسرع: عبر GitHub + Vercel (موصى بها)

### الخطوة 1: رفع المشروع إلى GitHub
1. أنشئ مستودعاً جديداً (New Repository) على [GitHub.com](https://github.com) واجعله **Private** (خاص).
2. في مجلد `awrad-ui` على جهازك، قم بتشغيل الأوامر التالية (أو شغّل ملف `deploy_git_commit.bat`):
   ```bash
   git init
   git add .
   git commit -m "Initial commit for 24/7 cloud deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

---

### الخطوة 2: الربط بـ Vercel (مجاناً بضغطة زر)
1. سجّل الدخول مجاناً إلى [Vercel.com](https://vercel.com) بحسابك على GitHub.
2. انقر على **"Add New..." ➔ "Project"**.
3. اختر المستودع الخاص بك وانقر **"Import"**.
4. في خانة **Framework Preset**، اختر **Other**.
5. انقر **"Deploy"**.
6. في ثوانٍ معدودة، سيعطيك Vercel رابطاً عاماً مثل:
   `https://your-enjaz-project.vercel.app`

---

## ⚡ البديل: النشر عبر Cloudflare Pages (مجاني وغير محدود)
1. سجّل الدخول إلى [Cloudflare Dashboard](https://dash.cloudflare.com/) ➔ **Workers & Pages**.
2. انقر **Create application ➔ Pages ➔ Connect to Git**.
3. اختر المستودع، وضع Build output directory: `.`
4. انقر **Save and Deploy**.

---

## 🔒 الخطوة الأخيرة بعد النشر:
1. افتح رابط موقعك على الجوال أو الحاسوب.
2. ستظهر لك شاشة القفل لتعيين رمز مرور سري (PIN) لمنع أي متطفل من رؤية إنجازاتك.
3. ادخل إلى تبويب **البيانات** واضغط **"ضبط إعدادات السحابة"** وأدخل رابط ومفتاح Supabase الخاصين بك لتفعيل المزامنة اللحظية الفورية 24/7!
