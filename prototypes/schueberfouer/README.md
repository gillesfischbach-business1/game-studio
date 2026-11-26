# Schueberfouer 2026 – Open-World-Kirmes-Simulation (Browser-Prototyp)

**Status:** in Arbeit (spielbare Version 0.5)

## Hypothese
Eine detailgetreue, frei begehbare Simulation der Schueberfouer auf dem Glacis (Stad Lëtzebuerg)
macht im Browser Spaß, auch ohne Installation: herumlaufen, essen, trinken, Kleider kaufen,
Attraktionen fahren, Missionen und Easter Eggs.

## Warum Browser (Three.js) und nicht Unity?
Das Studio-Projekt ist auf Unity 6.3 LTS eingestellt. In der Cloud-Umgebung, in der dieser
Prototyp entstanden ist, läuft aber kein Unity-Editor. Ein Browser-Spiel lässt sich sofort
per Link am PC und am Handy spielen. Erkenntnisse aus diesem Prototyp können später in
eine Unity-Version einfließen (Regel: Prototyp-Code wird nicht migriert, sondern neu geschrieben).

## Starten
- Online: über den veröffentlichten Artifact-Link.
- Lokal: in diesem Ordner einen kleinen Webserver starten, z. B. `npx serve .` oder
  `python3 -m http.server 8080`, dann `http://localhost:8080/index.html` öffnen.
  (Direkt per Doppelklick geht es nicht, weil der Browser ES-Module von `file://` blockiert.)
- Qualität per URL: `?q=low`, `?q=mid` oder `?q=high`.

## Steuerung
| PC | Handy | Aktion |
|---|---|---|
| WASD / Pfeile | linker Joystick | laufen |
| Shift | Joystick ganz nach außen | sprinten |
| Maus (Klick = Maus fangen) | rechts wischen | umschauen |
| Space | ⤒ | springen |
| **E** | **E** | alles benutzen (Stände, Kassen, Personen, Tram) |
| **Q** | 🧭 | **Fouer-Kompass**: Wunsch wählen (Hunger, Durst, Attraktion, Shopping, Spiele, Mission, Ausgang), goldene Pfeile führen dich hin |
| M / J / I | 🗺 / ★ | Karte (Klick setzt Ziel) / Missionen / Garderobe |
| V | 👁 | 1./3. Person (auch in Fahrgeschäften) |
| P | 📷 | Foto |
| T | – | +30 Minuten |
| Esc | ☰ | Pause-Menü (Zeit springen, Ton, Spielstand zurücksetzen) |

## Inhalt
- **Echte Geografie** (OpenStreetMap): Umriss des Glacis, Allée Scheffer, Rue Jean l'Aveugle,
  Avenue de la Faïencerie, Rond-Point Robert Schuman mit Luxemburger Fahne, Rue des Glacis,
  Boulevard Robert Schuman, Avenue de la Porte-Neuve, Grand Théâtre, Tram T1 mit den Haltestellen
  *Faïencerie* und *Theater*, Park, Kierfecht Notre-Dame, Pont Rouge in der Ferne.
- **Layout nach dem offiziellen Lageplan**: Eingänge E1–E9, Restaurantreihe entlang der Allée
  Scheffer (Schla'Winer, Taverne op der Fouer, Am Stall, Kessel, Restaurant Kugener, Friture
  Henriette, Friture Armand, Chez Irène, Crêperie bretonne), Hauptattraktionen mit echten Namen.
- **Haupttor E1** mit dem Tormotiv 2026 (Foto des Nutzers als Textur).
- **Fahrbar (detailliert):** Grande Roue Bellevue (Riesenrad), Carrousel Galopant (Doppelstock),
  Break Dance (auch als Operateur in der Bedienkabine), Alpina Bahn (Achterbahn mit Physik),
  Autoscooter Diamond (selbst fahren), Kettekarussell, Fräifall-Tuerm, Pendel, Geeschterbunn,
  Cinéma 5D (VR-Welt). Dazu Rotor, Circus Circus, XXL, Aeronaut, Tagada, Shakers, Transformer,
  Après-Ski Party, BoosterMaxxx, Big Splash, Bayern Kurve, Magic World.
- **~70 Stände**: Gromperekichelcher, Fëscherhaischen, Grillwurscht, Gebrannte Mandelen,
  Crêpes, Béierbud, Crémant-Bar, Fouer-Mode, Hütt & Brëllen, Lämmy-Shop, Schéissbud,
  Hau den Lukas, Lousbud, Info & Fonnbüro.
- **Unendlich Geld** (∞ €), aber echte Preise in Euro und Ausgaben-Zähler; Rabatttage 2026.
- **Kleider** sichtbar am Körper (Kappe, Cowboyhut, Lämmy-Ohren, Blumenkranz, Sonnen- und
  LED-Brille, Trikot, Hoodie, Schal, Leuchtkette).
- **Tag/Nacht** von 12:00 bis 01:00, 4 wählbare Fouer-Tage (Eröffnung mit Hämmelsmarsch,
  normaler Tag, Familientag, letzter Tag mit Feuerwerk 22:00).
- **12 Missionen** und **12 Easter Eggs** (u. a. 7 goldene Hämmelcher, Geist von Jhang de
  Blannen um Mitternacht, Konami-Code, Tram-Fahrt, Lämmy drücken).

## Version 0.2 – Grafik & Menüs
- **Fotorealistische Oberflächen:** fotogescannte CC0-PBR-Texturen von Poly Haven (Farbe, Normal-, Rauheits-Map) für Asphalt, Straßen, Pflaster, Rasen, Putzfassaden, Schieferdächer, Holz, Metall, Beton, Platanenrinde, Stoff. Weltraum-Projektion im Shader, damit alles maßstabsgetreu kachelt.
- **Echte Himmelsfotos** (HDRI Tag / Sonnenuntergang / Nacht) mit fließendem Übergang, Bildreflexionen aus HDR-Umgebungen.
- **Post-Processing:** Bloom, GTAO (Ambient Occlusion), SMAA/FXAA, Farbkorrektur, Vignette, Filmkorn, chromatische Aberration, Tone-Mapping wählbar (ACES/AgX/Neutral).
- **Wetter:** klar, Wolken, Regen (Regenstreifen, nasser glänzender Boden).
- **Neue Figuren:** anatomische Formen (Schultern, Taille, Knie, Ellbogen), Gesichter, Frisuren, Schuhe.
- **Menüs im Open-World-Stil:** Titelbildschirm mit Kameraflug, Pausenmenü mit Reitern (Kaart, Missiounen, Garderob, Statistiken, Optiounen, Spill).
- **Garderob:** Charakter-Editor mit Drehteller-Kamera (Haut, Größe, Frisur, Haarfarbe, T-Shirt, Hose, Schuhe, alle Fouer-Kleider).
- **Optionen:** Grafik (Preset, Auflösung, Schatten, AO, Kantenglättung, Bloom, Lichter, Besucherzahl, Sichtweite, FOV, Tone-Mapping, Helligkeit, Kontrast, Sättigung, Vignette, Filmkorn, FPS), Kamera & Maus, Ton (4 Kanäle), Spiel & Zeit (Uhrzeit-Regler, Lichtstimmung, Zyklus an/aus, Zeitgeschwindigkeit, Wetter, Fouer-Tag, HUD-Elemente, Autosave), Steuerung (Tasten frei belegbar, Gamepad), Barrierefreiheit (UI-Größe, Blitzreduktion, Bewegungsreduktion, Farbenblind-Filter, hoher Kontrast).

## Version 0.3 – Natürlichere Grafik & Cloud-Gaming-Vorbereitung
- **Planare Spiegelungen:** Kirmeslichter spiegeln sich im Asphalt, bei Regen stark (Option „Spigelungen“).
- **Echte 3D-Modelle** (Poly Haven, CC0, mit gltf-transform vereinfacht): klassische Straßenlaternen, Bänke, Mülleimer, Wein- und Bierfässer, Pflanzkästen, Kaffeewagen (benutzbar), Hängelampen und Tischlaternen in den Restaurants.
- **Laubbäume** aus einem fotografierten Blattatlas (ambientCG, CC0) mit Ästen und Wind; **Gras** in Park und Grünflächen.
- **Atmosphäre:** Suchscheinwerfer am Nachthimmel, Dampf über Fritten-, Fisch- und Crêpes-Ständen, Linsenreflex der Sonne, ziehende Wolken.
- **Cloud Gaming (Beta):** WHEP/WebRTC-Client (`js/cloud.js`) im Optionsmenü; Eingaben per DataChannel. Plan: `docs/architecture/ADR-0001-cloud-rendering.md`. Funktioniert nur bei eigenem Hosting (Artifact-Sicherheitsrichtlinie blockiert fremde Server).
- **Welt-Export für Unity/Unreal/Blender:** `node tools/export-world.mjs` erzeugt `exports/layout.json` und eine GLB, die anschließend mit gltf-transform komprimiert wird (`exports/schueberfouer_world.glb`, meshopt, 3,2 MB, glTF-Validator ohne Fehler). Böden/Fassaden tragen Materialnamen `PH_<set>`, damit die Engine die Poly-Haven-Materialien zuweisen kann. Vorschau: `tools/preview-export.html`.

## Version 0.4 – Flüssiger Spielverlauf (Performance)
Gemessen im Test-Browser (Nacht, Mittelallee, Preset „Héich“, alle Render-Durchgänge zusammen):

| Messwert pro Bild | v0.3 | v0.4 |
|---|---|---|
| Draw-Calls | 3.869 | ~1.370 (Hauptbild allein ~500) |
| Dreiecke | 10,3 Mio. | ~3,0 Mio. |

Maßnahmen: räumlich gebündelte statische Geometrie (Frustum-Culling greift), Spiegelung rendert nur Lichter/Schilder/Fahrgeschäfte (Layer 1), Schatten nur bei Bewegung bzw. alle 3–8 Bilder, Detailstufen für die Menschenmenge (Sichtweite, seltenere Updates in der Ferne, leichtere Geometrie), instanzierte Autos/Mitfahrer/Karussellpferde, Hausfassaden in 3 statt 40 Materialien, vereinfachte Laternen/Fässer, kleinerer Licht-Pool, dynamische Auflösung (Ziel 60 FPS) und optionales 30/60-FPS-Limit.

## Version 0.5 – Natürliche Klangkulisse & Optik
- **Echte Aufnahmen statt Synthesizer** (`assets/audio/`, 5,5 MB, Quellen und Lizenzen in `assets/audio/CREDITS.md`):
  Menschenmenge in drei Dichten, laute Musik an den Fahrgeschäften (Techno/House am Break Dance, Autoscooter, XXL,
  BoosterMaxxx …, Polka an der Après-Ski Party, Karussellmusik am Carrousel), Gläserklirren und Anstoßen an Restaurants
  und Bierbuden, Geschirr und Küchenlärm, Luftgewehr an der Schéissbud, Jahrmarkt-Ausrufer an den Spielbuden,
  Kichern, Regen aufs Budendach, Feuerwerk am letzten Tag.
- **Gesprächsfetzen** auf Lëtzebuergesch, Französisch, Deutsch und Portugiesisch von Leuten, die in der Nähe vorbeigehen.
- **3D-Klang:** jede Quelle sitzt an ihrem Ort (HRTF am PC, Stereo-Panorama am Handy), Entfernung dämpft die Höhen,
  Lautsprecher-Klang mit Hall zwischen den Fassaden, Limiter gegen Übersteuern. Es spielen immer die 3 nächsten Anlagen.
- **Optik:** Asphalt neutral grau mit abgefahrenen Parkplatz-Linien, leichter Sommerdunst in der Ferne, nachts warmes
  Streulicht des Lampenmeers auf dem Boden; behoben: Gras schimmerte bei geringer Tiefengenauigkeit durch den Asphalt.
- **Nachtrag:** echte Blaskapelle für den Hämmelsmarsch (zieht räumlich mit dem Umzug mit), echte Schreie und kräftiger Jubel an laufenden wilden Fahrgeschäften, Antriebsbrummen am nächsten laufenden Fahrgeschäft.
- Werkzeuge: `tools/audio/mkaudio.py` (Schnitt, nahtlose Loops, Mono-MP3), `tools/audio/fleurs.py` (Sprachproben).

## Version 0.6 – Grafikstile und three.js r187 (in Arbeit)
- **Grafikstil wählbar** (Optionen → Grafik → „Grafikstil"): *Realistesch* (Standard, Kino-Farbgebung mit warmen Lichtern
  und kühlen Schatten) und *Neon-Comic* (Tuschekonturen, Farbstufen, blaugrüne Schatten, Hologramm-HUD).
- **three.js r170 → r187** im Browser (Stufe 1 von ADR-0002, WebGPU). Die Android-App bündelt weiter r170;
  `js/fx.js` unterstützt beide Versionen.
- **Figuren der Menge:** Kleidungsvielfalt pro Person (lange Ärmel, offene Jacke, kurze Hose, helle Schuhe),
  vier Gesichter (neutral, Bart, Brille, geschminkt), dritte Frisur und Glatze, unterschiedliche Staturen,
  Kontaktschatten am Boden. Kosten: +2 Zeichenbefehle (Frisur, Schatten).
- **Bekannte Eigenheit:** In den ersten rund 10 Bildern nach dem Spielstart, solange Texturen nachladen, kann der
  Asphalt in einzelnen Bildern fehlen (die Wiese darunter ist sichtbar). Gemessen per Pixelprobe im Test-Browser
  (Bilder 5 und 9 betroffen, ab Bild 11 stabil). Dort dauert das wegen ~0,5 Bildern/s rund 20 s.

## Dateien
`index.html` (lokal), `artifact.html` (veröffentlichte Variante), `js/data.js` (alle
Spieldaten), `js/world.js`, `js/fair.js`, `js/rides.js`, `js/npc.js`, `js/player.js`,
`js/game.js`, `js/ui.js`, `js/menu.js`, `js/settings.js`, `js/tex.js`, `js/audio.js`, `js/main.js`, `assets/tor2026.jpg`, `assets/tex/` (Poly Haven, CC0), `js/props.js`, `js/fx.js`, `js/cloud.js`, `assets/models/` (Poly Haven, CC0, als eingebettetes glTF-JSON), `assets/audio/` (Klänge, siehe CREDITS.md), `tools/`, `exports/`.

## Erkenntnisse (bisher)
- Die Lichtstimmung entsteht vor allem durch tausende instanzierte Glühbirnen mit Shader-Lauflicht
  plus gemalte Lichtpfützen am Boden. Echte Lichter sind zu teuer und werden als Pool von
  6–10 Punktlichtern zu den nächsten Quellen verschoben.
- Ca. 800 Draw-Calls auf „hoch“. Für schwache Handys `?q=low` nutzen.
- Die Abstände im Gelände sind an den Plan angelehnt, aber nicht vermessen. Fahrgeschäfte sind
  frei nachempfunden, keine 1:1-Nachbauten.
