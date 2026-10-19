# Accessibility, browser, dan SEO review

## Automated gates

Next ESLint accessibility rules, production build, Lighthouse mobile, keyboard-only navigation, reduced-motion behavior, and contrast review are release gates. Public pages must have unique title/description, canonical site URL, robots, sitemap, OpenGraph image, semantic headings, labeled controls, visible focus, and responsive layout.

## Manual matrix

| Surface | Desktop | Mobile | Assistive checks |
|---|---|---|---|
| Public landing/lead | Chrome, Safari, Firefox | iOS Safari, Android Chrome | keyboard, 200% zoom, VoiceOver/TalkBack smoke |
| Login/MFA/reset | Chrome, Safari, Firefox | iOS/Android | labels, OTP autocomplete, error `role=alert`, focus order |
| Student material/submission/upload | Chrome, Safari | iOS/Android | keyboard, offline/retry, status announced |
| Teacher review/admin reports | Chrome, Safari | tablet/desktop | table semantics, filters, dialogs, no color-only status |

## Exit criteria

No critical/serious automated accessibility issue; Lighthouse accessibility and SEO target >= 90 on public/login pages; no horizontal overflow at 320 px; keyboard reaches every action; 200% zoom retains content; screen reader announces page/error/status. Actual scores and defects are appended after the browser run.

## Hasil lokal 6 Agustus 2026

Production build landing page, mobile Lighthouse: Performance 97, Accessibility 100, Best Practices 96, SEO 100. FCP 0.9 s, LCP 2.6 s, TBT 30 ms, CLS 0. Pemeriksaan 320 px tidak menemukan horizontal overflow; halaman berbahasa `id`, memiliki satu H1 dan skip-link. Temuan kontras teks oranye dan accessible-name logo dari run pertama sudah diperbaiki; run akhir tidak memiliki failed accessibility audit.

Best Practices 96 disebabkan request public CMS/statistics mendapat 500 karena API/database lokal tidak aktif. Ulangi di staging dengan seluruh dependency sehat; target 100 dan console tanpa error.
