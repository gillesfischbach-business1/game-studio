# ADR-0002: WebGPU-Renderer für Schueberfouer 2026

## Status

Proposed

> Nur der Nutzer (oder `technical-director` mit seiner ausdrücklichen Bestätigung) setzt diesen Status auf `Accepted`.

## Date

2026-11-26

## Last Verified

2026-11-26

## Decision Makers

Nutzer (Auftraggeber, hat WebGPU am 2026-11-26 gewünscht), Claude (Umsetzung).

## Summary

Der Browser-Prototyp `prototypes/schueberfouer` rendert mit three.js r170 über WebGL 2. Vorgeschlagen wird die
Umstellung auf den `WebGPURenderer` von three.js mit Materialien und Effekten in TSL (Three Shading Language).
Derselbe Code läuft dann auf WebGPU und fällt automatisch auf WebGL 2 zurück, wo WebGPU fehlt. Die Umstellung
erfolgt in vier Stufen hinter dem Schalter `?gpu=1`; der bisherige WebGL-Pfad bleibt bis zum Abschluss Standard.

## Engine Compatibility

Betrifft nur den Browser-Prototyp (three.js), nicht das Unity-6.3-Projekt.

| Punkt | Stand 2026-11-26 |
|---|---|
| three.js im Spiel | r170 (`0.170.0`) |
| three.js aktuell | r187 (`0.187.0`, per `npm view three version`) |
| WebGPU im Test-Browser | läuft (Chromium headless, SwiftShader-Adapter, auf `localhost` geprüft) |
| WebGPU auf Endgeräten | nicht geprüft; hängt von Browser, Android-WebView-Version und Grafiktreiber ab |

## ADR Dependencies

ADR-0001 (Cloud-Rendering) bleibt unberührt: der WHEP-Client ist unabhängig vom lokalen Renderer.

## Context

Im Spiel gibt es acht Stellen mit eigenem GLSL-Code, die der `WebGPURenderer` nicht ausführt:

| Datei | Stelle | Aufgabe |
|---|---|---|
| `js/tex.js` | `onBeforeCompile` in `pbr()` | Welt-UV, Nässe, Fenster, Bodenspiegelung |
| `js/tex.js` | `ShaderMaterial` | Himmel (Mischung Tag, Dämmerung, Nacht) |
| `js/fx.js` | `onBeforeCompile` | Wind im Laub |
| `js/fx.js` | 3 × `ShaderMaterial` | Gras, Suchscheinwerfer, Dampf |
| `js/main.js` | 2 × `ShaderMaterial` | Regen, Farbkorrektur |
| `js/util.js` | `ShaderMaterial` | Glühbirnen mit Lauflicht |

Dazu kommen der `EffectComposer` (GTAO, Bloom, FXAA, SMAA), der `Reflector` und der `Lensflare`-Zusatz, die
alle an WebGL gebunden sind.

WebGPU macht ein Bild nicht von selbst realistischer. Es erlaubt Techniken, die mit WebGL zu teuer sind:
viele echte Lichtquellen pro Bild, Spiegelungen und indirektes Licht im Bildraum, Partikel per Compute-Shader
und mehr Zeichenbefehle bei gleicher Bildrate.

## Decision

1. three.js auf die aktuelle Version anheben (r170 → r187), weil der WebGPU-Pfad seit r170 stark gereift ist.
2. Alle acht Shader-Stellen nach TSL portieren; Nachbearbeitung über `PostProcessing` mit TSL-Knoten.
3. Schalter `?gpu=1` und Option „Renderer“ im Grafikmenü; Standard bleibt WebGL, bis Stufe 4 bestanden ist.
4. Danach neue Technik nur im WebGPU-Pfad: viele echte Lichter, Bildraum-Spiegelungen, Compute-Partikel.

## Alternatives Considered

- **Bei WebGL 2 bleiben:** kein Umbau, aber die Lichtzahl (Pool von 2–10 Punktlichtern) und die Spiegelung
  bleiben die Grenze für den Realismus.
- **Zwei getrennte Renderer dauerhaft pflegen:** doppelte Shader, doppelte Tests. Verworfen; TSL liefert den
  WebGL-2-Rückfall aus demselben Code.
- **Andere Engine (Babylon.js, PlayCanvas):** vollständiger Neubau des Prototyps. Verworfen.

## Consequences

- Der gesamte Grafikcode wird einmal angefasst; Fehler im Aussehen sind in jeder Stufe möglich.
- Das Android-Paket wächst um die WebGPU-Variante von three.js.
- Ein Shader-Code für beide Wege senkt die Pflege auf Dauer.

## Risks

- **Geräte ohne WebGPU:** Rückfall auf WebGL 2 muss gleich aussehen; wird in jeder Stufe mitgetestet.
- **Artifact-Sandbox und Android-WebView:** WebGPU-Verfügbarkeit dort ist nicht geprüft.
- **Versionssprung r170 → r187:** kann Verhalten bestehender Teile ändern (Farbraum, Schatten, Zusatzmodule).
- **Leistung im Test-Browser:** SwiftShader rechnet auf der CPU; Bildraten von dort sagen nichts über echte Geräte.

## GDD Requirements Addressed

Keine GDD vorhanden (Prototyp). Bezug: Nutzerwunsch „maximale Grafik und Realismus“ und „WebGPU“.

## Performance Implications

Ziel: gleiche oder bessere Bildrate als WebGL bei gleicher Szene (Messung per `G.prof`, `G.drawCalls`),
danach mehr echte Lichter bei mindestens 60 FPS am PC. Messungen stehen aus.

## Migration Plan

| Stufe | Inhalt | Abnahme |
|---|---|---|
| 1 | three.js r187, Spiel unverändert auf WebGL | Bildvergleich Tag/Nacht gegen `37`/`38`, keine Fehler |
| 2 | `?gpu=1`: Renderer, `pbr()`, Himmel, Glühbirnen in TSL | Szene steht, Boden/Fassaden/Lichter korrekt |
| 3 | Laub, Gras, Regen, Dampf, Suchscheinwerfer, Spiegelung, Nachbearbeitung | Bildvergleich WebGPU gegen WebGL |
| 4 | Menü-Option, Android-Paket, Rückfall-Test | Test auf echtem Gerät durch den Nutzer |

## Validation Criteria

- Screenshots Tag und Nacht auf WebGPU und im WebGL-2-Rückfall in `production/qa/evidence/schueberfouer/`.
- Keine Seitenfehler; Draw-Calls und Dreiecke nicht höher als im WebGL-Pfad.

## Related

- `docs/architecture/ADR-0001-cloud-rendering.md`
- `prototypes/schueberfouer/README.md`
