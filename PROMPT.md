# GeoQuest — Bug Fixes & Small Features

Implementation spec. Each item is independent — work through them in order and verify each one before moving to the next. Don't refactor unrelated code.

Where an existing shared component/hook/context already covers a concern (location tracking, sidebar state, icon rendering), extend it rather than creating a parallel implementation. Flag any item where the current codebase structure makes the "obvious" fix risky, and propose the safer alternative before implementing.

---

## 1. Restore "visited" tag on pin detail (GPS-based)

- Tag is ON when the pin's creator has physically been near the pin's GPS coordinates.
- Named radius constant (50–100 m).
- Reuse existing location handling — no second GPS watcher.
- Persist visited state per pin / per creator.
- Show only on pin detail, and only for pins the current user created.

## 2. Sidebar scroll when collapsed

- Add `overflow-y: auto` to the collapsed sidebar content container.

## 3. Fix stale delete-confirmation bug

- Reset delete-confirmation state when the selected/open pin changes.
- Scope the confirmation to the specific pin.

## 4. Sign-up page: padding after confirm-password field

- Add padding after the confirm-password field, matching the form's existing spacing rhythm.

## 5. Multi-icon support for categories/pins

- Icon field becomes an array.
- Multi-select icon picker.
- Render multi-icons everywhere (pin markers, category pills, filter panel, pin detail).
- Backward compatibility for existing single-icon records.

## 6. Match navbar colors/style to main sidebar

- Copy the sidebar's exact color tokens/classes to the main navbar AND the secondary sidebar navbars, including hover/active states.

## 7. Only one sidebar open at a time (app-wide)

- When any sidebar opens, close whichever other sidebar is open first.

## 8. Extend category filter to also match pin text

- Per selected category: `pin.categoryId === category.id` OR `containsSubstring(pin.name, category.name)` OR `containsSubstring(pin.description, category.name)` OR `pin.tags.some(...)`.
- Case-insensitive substring; OR across categories; keep viewport scoping; check that `tags` exists before using it.

## 9. Exploration bar: recursive hierarchical progress

**In scope — the roll-up logic**: a parent division is fully explored when all its direct children are fully explored, recursively at every level. Percentage at any node = (fully-explored direct children) ÷ (total direct children), computed bottom-up — a leaf change ripples upward through every ancestor.

**Hierarchy extends through country and world level**: the recursive rule isn't capped at city/sub-city — it continues up through Country and, at the top, a "World" aggregate across all countries. Switching to a parent's aggregate view at *any* level (sub-city→city, city→country, country→world) is driven by one consistent **visibility-percentage threshold** (start with 50%, make it a named constant) rather than full containment — once that much of a division's area is in the viewport, the bar switches to reporting that division instead of its children's detail. World-level exploration aggregates across every country in the divisions dataset, including ones with zero explored content (they count as 0%, not excluded). This means computing "% of a division visible" generically — geometry intersection against the viewport bounds — not a per-level special case.

**Suggestions to improve accuracy** (worth considering, confirm before adopting):
- **Area-weighted aggregation** instead of simple count-averaging, so a huge sparsely-explored region doesn't get diluted the same as a tiny fully-explored one.
- **Hysteresis around the threshold** (e.g. switch up at 55%, back down at 45%) to stop the bar flickering between levels near the boundary.
- **Debounce recalculation** on pan/zoom (150–300ms after movement settles) — geometry intersection on every frame is expensive.
- **Cache per-viewport results** keyed by a rounded bounding box, for repeated pans over the same area.
- **Decide explicitly** whether leaves can be partially explored or are atomic — affects how this rolls up.

**Persistence**: store computed state per division node in the DB, with one clear update path (sync-on-write or lazy-on-read) when a leaf's status changes.

**Before implementing, confirm**: the actual shape/depth of the hierarchy data, and whether division records already have a place to store explored state.

---

## 10. Noticeable indicator for routes/pins with comments

No visual cue currently exists that a pin/route has comments. Suggested approach: a small circular badge in the corner of the marker showing comment count (like a notification badge), capped at "9+" for large numbers, only shown when count > 0. For routes (start+end pin pairs), badge both endpoints or place it at the midpoint if rendered as a line. Keep it visually distinct from the "visited" tag and other badges so they don't collide.

## 11. Transparent background for category pin icons

Category pin/marker icons currently sit on an opaque circle background, which looks off. Remove that background so only the icon artwork (or the marker's pin-shape container, if any) renders — scoped to category pin icons only, not app-wide.

## 12. Fix collapsed-sidebar highlight shape (oval → circle)

The collapsed sidebar's active/hover highlight is oval — fix it to a proper circle (equal width/height, `border-radius: 50%`) regardless of icon size/padding.

## 13. Community widget: mobile overlap + close/reopen

- Reposition the widget on small screens so it stops overlapping the map's location-detail info icon — use a responsive breakpoint if one exists already.
- Add a close (X) button.
- When closed, show a small floating toggle button that stays visible on the map so the user can reopen the widget — persists until tapped.

## 14. Stats dashboard (travel summary)

A personal travel-summary dashboard built entirely on the existing GPS check-in log (item 1) and division hierarchy (item 9) — no parallel tracking system. Ship in three phases; Phase 1 is a complete usable dashboard on its own.

**Phase 1 — Core (ship first)**
- Countries visited (distinct count); places visited per country; days stayed per country (distinct calendar days with a check-in, in one agreed timezone — see confirmations; robust to tracking gaps, no arrival/departure guessing).
- Total places visited as a headline number.
- Layout: summary row (three big numbers) + per-country breakdown list, sortable by places/days/name.

**Phase 2 — Near-term additions (cheap, all derivable from existing data)**
- First/most-recent visit date, overall and per country.
- Exploration % per country (reuses item 9's data directly).
- Category breakdown (reuses the items 5/8/11 category system).
- Continents visited (rolled up from countries).
- Shaded world map (reuse the existing Mapbox instance) + bar chart of places-per-country.
- Longest streak of consecutive days in one country.

**Phase 3 — Stretch (flag as follow-on, needs scoping)**
- Milestones/badges — needs a new achievements table.
- Distance traveled — start with straight-line/haversine between check-ins; route-based is pricier, defer it.
- Highest-rated places / photos per country — only if pins support ratings/photos (see confirmations — they do not yet).
- Year-in-review auto-summary.
- Social comparisons — only if a friends layer exists or is planned (see confirmations — none exists; do not build one just for this).

**Data & implementation requirements (all phases)**
- Materialized per-user summary table, updated incrementally on each new check-in — never full-scan the raw log on dashboard load.
- Country attribution from the existing division hierarchy, not a separate reverse-geocode.
- Explicit decision on which timezone drives "distinct calendar day" (device-local vs. location-derived vs. UTC) — changes day-counting for cross-timezone travelers.
- Clear empty state for new/low-activity users.

**Confirmations (checked 2026-09-01)**
- Pins do NOT support ratings; they carry a single `image_url` (one photo URL, nullable). → "highest-rated / photos per country" needs scoping (defer, or count non-null `image_url`).
- No social layer exists or is planned (no friends/followers tables or routes). → social comparisons stay out of scope.
- Check-in captures no client timezone: `POST /places/unlock` sends only `{ placeId, latitude, longitude }`; `unlocked_at` is a Drizzle `timestamp` (no tz), defaulted server-side (`now()`, UTC session). → "distinct calendar day" must be decided: (a) capture the client's timezone offset at unlock (one new column + client change) for the spec's "local timezone at check-in" ideal, or (b) count days in UTC.
