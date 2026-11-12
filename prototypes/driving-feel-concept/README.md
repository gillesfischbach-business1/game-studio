<!-- PROTOTYPE - NOT FOR PRODUCTION -->
<!-- Question: Does grounded, weighty car physics stay drivable for a first-time player? -->
<!-- Date: 2026-11-07 -->

# Prototype: Driving Feel

## What this tests (the hypothesis)

> If the player drives a car with grounded, weight/inertia-based physics
> (not snappy arcade handling), it will feel heavy and real — **and** a
> complete first-time player will still complete a lap within 3 attempts,
> without crashing.

This is testing one specific tension from the game concept
(`design/gdd/game-concept.md`):

- **Pillar 4 — Grounded Drive, Weighty Consequence**: the car should feel
  heavy, with real inertia.
- **The Accessibility Floor**: a first-time player must be able to complete
  their first race without specialized skill.

Both gate reviews from the brainstorm (Technical Director: HIGH RISK,
Producer: UNREALISTIC on the original timeline) flagged this specific
question — "can the car feel heavy *and* stay easy to drive?" — as the
single biggest unproven assumption in the whole concept. This prototype
exists only to answer that, nothing else.

**Riskiest assumption being tested first:** that a tuning of mass, grip, and
steering exists where both halves of the hypothesis are true at once. If no
such tuning feels good, Pillar 4 itself needs to be revisited — that's a
valid and useful outcome of this test, not a failure of the prototype.

## What's deliberately NOT here

No menus, no AI opponents, no missions, no tuning shop, no damage model, no
real city geometry, no sound, no save system, no UI polish. Just a car, a
rough oval test track, a lap timer, and a reset key.

## How to run it (no coding needed)

**Step 1 — if you haven't already: create the Unity project**
1. Install Unity Hub, add the Unity **6.3 LTS** editor (see
   `docs/engine-reference/unity/VERSION.md` for the exact version).
2. In Unity Hub, create a new project using the **3D (Core)** template, at
   the root of this repository (the `game-studio` folder) — or anywhere
   convenient; you'll point it at this prototype folder next.

**Step 2 — bring in the prototype scripts**
1. In your Unity project's `Assets` folder, create a subfolder, e.g.
   `Assets/Prototype/`.
2. Copy all four `.cs` files from this folder
   (`prototypes/driving-feel-concept/`) into `Assets/Prototype/`:
   - `CarController.cs`
   - `ChaseCamera.cs`
   - `FinishLineTrigger.cs`
   - `PrototypeBootstrap.cs`
3. Unity will compile them automatically (you'll see a small spinner in the
   bottom-right corner, then it stops — that means it's done. A red error
   message in the Console window at the bottom means something went wrong;
   paste that error back to me and I'll fix it).

**Step 3 — set up the scene (one empty GameObject, nothing else)**
1. Open the default scene Unity created for you (or create a new empty
   scene: `File > New Scene > Basic (Built-in)`).
2. You can delete anything already in the scene (default cube, default
   light, default camera) — the script creates everything it needs itself.
3. Right-click in the Hierarchy panel → `Create Empty`. Rename it to
   `Bootstrap` (the name doesn't actually matter, but this is clearer).
4. With `Bootstrap` selected, in the Inspector panel click
   `Add Component` → type `PrototypeBootstrap` → select it.
5. Press the **Play** button (▶) at the top of the editor.

You should immediately see a red box (the car) on a dark gray track, on a
green "off-track" ground, with a HUD in the top-left corner showing speed,
attempt number, and lap times.

## Controls

| Key | Action |
|---|---|
| W / Up arrow | Accelerate |
| S / Down arrow | Brake / reverse |
| A/D or Left/Right arrows | Steer |
| R | Reset to the start line (also increments the attempt counter) |

## Tuning the feel (while the game is NOT running)

1. Press Stop (■) if the game is running.
2. In the Hierarchy, the car object is created fresh each time you press
   Play, so you can't select it while stopped. Instead: select the
   `Bootstrap` object, and in the Inspector, the `Car` field will be empty
   until you've pressed Play at least once — **or**, easier: just press
   Play, pause with the Pause button, select the `PrototypeCar` object in
   the Hierarchy, and edit the sliders on its `Car Controller` component
   live. Changes apply immediately, even while paused.
3. The single most important slider is **Lateral Grip** on
   `CarController` — it's the direct dial for the tension this prototype is
   testing. Start at 0.85. Lower it toward 0.5–0.6 for more "weighty slide",
   raise it toward 0.95–1.0 for more "glued to the road, easy".

## What to report back

After you've had a few attempts yourself (and ideally, if possible, watched
someone else try it with zero explanation beyond "W to go, A/D to steer, R
to reset" — don't coach them, just watch):

1. **Did you/they complete a lap within 3 attempts?** How many attempts did
   it actually take?
2. **One-line gut reaction**: does the car feel "heavy/real", "floaty/arcade",
   or "frustrating/uncontrollable"?
3. Which slider values did you end up changing, if any, and why?
4. Anything that broke, confused you, or felt obviously wrong (even if it
   seems unrelated to driving feel — e.g. camera, track, HUD).

Paste your answers back and I'll adjust the controller and we'll iterate —
2 to 4 rounds of this is normal for an Engine-path prototype, not a sign
something is broken.

## Browser preview (not a substitute for the real test)

`browser-preview.html` in this same folder is a lightweight 2D top-down
stand-in, hand-written in JS from the same formulas as `CarController.cs`,
so the tuning direction can be tried immediately with no Unity install —
exactly the kind of thing the Engine-path write-up above says a browser
can't validate reliably (timing/feel). Use it to get a rough first sense of
the grip/mass/steering tuning while Unity is being set up; treat the real
Unity build above as the only result this prototype's hypothesis can
actually be decided on.

## Status

**In progress.** Unity code written, not yet run or played by the user
(this cloud session cannot run the Unity Editor itself). The browser
preview has been built and can be tried immediately. Waiting on the first
playtest report from either.

## Findings

_(filled in once the prototype has been played and debriefed — see Phase 6
of the `/prototype` skill)_
