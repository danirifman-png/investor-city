# Architecture

## Stack and why

| Choice | Reason |
|---|---|
| **Three.js** (no engine) | Small, runs everywhere including low-end phones, full control over rendering cost. |
| **TypeScript + Vite** | Type safety for a codebase that will grow through eight phases; instant dev server; static build that can be hosted anywhere. |
| **Plain DOM + CSS for the HUD, no React (yet)** | The HUD and the character creator are small. A framework would add a second render loop next to the 3D loop. React can be introduced in a later phase for heavier screens (portfolio dashboard, shop) without touching the 3D code, because the HUD only talks to the game through callbacks and the event bus. |
| **Procedural, code-built 3D** instead of GLTF models | Phase 1 needs a whole city with many unique buildings. Building it from primitives keeps the download tiny (≈160 KB gzipped), loads instantly and lets content stay data-driven. Characters are procedural too (see phase 2 below). |
| **No other runtime libraries** | Only `three`. |

## Folder layout

```
src/
  main.ts                 boot: locale, font, game
  core/
    Game.ts               renderer, scene, main loop, modes (title / creator / playing)
    EventBus.ts           typed events (zone:changed, zone:discovered, poi:interact, game:saved…)
    Input.ts              keyboard + joystick state shared by player and camera
    Save.ts               versioned localStorage save with validation (v4)
    Social.ts             relationships, flags, errands and the conversation runner (pure logic)
    Mission.ts            rules of Marco's branch mission: steps, answers, risks, scoring (pure logic)
    Progression.ts        XP, levels, coins, bag, unlocked areas and the quest runner (pure logic)
  camera/
    CameraController.ts   follow camera (play) and free orbit camera (title), fly-to, occlusion
  character/
    CharacterModel.ts     builds a character from a CharacterLook (joint hierarchy)
    CharacterAnimator.ts  procedural idle / walk / run blend, wave and cheer
    PlayerController.ts   camera-relative movement, collision, stepping, gravity
    NpcModel.ts           the eight characters' bodies and clothing; Oliver's owl body
    Npcs.ts               characters in the world: placement, looking at the player, gestures
    Studio.ts             the creator's 3D preview stage
  content/
    cityPlan.ts           DATA: which district goes where, which lot types it has
    characterOptions.ts   DATA: hair styles, clothes, colours, accessories, nickname rules
    npcs.ts               DATA: the eight characters (look, home building, colour, relationship levels)
    errands.ts            DATA: one small errand per character and its goal
    dialogue/types.ts     the conversation data model
    dialogue/scripts.ts   DATA: the eight conversation graphs (structure only, no text)
    dialogue/branchMission.ts DATA: the mission's conversations, merged into the graphs
    missions/branch.ts    DATA: the mission's numbers, clues, questions, advisors, risks, options, reasons
    interiors.ts          DATA: walk-in rooms, their doors, hotspots and who works there
    concepts.ts           DATA: the concept ids of the notebook
    curiosities.ts        DATA: "Did you know?" spots in the city and in rooms
    quests.ts             DATA: quests (steps, goals, rewards), levels, XP for other actions
    items.ts              DATA: things that can be in the bag
    dialogue/mentorQuest.ts DATA: Oliver's challenge for the first quest
  world/
    cityLayout.ts         pure math: zones, blocks, roads, zone lookup (unit tested)
    CityBuilder.ts        builds streets, lots, landmarks, hit boxes
    Batcher.ts            merges static geometry into a few draw calls
    Frame.ts              local coordinate frame used by every building builder
    Materials.ts          shared materials, window textures, Hebrew sign textures
    props.ts              trees, lamps, benches, cars, turbines, smoke…
    landmarks/hubs.ts     stock exchange, news tower, fountain, academy park
    landmarks/districts.ts one builder per lot type (27 types)
    landmarks/decor.ts    market stalls, lanterns, bunting, signpost, balloons, countryside, river, waterfall trail and gate
    Crowd.ts              the walking crowd: one draw call, many looks, chatting with speech bubbles
    Ambient.ts            traffic, pedestrians, clouds (instanced)
    Atmosphere.ts         sky, sun, shadows, fog, day/night
    Collision.ts          box world for the player and camera (spatial hash)
    Style.ts              vivid / classic graphics: clouds, colour grade, bloom, surface detail
    Interiors.ts          walk-in rooms built away from the city, fading walls, doors, hotspots
    interiors/rooms.ts    pizzeria and bank furniture
    Markers.ts            floating icons: clue !, info i, discovery ?, door arrows
    Curiosities.ts        the "Did you know?" markers
  i18n/
    index.ts              t(key), locale + direction switching
    locales/he.json       every player-facing string
    locales/he.dialogue.json  every line of every conversation
    locales/he.learn.json every learning text: concepts, discoveries, clues, questions, outcomes, notebook UI
    locales/he.quests.json quests, items, rewards, settings, Oliver's challenge
  ui/
    Hud.ts                start screen, district badge/banner, labels, info card, minimap, map, help
    CharacterCreator.ts   creator panel (tabs, choices, swatches, nickname)
    DialogueView.ts       conversation sheet (typed text, answers, reputation feedback)
    PeoplePanel.ts        "people of the city" journal
    Notebook.ts           the notebook: mission workbook, concepts, discoveries
    InfoCard.ts           the card for clues, discoveries, info boards
    Progress.ts           player card (level, XP, coins), quest log, bag, settings, "Quest complete!"
    Joystick.ts           virtual thumbstick that drives the player
    styles.css            RTL-first styles, phone breakpoints, safe-area insets
tests/                    vitest unit tests
e2e/smoke.mjs             Playwright browser test (desktop + phone)
```

## Key decisions

**Data-driven city.** `content/cityPlan.ts` says which district sits where and which lot types
it contains. Builders are looked up by lot type. Moving a district or swapping a building is a
data change.

**Content separated from code.** Code never contains Hebrew; it asks `t('poi.bank.name')`.
Adding a language means adding `locales/<lang>.json` and registering it in `i18n/index.ts`
(direction is per-locale). A unit test fails if code references a key that is missing.

**Performance budget for phones.** All static geometry is merged per material (`Batcher`), so the
whole city is about 5 draw calls plus animated pieces. Traffic and pedestrians are
`InstancedMesh`es. The shadow camera follows the view and snaps to texels, so a 1024–2048
shadow map stays sharp. Phones get a lower pixel ratio, smaller shadow map and fewer pedestrians.

**Systems talk through events.** `Game` emits `zone:changed`, `poi:selected` and
`night:changed`. Later phases (player, NPCs, quests, market, news events) subscribe instead of
reaching into each other.

**Points of interest.** Every building registers a `Poi` with an id, locale key, district and an
invisible hit box. Labels, the info card, the minimap and the map all read from that list. NPCs and
quest triggers in later phases will attach to the same ids.

## Phase 2 decisions (character and controls)

**Procedural character instead of a GLTF model.** The character is built in code from simple
shapes on a joint hierarchy (hips, spine, head, shoulders, elbows, hips, knees), the same idea as
bones in a skinned model. This gives many combinations (7 hair styles, 3 tops, 3 bottoms, 3
builds, hats, glasses, backpack, 50+ colours) with zero downloads, matches the city's style, and
lets every option be plain data in `content/characterOptions.ts`. Animations are procedural
(sine-based gait whose stride follows the real speed, so feet do not slide); idle, walk and run
blend by speed, and one-shot gestures (wave, cheer) layer on top. If a later phase needs
artist-made characters, `CharacterModel` is the only file that has to change: the animator only
needs the joint names.

**Collision from the city's own geometry.** Every static piece the `Batcher` merges also
registers its world bounding box in a `CollisionWorld` (axis-aligned boxes with a bottom and a
top, in a 6 m spatial hash). There is no separate collision map to keep in sync with the art.
The player is a circle: boxes below 0.55 m are stepped onto (curbs, stairs, plazas), boxes above
head height are walked under (canopies, bridges), water always blocks. Thin decorations
(foliage, spheres, glowing signs) are skipped. The same world answers camera raycasts: when a
building gets between the camera and the player, the camera snaps in front of it and eases out
again afterwards.

**Two camera modes.** The free orbit camera from phase 1 now runs behind the title screen. In
play the camera follows the player: drag, Q/R or the buttons orbit it, the wheel or pinch zooms,
and movement is relative to the camera (forward always walks away from the viewer), which is the
convention kids know from other games.

**Save system.** `core/Save.ts` stores one JSON document under `investor-city.save` with a
`version` field. Loading always goes through `migrate()`, which validates and clamps every field
(a hand-edited or corrupted save can never break the game) and is where future versions will
upgrade old saves. It stores the character, position, night setting, discovered districts,
metres walked and play time. The game saves on manual save, every 10 seconds of play, on each
new discovery, and when the tab is hidden or closed. No personal data: the nickname is free text
limited to letters, digits and a few symbols, and nothing leaves the device.

**One input layer.** `core/Input.ts` merges keys and the joystick, so the player and the camera
never read the DOM directly. Keys are ignored while a text field has focus (typing a nickname
never moves anyone).

## Phase 3 decisions (characters and conversations)

**Conversations are data, text is content.** A conversation is a graph of nodes
(`content/dialogue/scripts.ts`): each node is a line, followed by the next line or by answers.
Nodes and answers carry conditions (`if`: a flag, a reputation range, an errand state, "met before")
and effects (`do`: reputation change, set a flag, start or finish an errand). The words are not in
the graph: node `n` of character `c` reads `dlg.c.n` and its answers `dlg.c.n.1…`, all in
`locales/he.dialogue.json`, so writers can rewrite every line without touching code. A unit test
fails if a line is missing, unused, unreachable, or if any conversation could get stuck.

**One small engine, fully tested without a browser.** `core/Social.ts` holds the relationship
state (met, reputation 0–100, talk count per character), story flags and errand states, and the
`Conversation` runner that walks a graph. It has no rendering, so the tests play every
character's conversations end to end: first meeting, rude answer then apology, errand, reminder,
hand-in, cross-character errands.

**Shared backbone, different personalities.** Every character follows the same shape (greeting →
backstory → a choice that reveals their personality → errand → "what did you learn?" → topic
menu) so kids learn how conversations work, while the content and reactions differ. The opening
line is picked by priority: first meeting → cold greeting after a rude answer (an apology comes
first) → errand ready → errand of another character routed through them (Leo's rumor is checked
with Marco, Maya's question goes to Nina) → reminder → warm greeting for friends → normal greeting.

**Reputation is visible and has consequences.** Answers are tagged by tone (kind, curious, smart,
rude, joke). The sheet shows "▲ Marco likes you more" / "▼ offended", four relationship levels
are shown as diamonds, and a rude answer changes the next greeting until the player apologises.
The player's own character reacts to their answer (nod, think, laugh, head shake).

**Errands are tiny on purpose.** Each character has one "go and see" errand (visit a place, ask
someone, meet people). Their goals are data (`content/errands.ts`) and are checked by the game.
The full story missions with calculations and consequences are phase 4, and will reuse the same
flags, errands and conversation engine.

**Characters reuse the player's rig.** People are built with the player's `CharacterModel` plus
grown-up clothing (chef hat, apron, blazer and tie, hard hat and safety vest, beard). Oliver has
his own owl body with the same joint names, so the same animator, gestures and moods drive
everyone. Static meshes are merged per joint and material (`compactRig`), which cuts each
character from about 60 to about 20 draw calls.

**Save v2.** The save gained a `social` section. `migrate()` upgrades phase 2 saves (adds a
fresh `social`) and cleans tampered data (unknown errand states, out-of-range reputation, odd
flags are dropped).

## Realistic look test (between phases 3 and 4)

- **Characters as GLB files, data-driven.** A character entry can name a model and baked clips (`avatar` in `src/content/npcs.ts`). `AvatarAnimator` exposes the same `play / playing / update` surface as the procedural animator, so `NpcActor` swaps bodies without other code knowing. The procedural body is the placeholder while loading and the fallback if loading fails.
- **Animations baked offline, shared across models.** `tools/retarget.mjs` transfers Mixamo-layout clips onto any skeleton with the same bone names by world-space rotation deltas, after straightening an A-pose rest into the source T-pose. Output is a small JSON of quaternion tracks, so the game ships no animation tooling. Gestures with no clip are procedural layers applied after the mixer, in the character's own axes, so they work whatever the bone orientations are.
- **Graphics switch.** `Style.ts` (first called `Realism.ts`) adds a physical (Rayleigh/Mie) sky that also lights the city through a prefiltered environment map, and world-space surface detail on the UV-less city materials. Picked at start-up (help panel or `?gfx=`), stored in `localStorage`; classic mode does not download models.
- Full pipeline, folder layout and model checklist: `docs/CHARACTERS.md`.

## Vivid style (before phase 4)

- **An original bright, toy-like look**, not a copy of any game: saturated palette, deep blue sky
  gradient, puffy low-poly cloud clusters, warm sun with soft shadows, a gentle colour grade
  (saturation, contrast, warm highlights and cool shadows, vignette) and light bloom on the high
  quality level. All of it is post-processing and materials; no new geometry for the city.
- The grade runs in display space with plain multipliers. An earlier version converted the
  tint through `THREE.Color` (sRGB to linear), which made whites beige.
- "Classic" stays available in the help panel; the choice is stored locally and reloads the game.

## Phase 4 decisions (mission, buildings, notebook)

- **Rules apart from presentation.** `core/Mission.ts` is pure functions over a small
  `BranchState` (status, clues, answers, risks, choice, reasons, stars). The notebook and the
  world only call them. That is what the 16 mission unit tests exercise, including a check that
  every answer follows from the numbers in the clues, and that the Hebrew texts quote them.
- **Numbers in one place.** `content/missions/branch.ts` holds every number of the story; the
  questions compute their answers from it, so changing the rent changes the right answer too
  (the texts must then be updated, and the test above catches a mismatch).
- **Conversations stay data.** The mission's lines are a separate graph fragment merged into the
  characters' scripts at load (`addMission`): openings after the "errand ready" ones, a topic
  before "goodbye", and Marco's invitation after his own errand reminder. Conditions gained
  `flags` / `notFlags`; effects set `learn.<concept>` flags, which the game turns into notebook
  concepts. No mission code knows about dialogue nodes, and vice versa.
- **Walk-in buildings without a second scene.** Rooms are dioramas built 600 m outside the city,
  in the same scene and collision world, so the player controller, camera, shadows and
  characters work unchanged. Entering fades to black, hides the city and the other characters,
  and moves the room's owner (Marco, Daniel) inside; leaving reverses it. Rooms have no
  ceiling and their walls fade when they stand between the camera and the player, so the
  follow camera needs no indoor mode; camera collision is switched off indoors. Saves made
  indoors store the spot in front of the door.
- **Prompt priority**: character, then door / hotspot / discovery, then building. One action
  key (or the on-screen button) for everything.
- **Kid-friendly answers.** Answers accept "2,000", "2000 ₪" or " 2000 "; text that is not a
  number is refused without costing a try; a wrong answer shows a hint; the second wrong one
  shows the worked solution, so nobody gets stuck. Payback accepts 11 to 12 months.
- **Scoring rewards reasoning, not one right answer.** The option sets a ceiling (a careful pilot
  or a second oven can reach three stars; three branches at once cannot), the reasons must
  support it (a rumour or an unrelated reason costs a star), and a careful risk check without
  false alarms earns one back. Every outcome tells what happened after six months and the lesson.
- **Save v3** adds `missions.branch` and `learning` (concepts, discoveries). `migrate()` fills
  them for v2 saves and drops unknown ids; a "done" mission without a decision is reopened.

## Playable prototype decisions (quests, progression, world)

- **One quest system, data first.** A quest is a list of steps in `content/quests.ts`; each step
  has one goal the game can check every moment: be near places (any order), be near a
  character, or a story flag. Conversations set flags, so the dialogue system and the quest
  system stay independent; a step can also set a flag (`mentor.ready`) that a conversation
  waits for. Quests start by themselves when the quests they require are done.
- **Progression is pure logic** (`core/Progression.ts`): `advance()` takes a small "world"
  interface (flags, nearby places and characters) and returns events (started, step, complete).
  The game only shows them. The whole first quest is unit-tested without a browser.
- **Everything earns a little.** Errands, Marco's mission (by stars), discoveries and concepts
  add XP and coins, so the level bar moves during the existing content too. Coins are an
  in-game score only; the bag says so.
- **Unlockable areas** are extra walkable rectangles: the player stays inside the city bounds or
  any unlocked area. The waterfall trail has a gate whose red bars disappear when it opens.
- **The tracker follows what the player started last** (a just-accepted errand beats the quest),
  falling back to quest, mission, errand. A ready errand always wins.
- **Settings** live in the save (night, street speech bubbles, fewer animations, camera turn
  speed); graphics quality stays a URL switch because it is chosen before the city is built.
- **Save v4** adds `growth` (XP, coins, items, unlocked areas, quests) and new settings fields;
  older saves start with empty progression.

### Working vs placeholder

| Working (tested) | Placeholder / not yet |
| --- | --- |
| Two quests, quest log, tracker, XP/levels, coins, bag, settings, "Quest complete!" | Coins cannot be spent yet (no shop) |
| Oliver's money challenge with retry and first-try bonus | Only two data quests so far |
| Waterfall trail gate that opens, walkable trail, waterfall | Countryside outside the trail is scenery only |
| Crowd with speech bubbles, market, balloons, river, cliffs | Characters are procedural until Meshy models arrive |

## Open world, phases A and B (Meshy art, streaming, river, first minigame)

- **Meshy characters** (`public/models/meshy/*.glb`): the player hero (`character/hero.ts`,
  `kid_v2.glb`) and all eight NPCs use rigged Meshy models with embedded `idle`/`walk` clips.
  `NpcAvatar.scale` scales a model; heights are measured in the posed shape
  (`Box3.setFromObject(scene, true)`), because the raw skinned geometry sits under a 0.01
  armature scale.
- **Model streaming** (`world/ModelLayer.ts`): builders call `frame.model(key, placement)`.
  Collision boxes are registered immediately from `MODEL_SIZES`; the GLB files load per
  60 m area when the player comes within 150 m and are drawn within 170 m. This is the base
  for the larger world: what is far away costs no download and no draw calls.
- **Crowd culling** (`world/Crowd.ts`): only people within 80 m of the player are drawn
  (their per-instance data is packed to the front of the instanced buffers each frame).
- **Food district** (`world/landmarks/districts.ts`): pizzeria, burger bar, market hall with
  stalls, mall, cafe, bakery and supermarket are Meshy buildings with Hebrew signs added in
  game; door positions still match the interiors.
- **River** (`world/landmarks/river.ts`): wraps the city on the south and east with six
  stone bridges. The water is solid; each bridge has stairs and an invisible walkway that
  follows the arch. The walkable bounds now include the far banks. `tests/river.test.ts`
  walks across every bridge and checks the water can't be waded.
- **"A day at Marco's"** (`core/PizzaShop.ts` rules, `ui/PizzaShopView.ts` panel): a
  three-shift business minigame at the star marker inside the pizzeria. Three levels
  (explorer, adventurer, pro; age is only a recommendation). Teaches revenue, costs, profit,
  demand and inventory. Coins earned are a share of in-game profit, never negative; the
  best stars per level are saved in `missions.pizzaShop`.

| Working (tested) | Placeholder / not yet |
| --- | --- |
| Meshy hero and 8 NPC models, idle/walk | Gesture clips (nod, wave) are procedural layers |
| Food district buildings from Meshy, streamed by area | Other six districts still use code-built buildings |
| River, 6 bridges, far banks walkable | Far banks have scenery only; the port comes later |
| Pizzeria minigame, 3 levels, saved best stars | Coins still cannot be spent (no shop) |

## Fun pass (movement, collecting, my business, city events)

Added after play feedback that the world felt bland. Each piece gives a reason to move around or come back, without timers, streaks or paid shortcuts.

- **Movement.** `PlayerController` has a jump (Space when nothing to use is near, a button on touch), a kick scooter (F or the HUD button; Meshy `props/scooter.glb` with a primitive fallback) and `bouncers` for trampolines. The plaza's west lawn has a trampoline (`TRAMPOLINE`: you must jump on, it launches at 15 m/s, 18% higher with a timed jump) and a skate ramp built as 12 thin collision steps (`landmarks/plaza.ts`, `playground`).
- **Collecting.** `world/Collectibles.ts`: exactly 100 gold coins (Meshy `coin.glb`, drawn as one InstancedMesh) on street trails, bridges, banks, the playground (one needs the timed bounce) and 5 chests that swap to the open `chest_open_glow.glb` with a light. The save keeps only the found ids.
- **My business.** Rules in `core/Business.ts` (pure, tested): four stages, stand → cart → juice shop → juice bar, each with more customers and capacity but a higher daily fixed cost. A day = forecast (sure at the stand, 80% / 70% later) + city event + the player's cups and price. Profit goes to the business till; the player chooses to invest it in the next stage or take it home (their coins). `paybackDays` shows how long an upgrade takes to earn back. `world/BusinessSite.ts` draws the current stage on the east lawn (back edge fixed, so it visibly grows toward the path; collision block resized in place), a name board and a ★ marker; `ui/BusinessView.ts` is the panel. Saved in `missions.business`.
- **City events.** `cityEventFor(dayKey)` picks one of 7 events from the calendar date, the same for every player. It multiplies plaza demand for the business, is announced once a day as a toast, and shows in the plaza (`world/CityEventDecor.ts`: flags on busy days, cones on a roadworks day).

## Realism pass (rooms, outdoor world, buildings)

Added after feedback asking for a more realistic look everywhere.

- **Rooms.** Each walk-in room has a finish in `world/interiors/finish.ts` (`FINISHES`): canvas-painted floor, wall and wainscot textures with bump maps (planks, parquet, marble, tiles, carpet, concrete, brick, panels, acoustic, plaster), skirting, chair rail and cornice strips, windows and real light fittings. Furniture is Meshy PBR props (`public/models/meshy/props/`, sizes in `MODEL_SIZES`).
- **Cloud Land.** `world/interiors/skyLand.ts` is an open "room" reached through portals (`world/Portal.ts`): one in the playground (`CITY_PORTAL`) and one in the startup hub. Savings steps grow 10% each (`stepSavings`), 18 coins, a chest and a trampoline. It is the eighth entry in `content/interiors.ts`.
- **Rider gear.** `character/riderGear.ts` puts the hero's hands on the scooter grips with two-bone IK and a helmet on the head while riding.
- **Outdoor.** `Style.ts` paints the ground (running-bond paving, lawn, asphalt with grit) by vertex colour; the vivid palette is calmer. `world/Trees.ts` replaces the batched trees with Meshy trees (plane, olive, cypress, palm) drawn as one `InstancedMesh` per model part once loaded; the batched trees stay as the fallback. `ParkedCars` parks Meshy cars along both kerbs of the major roads (collision is added at build time). NPCs stand on the collision ground (`Npcs.ground`).
- **Buildings.** `world/facadeTextures.ts` paints the facade (stone surrounds, sills, string courses, roller shutters, curtains, iron balconies, air conditioners), the curtain wall of the towers and clay roof tiles, each with a normal map and a surface texture (red: how much the building colour tints the pixel, green: roughness, blue: metalness). `maskVertexColour` keeps glass and frames untinted. `Batcher.facade` adds a cornice and coping; `Batcher.gable` builds two tiled slopes with UVs in metres and plain gable ends.

## What later phases plug into

- More missions follow the same pattern: a data file for numbers and options, a graph fragment
  for the conversations, hotspots in a room, and a section in the notebook.
- New rooms: an entry in `content/interiors.ts` and a furniture builder in `world/interiors/`.
- Later phases: progress fields are added to the save schema with a version bump and a step
  in `migrate()`.
- Phase 5–6 (market, news): the exchange ticker and news-tower screens are already
  canvas textures and will be fed by the simulation instead of fixed text.
