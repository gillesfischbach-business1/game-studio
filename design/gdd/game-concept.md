# Game Concept: Underground Lëtzebuerg

*Created: 2026-11-07*
*Status: Draft*

---

## Elevator Pitch

> It's an open-world street-racing/action game where you rise from a nameless street racer to a
> tuning-scene legend in a stylized-but-recognizable recreation of Luxembourg City, 2005 — racing,
> stealing cars, buying houses, and crossing paths with real Luxembourgish historical figures along
> the way.
>
> Test: a stranger hears "NFS Underground 2 meets GTA San Andreas, set in a real city that lived
> its own history" and understands what they'd be doing in 10 seconds. Passes.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | Open-World Action-Racing (street-racing core + open-world action-adventure structure) |
| **Platform** | PC |
| **Target Audience** | See Target Player Profile below |
| **Player Count** | Single-player |
| **Session Length** | 30–120 min |
| **Monetization** | Not yet decided — personal/passion project by default; revisit before any public release |
| **Estimated Scope** | Large (9–12+ months, team of 1 + AI-driven implementation) for the First Playable milestone (Tier 1). True full vision (Tier 2) is an explicit, unestimated north star — see Scope Tiers. |
| **Comparable Titles** | Need for Speed Underground 2, GTA: San Andreas |

---

## Core Fantasy

You rise from a nameless street racer to a tuning-scene legend of your own (lovingly, originally
rebuilt) hometown — and as your own story climbs, it tangles with the lived history of Luxembourg
City itself, told through real, named historical figures who appear as people in your world rather
than museum plaques.

What you can do here that you can't do anywhere else: drive, steal, tune and build a reputation in
a real, recognizable city — while a one-eyed medieval king, a Grand Duchess, and a river legend
have opinions about what you're doing with it.

---

## Unique Hook

Like GTA San Andreas' open city and NFS Underground 2's tuning culture — and also, the city is a
recognizable Luxembourg City of 2005, and its history is still walking around in it, by name.

"And also" test: GTA SA and NFS U2 are both well-worn genre templates. The novel part is that the
setting isn't fictional (Los Santos, Olympic City) — it's a real, specific place, at a real,
specific moment, inhabited by real historical figures under their own names. That changes what
exploration and discovery feel like: you're not just finding loot, you're recognizing a street
corner, a bridge, a legend you already half-know.

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics (What the player FEELS)

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Sensation** (sensory pleasure) | 6 | "Postcards from 2005" visual direction — real silhouette, warm rounded exaggeration; period-appropriate 2005 car-culture soundtrack |
| **Fantasy** (make-believe, role-playing) | 4 | Nobody-to-legend street-racer roleplay; black-market car-theft underworld fantasy |
| **Narrative** (drama, story arc) | 5 | The "Chronicle" thread — named historical NPCs woven into a short main story arc |
| **Challenge** (obstacle course, mastery) | 1 | Grounded, weighty driving; race types (circuit/sprint/chase); rival ladder tied to progressive unlocks |
| **Fellowship** (social connection) | N/A | Single-player; no co-op or social systems planned |
| **Discovery** (exploration, secrets) | 2 | Real-referenced city geography (OSM-generated districts), easter eggs, historical-figure encounters |
| **Expression** (self-expression, creativity) | 3 | Tuning shop (visual + performance), car collection, safehouse personalization ("Make It Yours" pillar) |
| **Submission** (relaxation, comfort zone) | N/A | Not a core goal; incidental low-stress moments during free exploration are a side effect, not a design target |

### Key Dynamics (Emergent player behaviors)

- Players will replay favorite streets/routes once unlocked, the way they'd revisit a real
  neighborhood.
- Players will seek out named historical NPCs and easter eggs deliberately, treating them like
  landmarks to "collect" rather than loot.
- Players will optimize different tuning builds per activity (drift vs. sprint vs. chase).
- Players will detour mid-mission just to look at a recreated landmark — this is a feature, not a
  failure of mission pacing (protected by the Freedom Over Funnel pillar).

### Core Mechanics (Systems we build)

1. Grounded, weighty vehicle physics with a stylized damage/decal system (dents; light blood
   decals at Tier 1, deferred at MVP)
2. GTA-SA-style progressive mission/unlock system — missions gate *activities*, never *geography*
3. Tuning & customization system (visual + performance stats) — "Make It Yours"
4. Car-theft tool & black-market vendor system, centered on the Aldringen bus station
5. Named historical-figure NPC and narrative system (the "Chronicle" thread)

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** (freedom, meaningful choice) | The world is always fully traversable; progression unlocks activities, never locks out geography (Freedom Over Funnel) | Core |
| **Competence** (mastery, skill growth) | Grounded driving mastery, race-type specialization, tuning optimization | Core |
| **Relatedness** (connection, belonging) | Relationships with named historical-figure mentors/narrators; real-place nostalgia connects the player to the city itself | Supporting |

### Player Type Appeal (Bartle Taxonomy)

- [x] **Achievers** (goal completion, collection, progression) — How: car collection, house
      ownership, district-activity unlocks, reputation growth
- [x] **Explorers** (discovery, understanding systems, finding secrets) — How: real-city
      recreation, easter eggs, historical-NPC encounters
- [ ] **Socializers** (relationships, cooperation, community) — Minimal: single-player; any social
      pull is external (shared nostalgia, not an in-game system)
- [x] **Killers/Competitors** (domination, PvP, leaderboards) — Secondary: street races, rivals,
      time-trial/drift scores

### Flow State Design

- **Onboarding curve**: the first mission teaches driving and the theft tool together, inside the
  Gare district (also where the black-market vendor lives).
- **Difficulty scaling**: rival race difficulty and mission complexity scale with which districts
  and upgrades are unlocked.
- **Feedback clarity**: visible speed/drift UI, explicit tuning-stat deltas, clear unlock
  notifications.
- **Recovery from failure**: instant restart on a failed race/mission; no permanent loss beyond a
  small in-game cash cost. Failure is a retry, not a setback (protects the Accessibility Floor —
  see Game Pillars).

---

## Core Loop

### Moment-to-Moment (30 seconds)
Grounded, weighty driving and drifting through real-referenced streets. Satisfying through
momentum/grip feedback and the challenge of reading a real (if stylized) street layout — tight
Old Town turns feel different from open Gare boulevards.

### Short-Term (5-15 minutes)
Spot a mission/race marker or a theft opportunity → chase it → win or complete it → immediate
reward (cash, an unlock, a story beat, a new tuning option).

### Session-Level (30-120 minutes)
Leave the safehouse, take on 1-2 missions (race, chase, delivery, theft), explore for easter eggs
or a historical-NPC encounter, stop by the tuning shop. Natural stopping point: finishing a
mission or a Chronicle story beat.

### Long-Term Progression
Unlock each district's activities, grow the car collection and reputation, buy more houses,
advance the Chronicle story arc toward becoming the city's racing legend.

### Retention Hooks
- **Curiosity**: the next historical-NPC encounter; an unexplored corner of a district.
- **Investment**: the car collection, tuned builds, owned houses.
- **Social**: none in-game; incidental (shared local nostalgia outside the game).
- **Mastery**: the rival ladder, drift/time-trial scores.

---

## Game Pillars

Priority order below resolves conflicts between pillars — higher-numbered pillars yield to
lower-numbered ones when they genuinely clash.

### Pillar 1: Freedom Over Funnel
The open world is always fully traversable. Missions and story gate *activities*, never
*geography*.

*Design test*: Debating whether a district should be locked behind a mission vs. always reachable
on foot/by car, this pillar says we choose **always reachable** — the mission can lock what you
can *do* there, never whether you can *go* there. This is also the clearest mechanical difference
from GTA San Andreas, which does lock its islands.

### Pillar 2: Luxembourg's Chronicle Lives Here
Real Luxembourgish historical figures appear under their own real names as NPCs — mentors,
narrators, quest-givers — never as fictionalized archetypes and never as criminals or perpetrators
in the game's illegal-racing/car-theft plot.

*Design test*: Debating a generic mentor character vs. a real, named historical figure (e.g. Jang
de Blannen) for a mentor role, this pillar says we choose the **real, named figure**. Debating
whether a historical figure can be written as a rival gang boss or theft-ring leader, this pillar
says **no** — they stay mentors, narrators, or background figures.

### Pillar 3: Authentic Place, Playful Heart
Luxembourg City 2005 is recognizably real, filtered through a warm, slightly exaggerated, charming
visual lens (the "Postcards from 2005" visual anchor). When tone conflicts with another pillar,
this one wins on *how something looks and feels*, not on *what mechanically happens*.

*Design test*: Debating photorealistic damage gore vs. warm, stylized damage decals for an injured
pedestrian or dented car, this pillar says we choose the **stylized** depiction — the mechanical
weight of Pillar 4 stays, the visual treatment stays warm and non-graphic.

### Pillar 4: Grounded Drive, Weighty Consequence
Vehicles feel heavy and inertia-driven; damage (dents, light blood decals at Tier 1) carries
visible, felt weight. This never overrides the Accessibility Floor below.

*Design test*: Debating snappy arcade handling vs. inertia-based handling for a new vehicle class,
this pillar says we choose **grounded weight** — within the floor below.

**Accessibility Floor (non-negotiable)**: a first-time player must be able to complete their first
race or chase without specialized skill. Grounded weight (Pillar 4) and varied, fast-to-grasp
activities (the dynamics above) never go so far that they break this floor — if a conflict between
"feels heavy and real" and "a new player can succeed" ever comes up, the floor wins.

### Pillar 5: Make It Yours
Car tuning and self-expression are always present and meaningfully deep — this is NFS Underground
2's beating heart, and it is never cut to make room for other systems.

*Design test*: Debating cutting tuning depth to save scope vs. keeping a smaller-but-present
tuning system, this pillar says we choose **keep it present**, even shallow, never cut to zero.

### Anti-Pillars (What This Game Is NOT)

- **NOT grindy**: we will not require repetitive grinding to progress — it would compromise
  Pillar 5's "intuitive, always-rewarding" expression loop and the Accessibility Floor.
- **NOT artificially gated**: we will not lock geography behind missions — it would compromise
  Pillar 1 directly.
- **NOT a platform for disrespectful history**: we will not depict living persons or current
  politicians as NPCs, and historical figures are never cast as criminals or perpetrators in the
  game's plot — it would compromise Pillar 2's respectful, generous tone.
- **NOT a punishing simulation**: we will not tune the driving model so heavy or realistic that it
  becomes punishing — it would break the Accessibility Floor paired with Pillar 4.

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| Need for Speed Underground 2 | Tuning culture, street-racing core loop, deep car customization | A real, specific setting instead of a fictional city; tuning sits inside a living Chronicle narrative, not just circuit progression | Validates that tuning-driven mastery alone can carry a full game |
| GTA: San Andreas | Open-world freedom, progressive activity-unlock structure, buyable safehouses | Geography is never gated, only activities; real historical figures replace the fictional gang hierarchy | Validates that mission-gated-activity design scales to an open city |
| Super Mario / Angry Birds | Charm, exaggerated-but-readable shapes, approachable physics-comedy | Applied to vehicle damage and world silhouette, not to the core verb — driving stays grounded, never bouncy-platformer | Validates that "charming" and "authentic place" can coexist through silhouette and color rather than changing the core verb |

**Non-game inspirations**: Personal/family nostalgia for Luxembourg City around 2005; Luxembourgish
local legends and national history (the Mélusine legend, Jang de Blannen/John the Blind, the
Sigefroid founding myth); OpenStreetMap data used almost like a field survey for world-building.

---

## Target Player Profile

| Attribute | Detail |
| ---- | ---- |
| **Age range** | 18–35 (people who were teens/young adults around 2005, nostalgic for that car-culture era) plus anyone drawn to real-place open-world games |
| **Gaming experience** | Casual to mid-core |
| **Time availability** | 30–90 minute sessions, evenings and weekends |
| **Platform preference** | PC |
| **Current games they play** | NFS titles, GTA titles, other open-world/arcade racers, "real-place recreation" indie games |
| **What they're looking for** | A personal, nostalgic connection to a real place, delivered through familiar, proven open-world/racing mechanics |
| **What would turn them away** | Expecting full simulation-grade racing (this is grounded-but-accessible, not a sim); expecting a dark/violent GTA-style crime tone (this game is deliberately warmer and more respectful, especially toward historical figures) |

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Recommended Engine** | Not yet decided — deferred to `/setup-engine`. Key input from the TD-FEASIBILITY gate review: prioritize an engine whose project files are AI-editable (text-based scenes/code), since the team has no human programmer. This weighs toward **Godot or Unity over Unreal** (Unreal's Blueprints are stored in a binary format that cannot be read or edited by an AI session). Unity has the larger built-in supply of vehicle/traffic/road assets; Godot is fully open and text-based but has thinner built-in open-world/vehicle tooling (expect a custom raycast vehicle controller). |
| **Key Technical Challenges** | Generating a stylized-but-recognizable city from OpenStreetMap street/building-footprint data; tuning vehicle physics to be "grounded but not punishing" through human playtesting (not automatable); combining lane-path traffic, scripted pedestrians, and a stylized damage/decal system without full-simulation overhead; unknown GPU budget — must be measured and used to set draw-call/LOD targets before committing to district fidelity. |
| **Art Style** | 3D stylized — "Postcards from 2005" (real silhouette, warm rounded exaggeration; see Visual Identity Anchor below) |
| **Art Pipeline Complexity** | High (custom 3D, real-world-referenced districts) — mitigated by procedural OSM-based base geometry plus hand-finished landmarks; unproven at this scope and flagged as a technical risk below |
| **Audio Needs** | Moderate to high — period-appropriate 2005 car-culture soundtrack, ambient city sound, ideally voiced historical NPCs (TBD with audio-director) |
| **Networking** | None — single-player |
| **Content Volume** | First Playable (Tier 1) target: 3–4 real districts, 2–3 fictional car-dealer brands, 3–4 named historical NPCs, several easter eggs, 2–3 buyable houses, one active train line (themed fast-travel); estimated 6–10 hours of core content |
| **Procedural Systems** | Procedural base-geometry generation from OpenStreetMap street/building-footprint data, used once at authoring time (not at runtime); the world is otherwise fixed once built, with landmarks hand-finished on top |

### Visual Identity Anchor: "Postcards from 2005"

Chosen from the AD-CONCEPT-VISUAL gate review (verdict: STRONG).

- **Visual rule**: Every street is a postcard of itself — real silhouette, warm rounded
  exaggeration, one charming overstatement per landmark.
- **Supporting principle 1 — Shape language**: the real street grid and building massing stay
  faithful; landmarks get softened, slightly oversized forms (Adolphe Bridge's arch, the Bock
  casemates, the Gëlle Fra monument). Design test: when a landmark's real proportions and its
  "charming overstatement" conflict, exaggerate the single most recognizable feature and leave the
  rest faithful.
- **Supporting principle 2 — Color means something**: base palette is Luxembourg sandstone ochre,
  slate-blue roofs, and Pétrusse valley greens; saturated color is reserved for meaning (activity
  markers, tuning/underglow identity). Design test: if a new UI or world element needs a color and
  isn't one of those two categories, it stays in the base palette.
- **Colour philosophy**: damage reads as bare metal and primer against the warm palette, keeping
  Pillar 4's weight legible without breaking Pillar 3's charm.

---

## Risks and Open Questions

### Design Risks
- Balancing "charm" tone with "weighty consequence" damage could read as tonally inconsistent if
  not carefully art-directed — the stylized-not-graphic resolution (Pillar 3 vs. Pillar 4) needs
  validation once real art exists, not just on paper.
- Respectful treatment of real historical figures as NPCs could misfire in either direction
  (overly reverent reads as boring; overly playful reads as disrespectful) — needs early input
  from narrative-director and world-builder.

### Technical Risks
*(from the TD-FEASIBILITY gate review — verdict: HIGH RISK on the original Tier 1 scope/timeline)*
- No team member can hand-model a recognizable multi-district real city. Mitigation: procedural
  OSM-based base geometry plus hand-finished landmarks — unproven at this scope, needs prototyping.
- Combining open-world streaming, traffic, pedestrians, and a damage system raises integration
  risk even at a reduced scale.
- Driving feel can only be validated by human playtesting, not automated tests — requires many
  short iteration rounds with the user, with every handling value exposed as tunable data.
- Engine choice is constrained by AI-editability (text-based project files), which narrows the
  realistic candidates to Godot or Unity.
- GPU/performance budget is currently unknown and must be established before committing to
  district count or visual fidelity.

### Market Risks
- Appeal leans heavily on nostalgia and local knowledge specific to Luxembourg City; broad
  commercial audience reach is uncertain. Acceptable if this stays primarily a personal/passion
  project — revisit if a commercial release becomes a goal.

### Scope Risks
*(from the PR-SCOPE gate review — verdict: UNREALISTIC for the original Tier 1 scope within
"several months")*
- The user was shown this verdict and a concrete trimmed alternative, and explicitly chose to
  **keep the full Tier 1 scope and extend the timeline to 9–12+ months** instead of cutting
  content. This is a recorded, conscious trade-off, not an oversight.
- The producer's flagged failure mode still applies at the extended timeline: several
  half-finished districts/systems if velocity is overestimated. Mitigation: build and finish one
  district completely before starting the next — district count is the scaling step, never
  parallel unfinished work.
- The user has zero programming experience and cannot independently verify generated code.
  Automated tests (per this repo's verification-driven development standard) are the primary
  safety net against silent regressions over a 9–12+ month AI-driven build.

### Open Questions
- What is the actual available GPU/hardware spec? Needed before setting draw-call/LOD/fidelity
  budgets. → Resolve during `/setup-engine` or a dedicated hardware check.
- Is this a personal/passion project or intended for eventual public/commercial release? Affects
  monetization and how much the market risk above matters. → Ask directly before any
  `/release-checklist` work.
- Exactly how graphic should the Tier-1 "light blood decal" damage read, given the Pillar 3 vs.
  Pillar 4 tension? → Resolve in `/art-bible` with concrete reference art.
- Exactly which named historical figures appear, and in which roles? → Resolve with
  narrative-director during `/design-system` for the Chronicle/NPC system.

---

## MVP Definition

**Core hypothesis**: Players find grounded, weighty street-racing through a recognizable
real-world district — combined with GTA-SA-style progressive unlocks and a named-historical-figure
narrative thread — engaging for 30+ minute sessions.

**Required for MVP (Tier 0)**:
1. One real district (Gare, including the Aldringen bus station) built as a drivable, explorable
   space
2. Grounded vehicle physics with dent-only damage
3. One car dealer (2–4 vehicles) and a basic tuning shop (visual + a few performance stats)
4. Car-theft tool, unlocked via the Aldringen black-market vendor
5. One named historical-figure NPC (e.g., Jang de Blannen) in a mentor/narrator role
6. 3–5 story missions demonstrating progressive activity-unlocks (Freedom Over Funnel in
   miniature)
7. One buyable safehouse

**Explicitly NOT in MVP** (deferred to Tier 1 or later):
- Additional districts beyond the first
- Weather system, polished day/night cycle
- Multiple car-dealer brands
- Any train presence, even as themed fast-travel
- Blood-decal damage (dent-only at MVP)
- Pedestrian/traffic simulation beyond a placeholder minimum
- Belval Plaza and any train destinations

### Scope Tiers

| Tier | Content | Features | Timeline |
| ---- | ---- | ---- | ---- |
| **MVP (Tier 0)** | 1 district (Gare) | Core loop only: drive, 1 dealer, basic tuning, theft unlock, 1 historical NPC, 3–5 missions, 1 house, dent-only damage | 1–2 months |
| **First Playable (Tier 1)** | 3–4 real districts (Ville Haute/Old Town, Gare, Grund, + one more) | Day/night + rain, 2–3 dealers, fuller tuning, stylized damage incl. light blood decals, 3–4 named historical NPCs with a short main arc, several easter eggs, 2–3 houses, scripted pedestrians, one active train line (themed fast-travel), gas stations + tuning shop fully functional | 9–12+ months — extended from the original "several months" target after PR-SCOPE: UNREALISTIC / TD-FEASIBILITY: HIGH RISK; the user chose to keep scope and extend time rather than cut |
| **Alpha** | All originally-named districts, rough pass | All originally requested systems present but rough: fuller traffic, more easter eggs, more dealers/houses, all 4 train stops reachable, an early Belval Plaza pass | Not estimated — depends on measured Tier 1 velocity |
| **Full Vision (Tier 2)** | Every district, fully polished | Full traffic AI, full pedestrian density, dynamic weather, emergency-services AI, all restaurants/bars/shops fully usable, all 4 train destinations with a fully detailed Belval Plaza (concerts, full interiors), the complete blood/dent damage model | Not planned, not estimated — an explicit north star; rated not viable for this team shape on any timeline by TD-FEASIBILITY |

---

## Next Steps

- [x] Get concept approval from creative-director — CD-PILLARS returned CONCERNS on the first
      draft; pillars were revised to address every point raised (tie-breaks, accessibility floor,
      named-NPC clarification, missing tuning pillar) and locked in with the user
- [ ] Fill in CLAUDE.md technology stack based on engine choice (`/setup-engine`) — weigh the
      AI-editability finding above
- [ ] Create game pillars document (`/design-review` to validate)
- [ ] **Prototype core idea** (`/prototype driving feel`) — before writing further GDDs, validate
      that the grounded-but-accessible driving model is fun; both gate reviews flagged this as the
      single highest-leverage unknown
- [ ] If prototype PROCEEDS: Decompose concept into systems (`/map-systems`)
- [ ] Design each system (`/design-system [system-name]`) — use prototype learnings in Tuning
      Knobs and Formulas sections
- [ ] Build vertical slice in Pre-Production (`/vertical-slice`) — validate the full game loop
      before committing to Production
- [ ] Validate core loop with playtest (`/playtest-report`)
- [ ] Plan first milestone (`/sprint-plan new`)
