# Proposal: Exploration map (world map + collectibles)

**Status:** draft — investigation only, not on roadmap  
**Related:** spec §4.1 (FRM polling), `docs/frm-docs/.../getDropPod.adoc`, `getArtifacts.adoc`, `getPowerSlug.adoc`, `getMapMarkers.adoc`; `assets/map/` (FModel basemap tiles); `docs/proposals/savegame-download.md` (optional save-parse validation)

FactoryMate does not yet show **where** world collectibles are on the Satisfactory map. This proposal covers a world-map view that answers:

- Which **crash sites / hard drives** has the save found, opened, or looted?
- Which sites are **still out there** (static catalog vs live FRM state)?
- (Later) Somersloops, Mercer spheres, power slugs, and player map markers.

**Out of scope:** M.A.M. research trees, milestone schematics, and hard-drive **recipe** choices — those stay on `/research` and `/milestones`. This page is geographic only.

---

## 1. Hard drives (crash sites)

A **physical** hard drive comes from a **crash-site drop pod** in the world.

| Layer | Meaning | FactoryMate source |
| --- | --- | --- |
| **World pickup** | Pod at (x, y, z) — opened / looted state | FRM `GET /getDropPod` → new `drop_pod_state` table |
| **Collected, not yet analyzed** | Physical `Desc_HardDrive_C` in cloud/storage (picked up, M.A.M. scan pending) | FRM `GET /getCloudInv`, `GET /getStorageInv` — **observe first** (see §1.1) |
| **Not yet in save** | Sites never scanned or not yet present in FRM | **Static catalog** (~118 world positions) — see §3.3 |

### 1.1 FRM observation baseline (group server)

**Purpose:** Record how FRM exposes hard-drive state before building the map. The group will collect more drives and analyze them in M.A.M. today — re-capture after that and note what changed.

**Snapshot: 2026-08-23 ~09:06 CEST** (`http://192.168.178.42:8889`, read-only GET)

| Signal | Endpoint | Value | Notes |
| --- | --- | --- | --- |
| Drives in cloud / depot | `getCloudInv` | **18** × `Desc_HardDrive_C` | Collected items, not yet spent in M.A.M. (group estimate: most HDs are here unanalyzed) |
| Drives in world aggregate | `getWorldInv` | **1** | May overlap with storage |
| Drives in storage | `getStorageInv` | **1** (Personal Storage Box) | |
| Drives on players | `getPlayer` | **0** | |
| Drop pods in save | `getDropPod` | **20** total | Pods FRM knows about in this save |
| Pods looted (`Looted: true`) | `getDropPod` | **2** | `BP_DropPod15_821`, `BP_DropPod18` |
| Pods sealed (`Opened: false`) | `getDropPod` | **18** | |
| Pods opened, not looted | `getDropPod` | **0** | |
| Purchased alternate recipes | `getSchematics` (`Type: Alternate`, `Purchased: true`) | **6** | Prior M.A.M. spends (not from today’s batch) |
| Hard Drive schematic rows | `getSchematics` (`Type: Hard Drive`) | **1** | Generic `Research_HardDrive_0_C` slot; `Cost` shows `Hard Drive` remaining **1/1** |

**Key discrepancy (why we must observe, not assume):**

- **~18 drives in inventory** but only **2 pods marked `Looted`** in `getDropPod`.
- Group reports drives were **collected** but **not yet analyzed in M.A.M.** — FRM does not surface “unanalyzed” as a single field on the map endpoints we care about.
- The **20 pods** in `getDropPod` are **not** the same as “20 drives collected”; they are crash-site actors in the save (mostly still `Opened: false`).

**Open questions for today’s play session:**

1. When a drive is **picked up** from a pod, does `getDropPod.Looted` flip to `true` immediately, or only after M.A.M. analysis?
2. When a drive is **analyzed in M.A.M.**, what changes — `getCloudInv` count down, new `getSchematics` rows, something else?
3. Does `getDropPod` gain more rows as new crash sites are **scanned** (object scanner), separate from looting?
4. Is **`getCloudInv`** the right “drives banked” metric for a dashboard summary, or do we need multiple inventory endpoints?

**After today:** append a second snapshot below this table (date, same columns, delta notes). Do not implement map logic from assumptions until at least one before/after pair is documented.

**Snapshot 2: 2026-08-23 ~09:15 CEST** (during active play — user in M.A.M. / collecting)

**Player-reported state (in-game):**

| Bucket | Count | Notes |
| --- | --- | --- |
| Analyzed in M.A.M., **waiting to choose** alt recipe | **6** | Scan complete; recipe choice not committed |
| **Currently scanning** in M.A.M. | **1** | In progress |
| Remaining physical drives | **~rest** | User believes **interdimensional depot** (cloud) |

**FRM at same time (`192.168.178.42:8889`):**

| Signal | Value | Δ vs snapshot 1 | Visible in FRM? |
| --- | --- | --- | --- |
| `getCloudInv` HD count | **18** | unchanged | Yes — likely depot stock |
| `getStorageInv` HD | **0** | was 1 | Yes |
| `getDropPod` looted | **2** | unchanged | Yes — still does not reflect ~20+ collected |
| `getDropPod` total pods | **20** | unchanged | Yes |
| M.A.M. “6 pending recipe picks” | — | — | **Not found** as a dedicated field |
| M.A.M. “1 scanning” | — | — | **Not found** as a dedicated field |
| `getSchematics` `Type: Hard Drive` | **1** row (generic slot) | unchanged | Does not enumerate 6 pending choices |
| `getSchematics` alternates unlocked, not purchased | **61** | — | Global alt pool, not the 6 HD queue |

**Interpretation so far:**

1. **`getCloudInv` (18)** aligns with “most drives sit in the interdimensional depot” while the user works in M.A.M.
2. **M.A.M. workflow state** (scanning / analyzed-awaiting-choice) is **not exposed** on any FRM endpoint we polled — strongly supports **save-parse** (§1.2) for authoritative exploration/M.A.M. HD queue state if we need it on the dashboard.
3. **`getDropPod.Looted` is not a reliable “drive collected” signal.** Inventory shows **~18+ drives** in cloud/M.A.M. workflow, but only **2** pods with `Looted: true` (and only **2** with `Opened: true`). If `Looted` meant “drive removed from this crash site,” those numbers cannot both be true — at least **16+ pickups are invisible** to `getDropPod`. Likely explanations to verify: `getDropPod` only lists **scanner-discovered** pods (20 of ~118), `Looted` updates only in specific conditions, or drives were deposited to depot without the pod actor updating. **Do not use `Looted` count as `looted / collected` progress.**
4. For the **exploration map** specifically we may only need per–crash-site opened/looted flags; until save-parse lands, treat FRM pod rows as **hints** merged with the static catalog, not ground truth.

**Still to observe today:** pick one of the 6 recipes, finish the scanning drive, loot another crash site — re-poll FRM and note which endpoints change.

### 1.1.1 Save-parse validation (same autosave)

**Save file:** `data/Conveyor Belt Cult_autosave_3 (2).sav` — autosave at **2026-08-23 09:19 CEST** (same play session as snapshots 1–2).  
**Tool:** [GreyHak `sat_sav_parse`](https://github.com/GreyHak/sat_sav_parse) `sav_cli.py --export-crash-sites` + `--export-dimensional-depot` (subprocess, no Pillow needed for JSON export).  
**Build:** 502094, save version 60, modded (AutoSort, Depot Sorting, FRM, Infinite Zoop).

| Signal | Save parse | FRM (snapshot 2) | Match? |
| --- | --- | --- | --- |
| Hard drives in interdimensional depot | **18** | `getCloudInv` **18** | Yes |
| Total crash sites (world catalog) | **118** | — | Static catalog |
| Sites spawned in save (`found in save`) | **74** (43 closed + 10 open-empty + 21 dismantled) | `getDropPod` **20** rows | No — FRM is a small subset |
| Sites never spawned | **44** `NOT_IN_SAVE` | no row | Save only |
| Drive collected from site | **31** (21 `DISMANTLED` + 10 `IN_SAVE_OPEN_EMPTY`) | `Looted: true` **2** | No — FRM misses 29/31 |
| Opened, drive still inside pod | **0** `IN_SAVE_OPEN_FULL` | `Opened && !Looted` **0** | Yes |
| Sealed / not yet opened (spawned) | **43** `IN_SAVE_CLOSED` | `Opened: false` **18** (of 20 FRM rows) | Partial overlap |

**Per-site state enum** (`--export-crash-sites` JSON):

| State | Meaning | Count (this save) |
| --- | --- | --- |
| `NOT_IN_SAVE` | World position exists in catalog; actor not spawned yet | 44 |
| `IN_SAVE_CLOSED` | Pod spawned; not opened | 43 |
| `IN_SAVE_OPEN_FULL` | Opened; hard drive still in pod inventory | 0 |
| `IN_SAVE_OPEN_EMPTY` | Opened; drive removed; pod still standing | 10 |
| `DISMANTLED` | Pod dismantled after looting | 21 |

**Inventory reconciliation:** 31 drives taken from sites − 18 in depot = **13** elsewhere (M.A.M. queue, purchased alternates, etc.) — consistent with snapshot 2 (6 awaiting recipe + 1 scanning + 6 prior purchased ≈ 13).

**FRM vs save on the 20 FRM pod rows:**

| FRM `Looted` | FRM `Opened` | Save state | Count |
| --- | --- | --- | --- |
| `true` | `true` | `IN_SAVE_OPEN_EMPTY` | **2** (`BP_DropPod15_821`, `BP_DropPod18`) |
| `false` | `false` | `IN_SAVE_CLOSED` | **18** |
| — | — | collected but **not** in FRM list | **29** (8 more `IN_SAVE_OPEN_EMPTY` + 21 `DISMANTLED`) |

**Conclusions (resolves §1.1 open questions):**

1. **`getDropPod` is not a complete crash-site list.** It exposes ~20 **currently active** pod actors, not all 74 spawned sites and not all 118 world positions. Unspawned sites (`NOT_IN_SAVE`) and dismantled pods are absent.
2. **`Looted: true` ≠ “drive ever collected.”** In practice it means **opened + drive removed + pod actor still present** (`IN_SAVE_OPEN_EMPTY`). Once a pod is dismantled, it drops off FRM entirely even though the site was looted.
3. **`getCloudInv` depot count matches save parse** — good summary metric for “drives banked,” not per-site progress.
4. **Save parse is authoritative for per-site map markers** (`looted / 118` = count of `IN_SAVE_OPEN_EMPTY` + `DISMANTLED`, optionally + `IN_SAVE_OPEN_FULL`). FRM can supplement live deltas between autosaves but must not drive marker color alone.
5. **M.A.M. workflow** (scanning / awaiting recipe) is still not in the crash-site export; depot + schematic counts remain separate if we need that dashboard later.

**How FRM and the catalog combine (map UI):**

| Source | What it tells you |
| --- | --- |
| FRM `getDropPod` | Per–crash-site state in this save (`Opened`, `Looted`) — **semantics TBD** (§1.1) |
| FRM `getCloudInv` / storage | Physical drives held, not yet analyzed or spent |
| Static catalog | All **~118** world positions + typical open requirements (ghost markers, `looted / 118` denominator) |

Static catalog cross-check (2026-08-23): all **20** FRM pods matched a community coordinate reference with **0 cm delta** on x/y.

Marker states on the world map:

| State | Condition (save parse — primary) | Visual (suggested) |
| --- | --- | --- |
| `looted` | `DISMANTLED` or `IN_SAVE_OPEN_EMPTY` | Solid drive icon, muted/green |
| `opened_unlooted` | `IN_SAVE_OPEN_FULL` | Highlighted — “go finish this” |
| `sealed` | `IN_SAVE_CLOSED` | Show open requirement on hover |
| `unvisited` | `NOT_IN_SAVE` (catalog only) | Ghost/outline marker |

Match sites to catalog entries by `BP_DropPod*` id (`pathName` suffix); fallback nearest-neighbor within ~500 cm on (x, y). FRM `getDropPod` rows are optional hints between autosaves — see §1.1.1.

### Other collectibles (later phases)

| Collectible | FRM endpoint | Behavior when collected |
| --- | --- | --- |
| Somersloop / Mercer sphere | `getArtifacts` | **Disappears** from FRM when picked up |
| Power slug | `getPowerSlug` | Same |
| Player beacons / pings | `getMapMarkers` | Optional overlay |

Same **static catalog + live remainder** pattern as crash sites.

### 1.2 Data source assessment: FRM vs save file vs Dedicated Server API

Three ways to learn hard-drive / crash-site state. **There is no fourth native “exploration API”** on the game server.

#### A. FRM (`GET /getDropPod`, inventory endpoints) — current plan

| Pros | Cons |
| --- | --- |
| Already used everywhere in FactoryMate (poller pattern) | **Semantics unclear** — §1.1: 18 drives in cloud, only 2 pods `Looted` |
| Light JSON polls (~20 pod rows today) | Does not list unvisited sites (needs static catalog for ghosts) |
| No save download or binary parse | Runs on game `GameThread` when called via DS API proxy too |
| Fast enough for 5‑min slow poll | May lag or misrepresent pickup vs M.A.M. analysis |

**Verdict:** Useful for **depot counts** (`getCloudInv`) and **optional live hints** between autosaves. **Not authoritative** for per-site loot progress — §1.1.1 shows `Looted` tracks only a subset of open-empty pods, not dismantled or unlisted sites.

#### B. Dedicated Server HTTPS API (port 7777) — already in FactoryMate (M22)

FactoryMate already has `backend/internal/savegame/` with `QueryServerState`, `EnumerateSessions`, `DownloadSaveGame` (see `docs/proposals/savegame-download.md`).

**Native API functions** (Coffee Stain): server admin only — session list, save upload/download, server options, `QueryServerState` (tech tier, player count, …). **No crash-site or hard-drive query.**

**FRM proxy on the same port** (documented in `docs/frm-docs/.../dedicatedserver.adoc`):

```json
POST /api/v1  { "function": "frm", "endpoint": "getDropPod" }
```

This returns the **same JSON as FRM** — still `GameThread`, still the same ambiguous fields. It is **not** a different or safer data source; only a different transport (POST + admin token vs GET :8889).

**What the Game API *is* good for here:** obtaining the `.sav` file via `DownloadSaveGame` (already implemented). That enables option C without a new integration.

**Verdict:** Use Game API for **save download**, not as a replacement for FRM polling. Do **not** route exploration polls through `function: frm` unless FRM HTTP is unreachable — adds token + TLS complexity with no accuracy gain.

#### C. Parse `.sav` save file — how SCIM does it

[Satisfactory-Calculator Interactive Map](https://satisfactory-calculator.com/en/interactive-map) derives marker state from **save data**, not live FRM. Community tooling:

| Tool | Relevant capability |
| --- | --- |
| [GreyHak `sat_sav_parse`](https://github.com/GreyHak/sat_sav_parse) | `sav_cli.py --export-crash-sites` — opened / looted / dismantled per site; `sav_to_html.py` HD map legend (blue/green/white/cyan) |
| SCIM `Read.js` (reference only, **do not copy** — license) | Save parser that feeds their map JSON |

| Pros | Cons |
| --- | --- |
| **Authoritative save state** — matches what SCIM shows | Heavier: download ~1–25 MiB save + parse CPU |
| All **~118** sites with correct per-site flags (opened, looted, empty, dismantled) | Parser must track game versions (1.2.x format changes) |
| Resolves §1.1 ambiguity — validated on group autosave (§1.1.1): 31 collected sites vs FRM `Looted: 2` | **GPL‑3** (`sat_sav_parse`) — do not link statically; subprocess or reimplement in Go |
| Reuses **existing** `savegame.Service` download path | Stale between autosaves (not real-time like FRM) |
| No extra load on game `GameThread` during parse (offline) | Rate limit on download (1/user/5min for manual); background job needs its own cadence |

**Verdict:** **Best accuracy** for map markers and `looted / 118`. Best fit as a **slow background job** (e.g. every 30–60 min or after each autosave), not on every dashboard page load and not every 5 min.

#### Recommended hybrid (update to phased plan)

| Data | Source | Cadence |
| --- | --- | --- |
| Map positions + open requirements (ghost sites) | Static `exploration_catalog.json` | Ship with app; occasional game-update refresh |
| Per-site opened / looted / dismantled | **Save parse** (primary once implemented) | Slow background job via `DownloadSaveGame` |
| Live deltas between autosaves | FRM `getDropPod` (optional overlay) | 5 min slow poll — only if observation shows it updates faster than autosave |
| “Drives in depot” summary | FRM `getCloudInv` (+ storage) | Same slow poll as today’s inventory pattern |
| Basemap tiles | `assets/map/` (FModel extract) | Static |

**Phase 1 (observe):** FRM + catalog + basemap — §1.1 play session + §1.1.1 save validation **done**.  
**Phase 1b:** Add `exploration_save` job: server-side download (admin token, not user rate limit) → parse crash sites → `exploration_site_state` table. **Save wins on conflict** with FRM (documented in §1.1.1).  
**Phase 1 map UI** can ship with save-parse-backed markers once the background job exists; FRM-only markers would misreport ~29/31 collected sites on this save.

#### Implementation sketch (save path)

```
savegame.Client.DownloadSaveGame (existing)
    → temp .sav on disk
    → sat_sav_parse --export-crash-sites (subprocess, GPL isolated)
       OR future Go parser (port export format only)
    → upsert exploration_site_state
    → delete temp file
```

Log parse version + save `saveDateTime` from `EnumerateSessions` for debugging. Never expose raw `.sav` to viewers beyond existing download feature.

---

## 2. Goals and non-goals

### Goals

- Pan/zoom **world map** (four basemap tiles, §4.5) with markers for crash sites, colored by loot status.
- Summary: `looted / 118` (phase 2; phase 1 can show `looted / known_from_frm`).
- Marker popover: coordinates (game units ÷ 100), open cost when known.
- Reuse existing patterns: slow poll like `getDoggo`, read-only API, viewer access, i18n via `messages/en.json`.

### Non-goals (v1)

- M.A.M. research tree, milestone tabs, or hard-drive recipe selection UI.
- 3D world view or `getFactory` building placement on the map.
- Parsing `.sav` on every page load.
- Replacing community maps (SCIM, th.gl) — embed **this save’s** state only.
- React Flow for geography.
- Notifications for newly scanned crash sites (optional follow-up).

---

## 3. Data architecture

### 3.1 FRM slow poll (new)

Add to slow poll bundle (§4.1 cadence, default 5 min):

| Endpoint | Purpose |
| --- | --- |
| `getDropPod` | Crash sites — primary v1 signal |
| `getArtifacts` | Remaining somersloops / mercer spheres (phase 3) |
| `getPowerSlug` | Remaining slugs (phase 3) |
| `getMapMarkers` | Optional player markers (phase 4) |

Partial failure: log error, keep last-known rows for that entity type.

### 3.2 New DB tables (sketch)

```sql
CREATE TABLE drop_pod_state (
    pod_id TEXT PRIMARY KEY,
    location_x REAL NOT NULL,
    location_y REAL NOT NULL,
    location_z REAL,
    opened BOOLEAN NOT NULL,
    looted BOOLEAN NOT NULL,
    cost_type TEXT,
    required_item_json TEXT,
    required_power INTEGER,
    catalog_key TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE world_collectible_state (
    entity_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    class_name TEXT,
    name TEXT,
    location_x REAL NOT NULL,
    location_y REAL NOT NULL,
    location_z REAL,
    updated_at TEXT NOT NULL
);
```

### 3.3 Static exploration catalog (required for “not found yet”)

Vendored `backend/data/exploration_catalog.json`:

```json
{
  "version": "1.0",
  "dropPods": [
    {
      "key": "BP_DropPod4_25",
      "x": -33340,
      "y": 5176,
      "z": 23519,
      "requiredItem": { "name": "Cooling System", "className": "Desc_CoolingSystem_C", "amount": 10 },
      "requiredPowerMw": null
    }
  ]
}
```

**Curation sources (dev reference only — do not commit raw SCIM exports):**

1. [Satisfactory Wiki crash site table](https://satisfactory.wiki.gg/wiki/Crash_Site) (~118 rows, cm coordinates).
2. Cross-check against live FRM `getDropPod` as the save progresses.
3. Offline save parse (`sat_sav_parse`) to validate opened/looted flags — not for runtime.

### 3.4 Coordinate transform

FRM `location.x` / `location.y` are Unreal centimeters. In-game map UI uses **÷ 100** (meters).

Implement `worldToMapPx(x, y) → { xPx, yPx }` on a fixed **8192×8192** logical canvas (four 4096 tiles). Store calibration in `assets/map/map_projection.json`:

```json
{
  "logicalWidth": 8192,
  "logicalHeight": 8192,
  "boundWest": -324698.832031,
  "boundEast": 425301.832031,
  "boundNorth": -375000,
  "boundSouth": 375000
}
```

Bounds above match SCIM’s published world mapping (good starting point; verify against 3–5 known crash sites on our basemap). Unit-test with FRM fixtures in `backend/testdata/frm/`.

### 3.5 Map basemap — four tiles, no stitch

There is **no official Coffee Stain tile CDN**. FRM supplies coordinates only. Basemap comes from game extraction (same policy trade-off as `assets/icons/`).

#### In-game asset location (FModel)

```text
FactoryGame/Content/FactoryGame/Interface/UI/Assets/MapTest/SlicedMap/
  Map_0-0.uasset … Map_1-1.uasset
```

**FModel:** load `FactoryGame-Windows.utoc` → navigate to path above (or search `SlicedMap`) → right-click each `Map_*-*.uasset` → **Save Texture** (PNG). Setup: [modding docs — Extracting Game Files](https://docs.ficsit.app/satisfactory-modding/latest/Development/ExtractGameFiles.html) (`CustomVersions.json` + `FactoryGame.usmap` from `CommunityResources/`).

#### Repo status (2026-08-23)

Raw tiles in `assets/map/` (4096×4096 each):

| File | Quadrant |
| --- | --- |
| `Map_0-0.png` | top-left |
| `Map_0-1.png` | top-right |
| `Map_1-0.png` | bottom-left |
| `Map_1-1.png` | bottom-right |

**Do not stitch into a single `map.png`.** Reasons:

- Avoids duplicating ~17 MiB of PNG data in the repo.
- Matches how the game stores the asset (four slices).
- Frontend renders a 2×2 grid inside one pan/zoom viewport — same UX as one image.
- Re-exporting one quadrant after a game update is simpler.

```text
[ Map_0-0 | Map_0-1 ]
[ Map_1-0 | Map_1-1 ]
```

Serve tiles via `GET /api/exploration/map/tiles/{row}-{col}` (or four static routes). Extraction yields **base terrain only** — no fog, nodes, or markers (those are FactoryMate overlays).

#### Extraction tooling

| Tool | Role |
| --- | --- |
| **FModel** | Manual export (paths above) |
| **[satisfactory-icon-extractor](https://github.com/relyen-dev/satisfactory-icon-extractor)** | `extract-map` — can output tiles + optional stitched `map.png` (ignore stitch; keep tiles) |

**Do not** use SCIM / satisfactory-calculator tiles (license + Coffee Stain IP). See §8.

**Dockerfile:** copy `assets/map/` alongside `assets/icons/`; env `EXPLORATION_MAP_DIR` with repo-relative default.

---

## 4. API and UI

### 4.1 REST

`GET /api/exploration/map` (session, viewer):

```json
{
  "updatedAt": "2026-08-23T05:42:00Z",
  "stats": {
    "dropPods": { "looted": 2, "inSave": 20, "catalogTotal": 118 }
  },
  "dropPods": [
    {
      "id": "BP_DropPod15_821",
      "catalogKey": "BP_DropPod15_821",
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
      { "key": "BP_DropPod15_821", "x": -189258, "y": 116331, "requiredItem": null }
    ]
  }
}
```

Phase 1: FRM pods only (no `catalog`). Phase 2: full catalog + `unvisited` ghost markers.

`GET /api/exploration/map/tiles/{quadrant}` — `quadrant` is `0-0`, `0-1`, `1-0`, or `1-1`; returns `image/png`.

### 4.2 Page: `/exploration`

| Area | Components |
| --- | --- |
| Header | Title, stats (`looted / 118`), last updated |
| Toolbar | Filters: looted / unlooted / all; later layer toggles for slugs/artifacts |
| Canvas | Pan/zoom over 2×2 tile grid + marker overlays |
| Detail | `Popover` on marker: coords, open cost |

**Pan/zoom:** `react-zoom-pan-pinch` or similar — not React Flow.

**Icons:** `Desc_HardDrive_C` via `ItemIcon`; lucide fallback.

**i18n:** `exploration` namespace in `messages/en.json`.

---

## 5. Phased delivery

### Phase 1 — FRM pods on basemap (MVP)

- `getDropPod` slow poll, `drop_pod_state`, API + `/exploration` page.
- Four-tile basemap + markers for pods FRM returns.
- **DoD:** looted / opened / sealed styling; coords ÷ 100 in popover; projection tests; i18n; CI green.

### Phase 2 — Full catalog

- `exploration_catalog.json` (~118 sites), merge with FRM, ghost markers for unvisited.
- **DoD:** `looted / 118`; ≥ 95% FRM pods match catalog by id; guide in `docs/guide/exploration.md`.

### Phase 3 — Other collectibles

- `getArtifacts`, `getPowerSlug`, layer toggles, catalog slices.

### Phase 4 — Polish

- `getMapMarkers` player beacons.
- Optional link-out to SCIM (“open in interactive map”) — external only, not embedded tiles.

---

## 6. Open questions

1. **FRM hard-drive semantics (§1.1):** Resolve `getDropPod.Looted` vs `getCloudInv` vs M.A.M. analysis — observe before/after today’s session.
2. **Save vs FRM authority (§1.2):** **Decided** — save-parse primary for per-site flags (§1.1.1); FRM optional for depot count and between-autosave hints.
3. **Catalog licensing:** Confirm we can ship coordinate lists derived from wiki/community data (facts vs dataset packaging).
4. **Basemap redistribution:** Extract like planner icons; tiles in `assets/map/`. Legal review only if committing PNGs is blocked.
5. **Route name:** `/exploration` vs `/map` — prefer `/exploration`.
6. **Dashboard HD summary:** If we show “drives collected”, is `getCloudInv` enough or save-parse totals?
7. **Save-parse integration:** Subprocess `sat_sav_parse` (GPL) vs Go reimplementation — legal/engineering trade-off.
8. **Notifications:** `crash_site_looted` event? Defer unless requested.

---

## 7. Effort estimate (rough)

| Phase | Backend | Frontend | Assets/data |
| --- | --- | --- | --- |
| 1 — FRM + basemap | 1–2 days | 2–3 days | tiles done; projection JSON |
| 2 — Catalog | 1 day | 1 day | 1–2 days curating JSON |
| 3 — Slugs/artifacts | 1 day | 1 day | catalog extension |
| 4 — Polish | 0.5–1 day | 1 day | — |

Promote to roadmap as **M23** (or M14 backlog) after M22; update spec §3, §4.1, §7, §8 when scheduled.

---

## 8. Alternatives considered

| Approach | Verdict |
| --- | --- |
| **Four extracted tiles (§3.5)** | **Recommended** — matches game asset layout, no duplicate stitch file |
| **Stitch to single `map.png`** | Rejected — redundant ~17 MiB, no UX gain for v1 |
| **SCIM tiles / hotlink** | Rejected — license + IP + dependency |
| **Embed SCIM iframe** | External link only; no overlay control |
| **FRM-only, no catalog** | Cannot show unvisited sites or `looted / 118` |
| **Save parse (§1.2)** | **Recommended for authoritative per-site state** — SCIM model; reuse M22 download |
| **Game API `function: frm` proxy** | Rejected as primary — same data as FRM, more moving parts |
| **Parse `.sav` on every page load** | Rejected — too heavy; background job only |

**Recommendation:** **Static catalog** (positions) + **save parse** (opened/looted/dismantled on a slow job) + **FRM** optional for live deltas and depot counts + **four-tile basemap** in `assets/map/`.

---

## 9. Success criteria

1. Player opens `/exploration`, pans to an unlooted crash site, reads open requirements, copies coordinates for the in-game map.
2. `looted` count matches FRM (`Looted: true` rows) on the latest slow poll.
3. After phase 2, all ~118 catalog sites visible; unvisited sites shown as ghosts; progress reads `looted / 118`.
