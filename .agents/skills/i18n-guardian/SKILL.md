---
name: i18n-guardian
description: >-
  Automated Thai-English bilingual parity verification, translation dictionary synchronization, missing key detection, and locale formatting guardian.
  Use when adding new text, updating UI components, checking translations, or fixing language mismatches between Thai (TH) and English (EN).
---

# i18n Guardian (Internationalization & Localization Parity Skill)

This skill enforces strict 100% Thai-English bilingual parity across all platform dashboards, telemetry cards, charts, modals, and login portals.

---

## 1. Core Invariants for Bilingual Architecture

1. **Dual Dictionary Parity (1:1 Key Matching):**
   - Every key defined in `src/context/LanguageContext.jsx` under `TRANSLATIONS.th` MUST have an exact equivalent in `TRANSLATIONS.en`, and vice-versa.
   - Never allow one language to fall behind or contain undefined keys.

2. **Zero Hardcoded Text in JSX:**
   - Any user-visible label, tooltip, table header, button text, or status indicator must be wrapped in:
     - `t('translationKey')` via `const { t, lang } = useLanguage();`, OR
     - `isEn ? 'English Text' : 'ข้อความภาษาไทย'` for dynamic interpolations.

3. **Locale-Aware Formatting Invariants:**
   - **Calendar & Year:**
     - Thai (`th`): Buddhist Era (พ.ศ. = ค.ศ. + 543, e.g. `2569`) with Thai weekday/month abbreviations (`วันอาทิตย์ที่ 8 พ.ย. 2569`).
     - English (`en`): Gregorian (`2026`) with international weekday/month format (`Sunday, 8 Nov 2026`).
   - **Time Notations:**
     - Thai: `น.` (e.g. `14:00 น.`)
     - English: `hrs` or 24h digital time (e.g. `14:00` or `14:00 hrs`).
   - **Number & Currency Formatting:**
     - Always use `.toLocaleString()` for numbers.
     - Currency symbol `฿` (Thai Baht) placed appropriately.

4. **Interactive Dual-Flag Capsule Switcher:**
   - The platform provides a unified sliding capsule switcher (🇹🇭 TH / 🇬🇧 EN) in `Navbar.jsx` and `LoginPortal.jsx`.
   - Switching language persists across sessions in `localStorage.setItem('AOB_LANG', lang)` and dynamically triggers reactive updates across all views.

---

## 2. Automated Parity Verification Script

Before claiming any UI task or language modification complete, ALWAYS run the automated verification script:

```powershell
npm run verify:i18n
```

This script:
1. Verifies that `TRANSLATIONS.th` and `TRANSLATIONS.en` have 100% identical key sets.
2. Scans all 29+ JSX components in `src/` to confirm every `t('key')` call points to a valid key in the dictionary.
3. Automatically halts with exit code 1 if any key is missing or undefined.

---

## 3. Workflow Checklist for Adding / Modifying Text

- [ ] Check if the key exists in `src/context/LanguageContext.jsx`.
- [ ] If adding a new key, add it to BOTH `th: { ... }` and `en: { ... }`.
- [ ] In the component, import `useLanguage`:
  ```jsx
  import { useLanguage } from '../context/LanguageContext';
  // ...
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  ```
- [ ] Run `npm run verify:i18n` to verify parity.
- [ ] Run `npm run build` to verify 0 bundle errors.
