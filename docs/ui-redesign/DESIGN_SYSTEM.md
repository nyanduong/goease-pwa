# GoEase customer design system

## Identity and color

Use existing source colors, logo and original Goe. No new imagery or rebrand.

| Token                | Existing color / meaning                        |
| -------------------- | ----------------------------------------------- |
| --customer-primary   | #c6530b, orange primary action; white label     |
| --customer-secondary | #007782, selected controls / secondary emphasis |
| --customer-accent    | #00858c, brand accent                           |
| --customer-bg        | #fafaf8, neutral app background                 |
| --customer-surface   | #ffffff, white surface                          |
| --customer-text      | #253b45, slate text                             |
| --customer-muted     | #5c6d76, supporting text                        |
| --customer-border    | #dce3e5, cool neutral border                    |
| --customer-disabled  | #e8f3f1 background + muted text                 |
| --customer-success   | #006f78 + existing soft teal surface            |
| --customer-warning   | #fff0d9 + dark ink                              |
| --customer-error     | #a63730, existing danger                        |

Primary buttons now use white text on a deeper orange #c6530b, following the owner feedback. The default solid pair has calculated contrast 4.52:1; hover #ac4507 + white measured 5.82:1 in the review tab.
Reserve solid dark teal + white for selected states. Photos may need a legibility
overlay; cards and buttons do not need decorative gradients. Do not hide unknown
prices or source warnings to make a card cleaner.

## Rhythm, type and geometry

- Space: 4 / 8 / 12 / 16 / 24 / 32px. Mobile gutter 16px, tablet 24px.
- Keep existing Inter/system font stack with Vietnamese support. No added webfont.
- Screen title 20–22px; trip title 19px; section 15–18px; card 13–15px; body 14px;
  secondary text 12–13px. Brand/AI captions 10px minimum with full sources accessible.
  Welcome artwork may retain a larger headline; task screens do not use display copy.
- Weights: body 400–500, labels 600, titles 700. Avoid heavy all-caps paragraphs.
- Primary actions are 44px; secondary chips 36–40px and floating Goe 48px. This
  revision does not meet a universal 48px target policy. Icon glyph 21px navigation,
  18–22px action, 16px inline. Radius 10–12px controls, 12–16px cards,
  24px top corners on mobile sheets. Border 1px, minimal elevation.
- Inputs 16px to avoid iOS focus zoom. No fixed-height text containers. Long
  Vietnamese names wrap normally in a flexible minmax(0,1fr) column.

## Icon system

Use @phosphor-icons/react 2.1.10 (peer React >=16.8, verified registry). Central
semantic aliases in icons.ts avoid broad component rewrites. Import individual
CSR modules to avoid loading all 9,000+ exports in development, per the
[official React documentation](https://github.com/phosphor-icons/react#usage).
Regular default, fill for active navigation/bookmarks. Logo, Goe and existing
decorative brand artwork are exempt; no emoji as functional icons.

## Reused components and states

Upgrade Field/Notice, Sheet and ConfirmationHost; share AppBottomNavigation,
Skeleton and existing cards rather than duplicate them. Default/pressed/focus/
selected/disabled/loading/error are required where applicable. Focus ring 3px
teal with offset. Selection adds fill/weight/shape, not color alone. Errors use
text and role=alert. Skeleton is only a loading representation, never sample data.

## Motion and viewport

120–180ms opacity/color/press feedback. No slow page entrance. Native dialogs
retain focus/escape and restore trigger focus. Reduced motion disables movement.
Use env(safe-area-inset-*), dynamic viewport units and visualViewport for keyboard
space. Avoid a fixed CTA and bottom nav competing on focused detail screens.

## Current structural revision

Use a short sticky app bar, one primary task action and contextual overflow for secondary work. Trip list uses horizontal image/metadata rows. Place cards use a two-column phone grid; credits sit outside the navigation button. Trip detail has compact overview/day tabs and actionable point rows. Notes, preparation, description, source qualifications and security forms expand on demand. Cost keeps incomplete-total warnings visible. Chat messages scroll independently of context/composer. Save bars appear only when dirty. Subtle 130–240ms screen/menu/nav motion obeys prefers-reduced-motion.

## Palette and interaction polish after the second review

Neutral canvas #fafaf8, white cards, slate text and restrained teal selected controls replace the old yellow/green surfaces. Selection pairs background with a dedicated readable foreground; no dark labels on orange actions. Color-role reference: [Android color guidance](https://developer.android.com/design/ui/mobile/guides/styles/color).

Compound search/password/composer fields have one focus treatment on their wrapper; the input has no separate border/outline. Preserve visible keyboard focus on other controls. The bottom navigation uses a single sliding top indicator, filled selected icon and no pale oval behind icons. It has no active marker for routes outside its five destinations. Reduced-motion still disables animations/transitions.

Goe launcher uses the existing transparent mascot asset without a white circular button. The launcher is hidden while profile/security forms are expanded, avoiding overlap with fields. Avatar preview frame and image both use 64px; picker actions occupy a separate full-width row. Public-upload information remains accessible in a disclosure. No upload/API/auth behavior was changed.
