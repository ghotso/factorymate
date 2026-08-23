# Proposal: Exploration map (world + progression overlay)

**Status:** draft — investigation only, not on roadmap  
**Related:** spec §3 (`schematic_state`, `research_node_state`), §4.1 (FRM polling), §7/§8 (`/milestones`, `/research`), `docs/frm-docs/.../getDropPod.adoc`, `getArtifacts.adoc`, `getPowerSlug.adoc`, `getMapMarkers.adoc`; existing `frontend/components/research/research-tree-canvas.tsx`; `docs/proposals/savegame-download.md` (optional save-parse path)

FactoryMate already tracks **what** the group has unlocked (milestones, hard-drive recipe choices, M.A.M. nodes) but not **where** collectibles live on the Satisfactory world map. This proposal describes a satisfactory map view that answers:

- Which **crash sites / hard drives** are looted vs still out there?
- Which **M.A.M. nodes** are purchased vs available (and later: not yet reachable)?
- (Later) Somersloops, Mercer spheres, power slugs, and player map markers.

---

## 1. Two different “maps” (do not conflate)

| Concept | What it shows | Data today | UI today |
| --- | --- | --- | --- |
| **World map** | Geographic positions on the Satisfactory map (x/y in Unreal cm) | **Not polled** — FRM has endpoints but FactoryMate ignores them | **None** |
| **M.A.M. research tree** | Logical grid of research nodes (Coordinates are UI slots, not world position) | Fast poll → `research_node_state` | `/research` with `ResearchTreeCanvas` — purchased / available / hidden styling |

Players often say “map” for the world view (crash sites) and “tree” for M.A.M. This feature is primarily the **world map**, with **tight links** to `/milestones` and `/research` for recipe context.

**Recommendation:** Ship one nav entry (`/exploration` or `/map`) for the world view. Keep `/research` as the M.A.M. tree (already good). Cross-link: clicking a looted crash site could jump to the Hard Drive tab if a schematic is `hard_drive_ready`.

---

## 2. What “satisfactory” means for v1

### 2.1 Hard drives (crash sites)

In Satisfactory, a **physical** hard drive comes from a **crash site drop pod**. After collection, the player spends drives in the M.A.M. to unlock **alternate recipes** (`schematic_state` rows with `type = "Hard Drive"`).

| Layer | Meaning | FactoryMate source |
| --- | --- | --- |
| **World pickup** | Pod opened/looted at (x, y, z) | FRM `GET /getDropPod` → new `drop_pod_state` table |
| **MAM choice** | Recipe selected (or waiting to select) | Already in `schematic_state` via fast poll `getSchematics` |
| **Not yet found** | Sites the save has never looted | **Static catalog** (see §4) — FRM does not list absent pods |

**Live verification (group server, 2026-08-23):**

- `getDropPod`: **20** pods returned — 2 looted, 18 not looted (mix of `Opened` true/false).
- `getSchematics` with `Type == "Hard Drive"`: **110** schematic rows (individual alternate unlocks / states), separate from pod count.
- Wiki / community maps reference **~118** crash sites in 1.0 — so FRM’s 20 pods is almost certainly **not** the full static set (likely only discovered/simulated pods, or save progression). **Do not assume `getDropPod` alone can drive “remaining” counts.**

Marker states to show on the world map:

| State | Condition | Visual (suggested) |
| --- | --- | --- |
| `looted` | `Looted == true` | Solid drive icon, muted/green |
| `opened_unlooted` | `Opened && !Looted` | Highlighted — “go finish this” |
| `sealed` | `!Opened` | Show `RequiredItem` / `RequiredPower` on hover |
| `unknown` | In static catalog, no matching FRM row | Ghost/outline marker (phase 2) |
| `catalog_only` | Static catalog, save not scanned yet | Optional dashed ring |

Matching FRM pods to catalog entries: nearest-neighbor within tolerance (~500 cm) on (x, y), keyed by stable `BP_DropPod*` id when ids align.

### 2.2 M.A.M. nodes “in use”

**Already implemented** on `/research`:

- `Purchased` — researched (in use)
- `Available` — can buy now
- `Hidden` — not visible yet

Live server: **57** purchased, **47** available (no `Hidden` in current save).

**Gap for “not in use currently”:** nodes that are `Available` but nobody has bought — already styled differently from `Purchased`. No world-map coordinates exist for these; they stay on the research tree canvas.

**Optional enhancement (same milestone, low cost):** filter toggles on `/research` — “Purchased / Available / Hidden” — and a summary badge on the new world map page (“47 M.A.M. nodes available”).

### 2.3 Other collectibles (later phases)

| Collectible | FRM endpoint | Behavior when collected |
| --- | --- | --- |
| Somersloop / Mercer sphere | `getArtifacts` | **Disappears** from FRM when picked up (live server: **0** rows — all collected) |
| Power slug | `getPowerSlug` | Same — live server: **0** remaining |
| Player beacons / pings | `getMapMarkers` | 17 markers on live server — optional overlay |

For “not found yet” on slugs/artifacts, the same **static catalog + live remainder** pattern as crash sites applies.

---

## 3. Goals and non-goals

### Goals

- Pan/zoom **world map** with markers for crash sites, colored by loot status.
- Summary header: `looted / total` (total from catalog once phase 2 lands; v1 can show `looted / known_from_frm`).
- Marker popover: coordinates (game units ÷ 100), open cost, link to `/milestones` Hard Drive tab when relevant.
- Reuse existing patterns: slow poll like `getDoggo`, read-only API, viewer access, i18n via `messages/en.json`.
- Static assets in repo (map image + catalog JSON), same spirit as planner `assets/` and `testdata/frm/`.

### Non-goals (v1 of this feature)

- 3D world view, terrain mesh, or foundation-accurate factory layout (`getFactory` buildings on map — huge scope, separate feature).
- Importing Satisfactory-Calculator save uploads or parsing `.sav` on every page load (save download exists; optional offline enrichment only).
- Replacing community maps (SCIM, th.gl) — we show **this save’s** state on a **simple** embedded map.
- React Flow for geography (React Flow stays planner + research tree only per spec §2.1).
- Notifications for newly scanned crash sites (could be a follow-up message type; not required for map MVP).

---

## 4. Data architecture

### 4.1 FRM slow poll (new)

Add to slow poll bundle (§4.1 cadence, default 5 min):

| Endpoint | Purpose |
| --- | --- |
| `getDropPod` | Crash sites — primary v1 signal |
| `getArtifacts` | Remaining somersloops / mercer spheres (phase 3) |
| `getPowerSlug` | Remaining slugs (phase 3) |
| `getMapMarkers` | Optional player markers (phase 4) |

Partial failure behavior: same as existing slow poll — log error, keep last-known rows for that entity type.

### 4.2 New DB tables (sketch)

```sql
-- One row per FRM drop pod id seen on the save
CREATE TABLE drop_pod_state (
    pod_id TEXT PRIMARY KEY,
    location_x REAL NOT NULL,
    location_y REAL NOT NULL,
    location_z REAL,
    opened BOOLEAN NOT NULL,
    looted BOOLEAN NOT NULL,
    cost_type TEXT,
    required_item_json TEXT,   -- FRM RequiredItem object
    required_power INTEGER,
    catalog_key TEXT,          -- matched static catalog id, nullable until matched
    updated_at TEXT NOT NULL
);

-- Remaining world collectibles (artifacts, slugs) — phase 3
CREATE TABLE world_collectible_state (
    entity_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,        -- 'somersloop' | 'mercer_sphere' | 'power_slug'
    class_name TEXT,
    name TEXT,
    location_x REAL NOT NULL,
    location_y REAL NOT NULL,
    location_z REAL,
    updated_at TEXT NOT NULL
);
```

No new table for M.A.M. nodes or hard-drive schematics — reuse `research_node_state` and `schematic_state`.

### 4.3 Static exploration catalog (required for “not found yet”)

Vendored JSON in `backend/data/exploration_catalog.json` (name TBD), versioned with game updates:

```json
{
  "version": "1.0",
  "dropPods": [
    {
      "key": "crash-site-001",
      "x": 236508,
      "y": -312236,
      "z": 10000,
      "label": "Northern Forest #1",
      "requiredItem": null,
      "requiredPowerMw": null
    }
  ],
  "powerSlugs": [],
  "artifacts": []
}
```

**Source options (pick one for implementation):**

1. **Manual curation** from [Satisfactory Wiki crash site table](https://satisfactory.wiki.gg/wiki/Crash_Site) — ~118 rows, stable coordinates in cm.
2. **Community export** (verify license): e.g. tools that emit JSON from SCIM datasets — **do not** embed SCIM web assets or scrape their API in production without permission.
3. **Save parse offline** (dev-only): `sat_sav_parse` / `sav_to_html.py` can list all hard drives with opened/looted flags — useful to **validate** catalog + FRM overlap, not for runtime.

Coordinate **positions** in the catalog are facts (wiki/community tables in Unreal cm) and are separate from map **imagery** — see §4.5.

### 4.4 Coordinate transform

FRM `location.x` / `location.y` are Unreal centimeters. In-game map coordinates shown to players are typically **÷ 100** (meters). Community maps use the same cm values for marker placement on a fixed image.

Implement `worldToMapPx(x, y) → { left%, top% }` with constants tuned once against the chosen basemap (calibrate 3–5 known crash sites). Store calibration in `exploration_catalog.json` or a small `map_projection.json`:

```json
{
  "imageWidth": 4096,
  "imageHeight": 4096,
  "originX": 0,
  "originY": 0,
  "scale": 0.000244
}
```

Unit-test the projection with fixtures from live FRM `getDropPod` captures in `backend/testdata/frm/`.

### 4.5 Map basemap / tile sourcing

There is **no official Coffee Stain source** for map tiles: no tile CDN, no map textures in `CommunityResources` / `FactoryGame-Docs.json`, and no FRM endpoint that returns map imagery. FRM only supplies **world coordinates** for markers; the basemap must come from elsewhere.

The [Satisfactory modding docs on extracting game files](https://docs.ficsit.app/satisfactory-modding/latest/Development/ExtractGameFiles.html) state that game assets are Coffee Stain IP and **should not be redistributed without permission**. FactoryMate already vendors extracted item icons under `assets/icons/` for the planner (same policy trade-off). The exploration map basemap should follow that **extract once in dev → commit stitched image → serve from backend** pattern — not runtime extraction in Docker/CI.

#### In-game asset location

The baked 2D world map is stored as four sliced `Texture2D` tiles in the game archives:

```text
FactoryGame/Content/FactoryGame/Interface/UI/Assets/MapTest/SlicedMap/
  Map_0-0.uasset
  Map_0-1.uasset
  Map_1-0.uasset
  Map_1-1.uasset
```

Stitch into a single `map.png` for the dashboard. Extraction yields **base terrain only** — no fog of war, resource nodes, player markers, or overlays. Those are drawn by FactoryMate on top (FRM coords + catalog JSON).

#### Extraction tooling (dev machine with a legal game install)

| Tool | Role |
| --- | --- |
| **[FModel](https://ficsit.app)** | Manual browse/export per modding docs; needs `FactoryGame.usmap` + `CustomVersions.json` from `CommunityResources/` |
| **[satisfactory-icon-extractor](https://github.com/relyen-dev/satisfactory-icon-extractor)** | `extract-map` subcommand — CUE4Parse-based; outputs `map.png`, `tiles/`, and `manifest.json` with stitch metadata |
| **GreyHak `sat_sav_parse`** | Uses community `blank_map20.png`-style basemaps for save HTML reports — same underlying idea (someone extracted once), not a runtime dependency |

Requirements match icon extraction: local Satisfactory install, Oodle decompression (`oo2core_9_win64.dll`), and UE5 pak/utoc access. **Do not** run this in the production container or CI — only on a developer workstation.

#### Recommended FactoryMate workflow

1. **One-time dev extract** (FModel or `extract-map`) from a machine that owns Satisfactory.
2. **Commit** vendored assets:
   - `assets/world-map/map.png` — stitched basemap
   - `assets/world-map/map_projection.json` — calibration constants (§4.4)
   - optional `assets/world-map/manifest.json` — source game version, tile refs, extract date (for maintenance)
3. **Serve** via `GET /api/exploration/map/image` (same rationale as `GET /api/planner/icons/{className}` — one backend copy, Docker-friendly).
4. **Document** extraction steps in `docs/guide/exploration.md` (mirror planner catalog/icon setup).
5. **Re-extract** when Coffee Stain ships a map update (new biomes, bounds changes) and bump `map_projection.json` if needed.

**Dockerfile:** copy `assets/world-map/` alongside `assets/icons/` and `docs/FactoryGame-Docs.json`; env `EXPLORATION_MAP_PATH` / `EXPLORATION_PROJECTION_PATH` with repo-relative defaults.

#### Rendering approach (v1)

Use a **single large PNG + pan/zoom** (`react-zoom-pan-pinch` or similar) with absolutely positioned marker overlays. A Leaflet **tile pyramid** (like Satisfactory-Calculator) is unnecessary for crash-site markers and adds maintenance cost. Defer tiled deep-zoom unless users ask for it.

#### Approaches to reject

| Approach | Why not |
| --- | --- |
| **SCIM / satisfactory-calculator tiles** | License forbids forking/self-hosting; hotlinking is fragile, off-site, and still Coffee Stain IP |
| **Embed SCIM / th.gl iframe** | No save-state overlay; external dependency (see §9) |
| **Wiki / scraped map images** | Same IP issues; inconsistent calibration |
| **Procedural / blank topo only** | Legally safest fallback if extraction is blocked, but worse UX; coords-only on a neutral grid |
| **Runtime extraction in production** | Impractical — needs full game install, Oodle, and UE5 tooling on the server |
| **Parse `.sav` for map art** | Save parse is for flags/coords validation, not tile sourcing |

#### Fallback

If committing extracted map art is ever deemed unacceptable, ship phase 1 with a **neutral grid / topo-style SVG** and accurate marker positions only. Prefer extraction aligned with existing `assets/icons/` practice unless counsel says otherwise.

---

## 5. API and UI

### 5.1 REST

`GET /api/exploration/map` (session, viewer):

```json
{
  "updatedAt": "2026-08-23T05:42:00Z",
  "stats": {
    "dropPods": { "looted": 2, "known": 20, "catalogTotal": 118 },
    "research": { "purchased": 57, "available": 47 }
  },
  "dropPods": [
    {
      "id": "BP_DropPod15_821",
      "catalogKey": "crash-site-042",
      "x": -189258,
      "y": 116331,
      "z": -1764,
      "opened": true,
      "looted": true,
      "requiredItem": null,
      "requiredPowerMw": null
    }
  ],
  "catalog": {
    "dropPods": [
      { "key": "crash-site-042", "x": -189258, "y": 116331, "label": "…", "requiredItem": null }
    ]
  }
}
```

Phase 1 can omit `catalog` and only return FRM-known pods. Phase 2 adds catalog + `status: "unknown" | "looted" | …` per catalog row.

Optional: `GET /api/exploration/map/image` serves the basemap PNG from `assets/world-map/` (like planner icons).

### 5.2 Page: `/exploration` (or `/map`)

| Area | Components (shadcn §8.1) |
| --- | --- |
| Header | Title, description, stats badges, last updated |
| Toolbar | Layer toggles (Crash sites; later slugs/artifacts/markers), filter (looted / unlooted / all) |
| Canvas | Pan/zoom container + absolutely positioned markers (not React Flow) |
| Detail | `Popover` or `Sheet` on marker click |

**Pan/zoom library:** prefer a small dependency (`react-zoom-pan-pinch` or similar) over hand-rolled touch handling. Do **not** add React Flow for this page.

**Icons:** `Desc_HardDrive_C` via existing `ItemIcon` / planner icon route; fallback lucide `HardDrive` if missing.

**i18n namespace:** `exploration` in `messages/en.json`.

### 5.3 Cross-links

| From | To |
| --- | --- |
| Crash site popover | `/milestones` (Hard Drive tab) when `schematic_state` has `locked=false, purchased=false` |
| Header stat “M.A.M. progress” | `/research` |
| `/research` (optional) | “View on world map” only if we ever add geo for something — not for M.A.M. nodes |

---

## 6. Phased delivery

### Phase 1 — “What we know from FRM” (MVP)

**Scope:** `getDropPod` slow poll, `drop_pod_state`, `GET /api/exploration/map`, `/exploration` page with basemap + markers for pods FRM returns.

**DoD:**

- Looted vs unlooted vs sealed styling matches §2.1 table.
- Coordinates in popover match in-game map (÷ 100) within rounding.
- Slow poll fixture test + API test; frontend Vitest for projection helper.
- No hardcoded UI strings; `npm run build` + `go test` pass.

**Does not yet show:** crash sites never returned by FRM.

### Phase 2 — “What’s still out there”

**Scope:** Vendored `exploration_catalog.json` (~118 crash sites), merge logic, ghost markers for catalog entries without a looted FRM row, accurate `looted / 118` summary.

**DoD:**

- ≥ 95% of FRM pods auto-match a catalog key on live save.
- Unmatched FRM pods still render (orphan marker + log warning).
- Document catalog update process in `docs/guide/exploration.md`.

### Phase 3 — Collectibles

**Scope:** `getArtifacts`, `getPowerSlug`, `world_collectible_state`, layer toggles, static catalog slices for slugs/spheres.

### Phase 4 — Polish

- `getMapMarkers` player beacons (filter `MapMarkerType`)
- Radar tower scanned resources (`getRadarTower` — large payload; evaluate need)
- Hard-drive schematic overlay: list **available recipe options** on looted sites only if we can correlate (likely **not** without save parse — show global “X drives ready in MAM” instead)

### Phase 5 — Research tree UX (optional, small)

- Filter chips on `/research` canvas
- Shared color language: purchased = emerald, available = primary, hidden = dashed muted (already in `research-node.tsx`)

---

## 7. Open questions (resolve before implementation)

1. **FRM `getDropPod` completeness:** Why only 20 pods on a mid-game save? Read FRM source / ask community whether undiscovered pods are omitted. This determines how aggressively we rely on the static catalog.
2. **Catalog licensing:** Confirm we can ship coordinate lists derived from wiki/community data (facts are not copyrightable; dataset packaging may need attribution).
3. **Basemap redistribution:** Resolved approach in §4.5 — extract like planner icons; re-extract on game updates. Open only if legal review rejects committing `assets/world-map/map.png`.
4. **Route name:** `/exploration` vs `/map` vs extending `/milestones` — prefer `/exploration` to avoid confusion with factory planner “map”.
5. **Notifications:** Worth a `crash_site_looted` or `hard_drive_collected` event? Out of scope for map MVP but affects poller design if added later.

---

## 8. Effort estimate (rough)

| Phase | Backend | Frontend | Assets/data |
| --- | --- | --- | --- |
| 1 — FRM pods only | 1–2 days | 2–3 days | Basemap + calibration |
| 2 — Full catalog | 1 day | 1 day | 1–2 days curating JSON |
| 3 — Slugs/artifacts | 1 day | 1 day | Catalog extension |
| 4 — Markers/polish | 0.5–1 day | 1–2 days | — |

Spec/roadmap touch: new milestone **M23** (or M14 backlog item) after M22; update §3, §4.1, §7, §8 when promoted to roadmap.

---

## 9. Alternatives considered

| Approach | Pros | Cons |
| --- | --- | --- |
| **Extract basemap from game install (§4.5)** | Matches `assets/icons/` precedent; accurate terrain; offline, no external tile host | Coffee Stain IP; manual re-extract on map updates; dev workstation required |
| **Embed SCIM / th.gl iframe** | Zero maintenance of map tiles | No save state overlay, licensing, auth, off-site dependency |
| **SCIM / calculator tile hotlink** | Looks like the familiar map | ToS/IP risk, brittle URLs, no self-hosting |
| **Procedural / blank topo basemap** | No game art in repo | Worse UX; still needs projection calibration |
| **Parse `.sav` on each request** | Complete opened/looted flags | Heavy, needs save download, slow, duplicates M22 |
| **Only extend `/research` tree** | Already built | Does not answer “where is the next hard drive?” |
| **FRM-only, no catalog** | Simplest code | Cannot show “not found yet” — fails user’s stated goal |

**Recommendation:** Hybrid — **FRM for live state**, **static catalog for completeness**, **extracted basemap in `assets/world-map/`** (§4.5) — same pattern as planner’s `FactoryGame-Docs.json` + `assets/icons/` + live FRM split.

---

## 10. Success criteria

1. A player can open `/exploration`, pan to an unlooted crash site near their base, read the open requirement, and paste coordinates into the game map.
2. Progress summary matches FRM: looted count equals pods with `Looted: true` in the latest slow poll.
3. After phase 2, total crash sites matches community reference (~118) with ghost markers for never-seen sites.
4. `/research` and `/milestones` remain the source of truth for M.A.M. and hard-drive **recipe** state; the world map does not duplicate that data entry.
