# Customer UI audit — 26/10/2026

Baseline: `9ce30dc`, branch `V1-ui-customer`. React 19 / Vite 8 / TypeScript,
Tailwind 4 plus legacy styles.css and brand-theme.css. Navigation is history API
in App.tsx, state is component-local React state; API uses api.ts and existing
contracts. No native app or framework migration. Public media come from
@goease/media / Cloudinary; logo and original Goe stay unchanged.

Evidence: source inspection plus the 95 baseline screenshots in
`C:/GoEaseDemo/Ảnh` (see Danh-muc.json). These are baseline observations, not
acceptance of redesigned screens. Existing screenshots show the suggestion row
collapsing its title into a narrow column, duplicated sticky bars, small labels,
large repeated mascots, and long forms without enough grouping.

## Screen inventory and findings

Each row covers layout, hierarchy, navigation, usability, typography, spacing,
icons, responsiveness and accessibility; improvements must preserve handlers.

| Route / screen                     | Layout, hierarchy and navigation                               | Usability, typography and spacing                               | Icons, responsive and accessibility                                    | Required change                                                             |
| ---------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| /welcome                           | Brand illustration + single start action                       | Long heading can crowd short viewport                           | Brand artwork preserved, reduced motion required                       | Bound hero, fluid title, safe-area action                                   |
| /login, /register                  | Shared AuthPage, story column hidden on mobile                 | Form labels/copy compete, bottom can scroll under controls      | Password toggle needs 48px target, errors retained                     | Compact form header, 16px inputs, consistent submit/links                   |
| RegistrationVerification           | Conditional OTP form after pending registration                | Code/resend timer must stay visible                             | Focus and disabled countdown preserved                                 | Same field, error, button tokens; no new OTP request                        |
| /forgot-password, /reset-password  | Single form + recovery states                                  | Error and help need clear grouping                              | Do not change token validation or password logic                       | Consistent auth surface and error region                                    |
| /                                  | Hero → trips → shortcuts → discovery                           | Duplicate mascot destination images and several large CTAs      | Bookmark targets small, headings inconsistent                          | Compact hero, trip-first emphasis, truthful no-photo destination fallback   |
| Home destination search/picker     | Existing bounded Sheet + region filters                        | Inputs need consistent target/spacing                           | Dialog focus return and accent-insensitive search remain               | Shared dialog/field/chip language                                           |
| /explore                           | Title, region selects, search, categories, list/map            | Filters consume most first screen, card captions overlap photos | One icon family, large bookmark target; map iframe may fail externally | Collapsible area filters, consistent card hierarchy                         |
| /places/:id                        | Hero → gallery → text → planning → notes, fixed CTA            | Very long titles and source text need room                      | Back/save targets; important credits must remain accessible            | Full-width readable content and 1 dominant CTA                              |
| /saved                             | Reuses ExplorePage; empty and unavailable cases exist          | Empty/list/map and add-to-trip must stay distinct               | Do not replace unavailable state with zero data                        | Same cards/search/empty presentation                                        |
| /trips                             | Intro, create card, lifecycle filters, cards, trash/offline    | Repeated create actions compete                                 | Active lifecycle needs more than color; labels wrap                    | Compact intro, clear filters and list cards                                 |
| /trips/trash                       | Trash list, restore/delete confirmation                        | Permanent delete cannot be made primary accidentally            | Keep confirmation and disabled states                                  | Consistent management rows/errors                                           |
| /trips/new                         | Quick setup → manual/AI preview → keep/save sheet              | Optional fields too long; small segments                        | No required date before planning; fields and labels remain             | Group input, sticky actions within safe viewport                            |
| Trip suggestions / activity editor | Sheet rows mix image, subtitle and add button                  | Image consumes text column; one-letter title wrapping observed  | 48px add/edit/close targets, source text retained                      | 64px thumbnail + flexible text + fixed action; expandable supporting copy   |
| /trips/:id                         | Header/hero, day tabs, timeline, settings, prepare             | Nav plus save bar compete; many loose activity actions          | Keep reorder, replace, delete, undo and day keyboard navigation        | Focused detail view, timeline rows and accessible action toolbar            |
| Trip settings / management         | Destination/dates/people/budget sheets, duplicate/share/delete | Long settings page with competing primary buttons               | Revision/unsaved guards remain mandatory                               | Group fields and management actions; restrained destructive action          |
| /budget + trip cost                | Preview route and actual calculations are separate             | Group/per-person amounts and unknowns must not be confused      | Progress semantics and qualifiers retained                             | One summary, grouped breakdown, readable source detail                      |
| Trip expenses / summary            | Actual-spend form/list and summaryOnly variant                 | Dense metadata, nested cards                                    | Preserve all amounts and no synthetic prices                           | Clear total, list, add/edit/error controls                                  |
| /goe + floating chat               | Existing trip/day context, log, proposal and composer          | Privacy copy dominates; composer competes with navigation       | visualViewport support, log live region, focus restore                 | Compact context, disclosure for privacy, bounded messages and safe composer |
| /account                           | Profile form + full password form                              | Security form overwhelms profile                                | No credentials changed during UI QA; keep dirty guard                  | Accessible disclosure group, clear profile save and logout                  |
| /share                             | Read-only shared trip + invalid/expired state                  | Must look like same product                                     | No new public link during UI QA                                        | Customer typography/cards and error state                                   |
| /offline.html                      | Standalone HTML/CSS/JS read-only cache viewer                  | Has its own older typography                                    | No live-map/AI promises while offline                                  | Same brand tokens, targets, hierarchy and safe-area spacing                 |

## Shared debt and boundaries

- Equivalent buttons/fields/segmented controls already exist; upgrade them rather
  than building a parallel component library. Reuse Sheet, Field, Notice, cards.
- CSS is layered and has many old breakpoints (650/700/760/900/1100); a scoped
  customer stylesheet will provide a coherent 640/900 mobile/tablet adaptation.
- API consumers: /auth/_, /destinations, /places, /me/places, /me/profile,
  /trips/_, /ai/* and /shared-trip. No request shapes or ownership changes.
- Admin layout is out of customer redesign scope. Mechanical icon imports can
  share the same pack; admin markup, styles and business controls stay intact.
- Baseline runtime limitations: external OSM iframe resets connections; no new
  provider call or email transmission is needed to redesign those UI states.

## 26/10/2026 — structural mobile revision after feedback

The user rejected the earlier large type, poetic intro blocks and unchanged page structure. Current revision removes editorial intros on task screens, reduces repeated instructions, and reorganizes trips/account/cost/place/Goe markup. Current evidence and limitations are in QA_REPORT.md. Small secondary controls remain a touch-target tradeoff for later device review.
