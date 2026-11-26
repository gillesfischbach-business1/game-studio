# Schueberfouer 2026 – Agententeam (Stand 2026-11-26)

Ziel der laufenden Etappe: realistischer Grafikstil in Richtung GTA 5 für den Browser-Prototyp
`prototypes/schueberfouer/`. Der Game Director (Hauptsitzung) entscheidet, verteilt Arbeit und
integriert; die Fachagenten liefern je ein klar begrenztes Paket.

## Rollen

| Rolle | Agent | Aufgabe | Darf ändern |
|---|---|---|---|
| Game Director | Hauptsitzung | Ziele, Prioritäten, Integration, Abnahme, Commits | alles |
| Buden-Artist | `technical-artist` | Detail an Ständen und Restaurants | nur `js/fair.js` |
| Fahrgeschäft-Artist | `technical-artist` | Detail an den Fahrgeschäften | nur `js/rides.js` |
| Figuren-Programmierer | `gameplay-programmer` | Gehbewegung der Menge (Knie, Arme) | nur `js/npc.js` |
| QA | `qa-tester` | Prüft den integrierten Stand im Browser, schreibt Befund | nur `production/qa/` |
| Performance | `performance-analyst` | Misst Zeichenbefehle und Dreiecke vor/nach | nur `production/qa/` |

## Regeln

1. **Ein Agent, eine Datei.** Die drei Umsetzungs-Agenten arbeiten parallel und ändern nie dieselbe Datei.
2. **Kein Agent committet oder pusht.** Das macht nur der Game Director nach der Abnahme.
3. **Umsetzungs-Agenten starten keinen Browser.** Der Test-Browser braucht viel Speicher; mehrere
   gleichzeitig wurden in früheren Läufen vom System beendet. Sie prüfen nur die Syntax (`node --check`).
4. **Browser-Tests laufen nacheinander:** erst Integration und Screenshots durch den Game Director,
   dann QA, dann Performance.
5. **Budget:** höchstens +60 Zeichenbefehle und +250.000 Dreiecke pro Paket in der Stufe „Héich";
   statische Geometrie geht durch den vorhandenen `Batcher`, Wiederholtes wird instanziert.
6. **Jeder Agent meldet:** was geändert wurde, was nicht geprüft werden konnte, und geschätzte Kosten.

## Ablauf

1. Parallel: Buden-Artist, Fahrgeschäft-Artist, Figuren-Programmierer.
2. Game Director: Syntaxprüfung, Start im Browser, Screenshots Tag und Nacht, Korrekturen.
3. QA-Agent: Befund in `production/qa/`.
4. Performance-Agent: Messung gegen die Werte vor der Etappe (Héich, Mittelallee: ~1.000–1.550
   Zeichenbefehle je nach Schatten-Bild, ~2,9–3,8 Mio. Dreiecke).
5. Game Director: Commit, Push, Browser-Version, Bericht mit Bildern an den Nutzer.
