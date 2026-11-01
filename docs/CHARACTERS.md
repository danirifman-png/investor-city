# Character pipeline

How 3D character models get into Investor City, and how to add more.

## Overview

- Engine: three.js in the browser (no Unity/Unreal), so characters are **GLB** files (binary glTF with embedded textures and skeleton).
- Every character is **data**: one entry in `src/content/npcs.ts`. The code (`NpcActor`, `AvatarAnimator`) is shared, so a new character never needs new code.
- Animations are **shared**: one set of clips in the Mixamo skeleton layout is baked onto each model's own skeleton by `tools/retarget.mjs`. Gestures the clips do not cover (wave, think, talk, laugh, surprised, cheer) are procedural layers in `src/character/AvatarNpc.ts`, and the mouth moves with the face blend shapes `mouthOpen` / `mouthSmile` when the model has them.
- **Fallback**: every character also has the procedural body it had before. It is shown while the GLB loads, and stays if the file is missing or broken, so conversations and missions always work.
- **Graphics switch**: Help panel → "גרפיקה" (or `?gfx=classic` / `?gfx=realistic` in the URL). Classic never downloads the models.

## Folder structure

```
public/models/              shipped with the game, loaded at run time
  <id>.glb                  the character model (one per character)
  <id>-anims.json           its baked animation clips
  CREDITS.md                source + licence of every file (required)
tools/
  prep-avatar.mjs           cleans a GLB: drops unwanted meshes, shrinks textures to 512 px webp
  retarget.mjs              bakes Mixamo-layout clips onto a model's skeleton
  check-model.mjs           the model checklist, automated
src/content/npcs.ts         character definitions (the `avatar` field points at the files)
src/character/AvatarNpc.ts  loading, wardrobe tweaks, animation and gestures
src/character/Npcs.ts       placing characters, swapping fallback ↔ model
```

## Character definition example

```ts
marco: {
  id: 'marco',
  gender: 'm',
  body: 'person',
  look: person({ ... }),            // fallback body (also used in classic graphics)
  extras: ['chefHat', 'apron', 'mustache'],
  scale: 1.14,
  color: '#f08a4b',                 // name tag, journal and portrait colour
  home: 'pizzeria',                 // which building they stand in front of
  offset: 0,
  avatar: {
    model: 'models/marco.glb',
    anims: 'models/marco-anims.json',
    height: 2.0,                    // top of head incl. hat, for name tag and camera
    topColor: '#f3f1ec',            // optional wardrobe tweak
    chefHat: true,                  // optional accessory
  },
},
```

Name, role, biography and every dialogue line live in `src/i18n/locales/he.json` and `he.dialogue.json` under the same id, and the conversation graph in `src/content/dialogue/scripts.ts`.

## Adding a character model, step by step

1. **Create the model** (Meshy, Blender, or a bought asset). Ask for:
   - a full-body humanoid in **T-pose or A-pose**, standing, facing forward, arms away from the body;
   - the **same reference image and proportions** for every character, so the cast looks like one family (change only clothes, hair, colours and accessories);
   - rigged with a **Mixamo-style skeleton** if the tool offers it. If not, upload the model to Mixamo once to rig it (auto-rigger), and download as FBX, then convert to GLB in Blender (File → Export → glTF Binary, "Apply Modifiers", textures embedded);
   - roughly 10–30k triangles and 1024 px textures at most.
2. **Clean it**: `node tools/prep-avatar.mjs in.glb public/models/<id>.glb [mesh names to drop]`
   (needs `@gltf-transform/core`, `@gltf-transform/functions`, `@gltf-transform/extensions` and `sharp` on `NODE_PATH`; dev tooling only, not a game dependency).
3. **Check it**: `node tools/check-model.mjs public/models/<id>.glb`. Fix every FAIL (see the checklist below).
4. **Bake the animations**: `node tools/retarget.mjs <clips.glb> public/models/<id>.glb public/models/<id>-anims.json idle walk agree=nod headShake=shake sad_pose=sad`
   The clip source can be any GLB with Mixamo animations; the test used `Xbot.glb` from the three.js examples. The script prints the arm directions of both rest poses; they must match after its automatic A-pose → T-pose fix.
5. **Point the character at it**: add the `avatar` field to its entry in `src/content/npcs.ts`.
6. **Credit it**: add a row to `public/models/CREDITS.md` with the source and licence.
7. **Test**: `npm test`, `npm run build`, `npm run test:e2e`, then look at the character in the game (idle, walking, a conversation, every mood).

## Model checklist

Automated by `tools/check-model.mjs`:

| Check | Requirement |
|---|---|
| Format | binary `.glb`, textures embedded |
| Scale | 1.3–2.3 m tall, Y up |
| Origin | at the feet, centred under the body |
| Orientation | facing +Z |
| Geometry | at most 40k triangles |
| Materials | present; textures at most 1024 px (prep shrinks to 512) |
| File size | at most 3 MB |
| Skeleton | has a skin with the 20 key Mixamo bones (`Hips`, `Spine`…`Head`, arms, hands, legs, feet; with or without `mixamorig:`) |

By eye, in the game:

- no stretched skin or broken joints in idle, walk, nod, shake, wave, think and talk;
- feet on the ground and not sliding while walking;
- face blend shapes (if any) move the mouth when the character speaks;
- looks right next to the player and the other characters (same style and proportions).

Not automatable, always required:

- **Commercial licence**. Meshy's free plan, for example, publishes models under CC BY 4.0 (credit required); paid plans give private ownership. Mixamo animations are royalty-free inside a project. Record it in `CREDITS.md`.

## Performance notes

- Models load **after** the city is playable and never block the game; classic graphics skip them entirely.
- Each skinned model costs about 8–10 draw calls. With dozens of characters, the next steps are: share one base model and its textures between characters (clone with `SkeletonUtils.clone`), load models only for characters within ~60 m, and update animation mixers for distant characters at a lower rate.
- Instancing does not apply to independently animated characters; it is already used for the static city.

## Known limits of the current test

- Only Marco uses a model, and it is a semi-realistic stand-in that is **not cleared for release** (see `CREDITS.md`).
- The baked clips cover idle, walk, nod, head shake and sad. Wave, think, talk, laugh, surprised and cheer are procedural, so they are simpler than motion capture.
- The player character is still the procedural model.
