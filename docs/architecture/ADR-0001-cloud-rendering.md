# ADR-0001: Cloud-Rendering-Pfad für Schueberfouer 2026

## Status

Proposed

> Nur der Nutzer (oder `technical-director` mit seiner ausdrücklichen Bestätigung) setzt diesen Status auf `Accepted`.

## Date

2026-11-22

## Last Verified

2026-11-22

## Decision Makers

Nutzer (Auftraggeber), Claude (Umsetzung) – noch nicht vom Nutzer bestätigt.

## Summary

Der Browser-Prototyp `prototypes/schueberfouer` (three.js/WebGL) stößt bei fotorealistischer Grafik an die Grenzen
von Endgeräten. Vorgeschlagen wird ein zweigleisiger Weg: Der Browser-Client bleibt das spielbare Produkt und erhält
einen WHEP/WebRTC-Cloud-Modus. Eine spätere High-End-Version in **Unity 6.3 LTS (HDRP)** – dem gepinnten Engine-Stand des
Studios – oder alternativ **Unreal Engine 5** rendert auf Cloud-GPUs und wird per WebRTC in denselben Client gestreamt.
Die Welt wird über einen glTF-Export geteilt, damit beide Wege dieselben Daten nutzen.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6.3 LTS (Projekt-Pin); Browser-Prototyp: three.js r170 |
| **Domain** | Rendering / Networking |
| **Layer** | Foundation |
| **Knowledge Risk** | HIGH (Unity 6.x liegt nach dem Wissensstand des Modells, siehe `docs/engine-reference/unity/VERSION.md`) |
| **References Consulted** | `docs/engine-reference/unity/VERSION.md`; Notion „Game Dev – Engines für High-End-Grafik“ |
| **Post-Cutoff APIs Used** | Keine im Prototyp. Unity Render Streaming / glTFast-Versionen für 6.3 LTS müssen vor der Umsetzung geprüft werden. |
| **Verification Required** | WHEP-Gegenstelle mit echtem Server testen; Latenz < 80 ms (Glas zu Glas) in Luxemburg; Eingabe-Protokoll Ende-zu-Ende |

## ADR Dependencies

Keine.

## Context

- Der Nutzer will „aktuellen Standard und Spieleranspruch“ mit fotorealistischer Optik und plant Cloud Gaming.
- Der Browser-Prototyp nutzt bereits fotogescannte CC0-PBR-Texturen, HDR-Himmel, planare Spiegelungen, GTAO, Bloom,
  Laubbäume mit Wind und echte 3D-Requisiten. Weitere Sprünge (Raytracing, Nanite-ähnliche Geometrie, Lumen-ähnliche GI,
  realistische animierte Menschenmengen) sind im Browser auf Handys nicht flüssig machbar.
- Das Studio ist auf Unity 6.3 LTS gepinnt; die Cloud-Container dieser Entwicklungsumgebung haben keine GPU und keinen
  Unity-Editor.

## Decision

1. **Ein Client, zwei Renderwege.** Der Browser-Client rendert lokal (WebGL) *oder* empfängt ein Video aus der Cloud.
   Implementiert in `js/cloud.js` (WHEP: `POST application/sdp`, `Location`-Ressource, `DELETE` beim Trennen) mit einem
   DataChannel `input`, der Eingaben als JSON sendet: `kd/ku` (Taste), `mm` (Maus, normiert + Delta), `md/mu`, `wh`, `gp` (Gamepad, 30 Hz).
2. **Cloud-Renderer:** Unity 6.3 LTS HDRP mit *Unity Render Streaming* (WebRTC). Weil Unity Render Streaming eine eigene
   Signalisierung nutzt, sitzt davor ein WHEP-Gateway (z. B. MediaMTX oder ein kleiner Signalisierungs-Adapter).
   Alternative bei maximaler Grafik: Unreal Engine 5 mit Pixel Streaming (ebenfalls über ein Gateway).
3. **Gemeinsame Weltdaten:** `exports/schueberfouer_world.glb` (statische Welt, Instanzen über `EXT_mesh_gpu_instancing`)
   und `exports/layout.json` (Straßen, Glacis-Umriss, Attraktionen, Stände, Eingänge in Metern, lokales Koordinatensystem).
   Import in Unity über glTFast, in Unreal über den glTF-Importer. Fahrgeschäfte werden in der Engine neu gebaut.
4. **Hosting:** GPU-Instanzen in einer EU-Region nahe Luxemburg (z. B. Frankfurt), eine Sitzung pro GPU-Instanz,
   Autoscaling nach Warteschlange.

## Alternatives Considered

- **Nur Browser (WebGL/WebGPU):** günstig, keine Serverkosten, aber Obergrenze bei Grafik und Menschenmengen auf Handys.
  Bleibt als Fallback und Standard.
- **WebGPU-Migration von three.js:** besser für Compute-Effekte, erfordert aber das Umschreiben aller eigenen Shader
  (onBeforeCompile → TSL). Später sinnvoll, ersetzt Cloud-Rendering nicht.
- **Kommerzielle Cloud-Gaming-Plattformen (GeForce NOW, Xbox Cloud):** setzen eine veröffentlichte PC-Version und
  Plattform-Verträge voraus. Zu früh.

## Consequences

- Positiv: Fotorealismus auf jedem Gerät möglich; ein gemeinsamer Client; Weltdaten nur einmal gepflegt.
- Negativ: Laufende GPU-Kosten pro Spieler-Stunde; Netzlatenz; zweite Codebasis (Unity/Unreal).
- Das claude.ai-Artifact blockiert per CSP Verbindungen zu fremden Servern. Cloud-Modus funktioniert nur bei eigenem Hosting.

## Risks

- Latenz und Paketverlust im Mobilfunk → adaptive Bitrate, Server in Frankfurt, Eingabe-Vorhersage für die Kamera.
- Unity-6.3-APIs liegen nach dem Modellwissen: vor der Umsetzung gegen die aktuelle Dokumentation prüfen.
- Kosten: pro gleichzeitigem Spieler eine GPU-Instanz.

## GDD Requirements Addressed

Nutzeranforderung „fotorealistisch, aktueller Spielerstandard“ und „spätere Einbindung für Cloud Gaming“ (Chatverlauf 2026-11-22).

## Performance Implications

Browser: Cloud-Modus schaltet lokales Rendering ab (`G.cloudActive`), Client-Last nur Video-Dekodierung.
Server: Ziel 1080p60, H.264/VP9, 8–15 Mbit/s.

## Migration Plan

1. Weltexport erzeugen (`tools/export-world.mjs`) und in Unity 6.3 HDRP importieren.
2. Render-Streaming-Szene mit Eingabe-Empfänger, der das JSON-Protokoll oben versteht.
3. WHEP-Gateway aufsetzen, Ende-zu-Ende testen, dann Cloud-Option im Client freischalten.

## Validation Criteria

- Client verbindet sich mit einem WHEP-Testserver, zeigt Video, Eingaben kommen am Server an.
- GLB lässt sich in Unity 6.3 (glTFast) und Blender ohne Fehler importieren.

## Related

`prototypes/schueberfouer/js/cloud.js`, `prototypes/schueberfouer/tools/export-world.mjs`, `prototypes/schueberfouer/exports/`.
