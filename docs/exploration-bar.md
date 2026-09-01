# Exploration bar — implementation plan (trimmed)

Concrete plan for the three genuine deltas behind the exploration-bar accuracy/speed
work. Everything else in the broader strategy doc **already exists** in this codebase
(see "Already in place" below) or is over-engineered for the current client/server
design — do not build those.

Anchors (current code):
- Schema: `server/src/db/schema.ts` — `places` (:54), `placeExploration` (:109)
- Roll-up recompute: `server/src/routes/places.ts` — `computeCountryExploration` (:46),
  `upsertExploration` (:101), `recomputeAndPersistCountry` (:133), unlock path (:196)
- Client selection: `frontend/src/hooks/useExploreProgress.ts` — `VISIBLE_THRESHOLD` (:46),
  `bboxVisibleFraction` (:84), pick loop (:230)

---

## Already in place (do not rebuild)

- **Data model** — `places` is the divisions table (self-referencing `parent_id`,
  `admin_level`, `level_type`, PostGIS `boundary` as `geometry(MultiPolygon,4326)`).
  `placeExploration` stores per identity `explored` + `percent` denormalized → O(1) reads.
  PostGIS handles multi-polygons natively.
- **Client/server split** — server owns the roll-up; client only does viewport-visible math
  against a per-country memoized bbox cache (no polygon intersection, no per-pan DB query).
- **Debounce + caching** — 500ms settle debounce; `bboxCache` parses every boundary once per
  country, never per move (this was the old speed bug; fixed).
- **Accurate selection** — visible-fraction (≥ `VISIBLE_THRESHOLD`) region pick replaces the
  old binary "fully contained" test (fixed the Addis Ababa + neighbor-edges mislabel).
- **Sync** — refetch-on-settle on unlock; no websockets (none exist; don't add for this).

---

## Delta 1 — Incremental O(depth) roll-up on unlock

**Why:** `POST /places/unlock` currently recomputes the *entire* country tree
(`recomputeAndPersistCountry`, places.ts:258). Correct but O(tree) per unlock. Replace with
an ancestor-chain walk that only touches the changed branch.

**Replace `recomputeAndPersistCountry` with `refreshAncestors(placeId, owner)`:**
1. Upsert the unlocked leaf's own row (`explored = true`).
2. Walk `parent_id` upward. At each ancestor, read its **direct children's stored
   `explored` flags** (one `inArray` query on `placeExploration`), recompute
   `explored`/`percent`, upsert via the existing `upsertExploration`.
3. **Early-exit:** if a node's recomputed `explored`/`percent` equals its stored value,
   stop — nothing above it can change.
4. Guard depth (e.g. ≤ 64) against malformed cycles.

Complexity: O(depth × fan-out). Leaves in `/places/exploration` stay as-is; the legacy
backfill path there may keep the full recompute (one-time only).

---

## Delta 2 — Hysteresis in region selection (client)

**Why:** a single `VISIBLE_THRESHOLD` flips the label near a boundary. Two thresholds
prevent flicker.

**In `useExploreProgress.ts`, keep the current "deepest ancestor ≥ threshold" walk but bias
toward the previous pick:**
- Thresholds: `VISIBLE_GAIN = 0.5` (a region you zoomed into), `VISIBLE_KEEP = 0.45` (still
  holds if already selected).
- Track the previous pick in a `useRef` (`{ id, fraction }`), reset when `countryIso2` changes.
- Decision: if the previous pick is still an ancestor of the viewport center **and** its
  visible fraction ≥ `VISIBLE_KEEP`, keep it. Otherwise pick the deepest ancestor with
  fraction ≥ `VISIBLE_GAIN` (the existing walk), and store that as the new previous pick.

Net effect: Addis at ~45–49% on screen stays "Addis Ababa Explored" instead of bouncing to
a neighboring region or the country.

---

## Delta 3 — Area-weighted roll-up

**Why:** `percent = exploredChildren / totalChildren` (count-based, places.ts:85) lets one
tiny explored district count the same as one huge unexplored one. Weight children by area.

1. **Schema:** migration `0011` — add `area double precision` to `places` (nullable).
2. **Backfill:** `UPDATE places SET area = ST_Area(boundary::geography) WHERE boundary IS NOT NULL;`
   (`ST_Area` on a `geography` cast sums multi-polygon parts and returns m²; ratio within a
   parent is unit-agnostic, so m² is fine). Any row with null area (no boundary) is weight 0
   and documented as contributing nothing; guard division by zero.
3. **Populate on import:** set `area` in `server/src/services/fetchCountryBoundaries.ts`
   where places rows are inserted, so new countries get it from the start.
4. **Recompute with weights:** in both `computeCountryExploration` and Delta 1's
   `refreshAncestors`, percent becomes
   `round(100 × Σ(explored ? child.area : 0) / Σ(child.area))`. A node is `explored = true`
   only when every child is explored (unchanged — full coverage is still required).
5. **Staleness:** deployed change invalidates stored percentages. Recompute existing
   `place_exploration` rows once after deploy (SQL over all identities with unlocks), or
   accept that rows refresh on the next unlock. Document whichever is chosen.

---

## Build order

1. Delta 1 — correctness, no viewport change.
2. Delta 2 — client-only smoothness.
3. Delta 3 — schema + recompute; lands last because it changes stored percentages.

## Out of scope (do not build)

- New "divisions" table — `places` already serves this role.
- PostGIS GIST index / rbush / quadtree spatial index — the client loads one country into
  memory and never queries per pan.
- Exact polygon intersection + `simplified_geometry` — bbox visible-fraction is sufficient
  for selecting among nested regions; the UI has no use for pixel-precision boundaries.
- Websocket push on unlock — refetch-on-settle already exists and is debounced.
