# Unearther Distribution System

Dieses Dokument beschreibt das automatische Material-Verteilungssystem für Unearthers.

> **Hinweis:** Für allgemeine Systemarchitektur, Hardware-Setup, Boot-Sequenz und Logging siehe [system.md](./system.md).

## Inhaltsverzeichnis

- [Kontext & Hintergrund](#kontext--hintergrund)
- [Design-Entscheidungen](#design-entscheidungen)
- [Konfiguration](#konfiguration)
- [Gewichtete Materialauswahl](#gewichtete-materialauswahl)
- [Transfer-Ablauf](#transfer-ablauf)
- [Edge Cases](#edge-cases)
- [Erweiterung](#erweiterung)

---

## Kontext & Hintergrund

### Was sind Unearthers?

Unearthers (z.B. aus dem FDB Storm Block Modpack) sind Maschinen, die Basismaterialien wie Sand, Gravel oder Soul Sand verarbeiten und daraus Ressourcen gewinnen. Sie benötigen kontinuierliche Materialzufuhr für den Betrieb.

### Problemstellung

- Unearthers verarbeiten Material schneller als man manuell nachfüllen kann
- Verschiedene Unearther-Typen akzeptieren unterschiedliche Materialien
- Die Materialverteilung soll "halbwegs gleichmäßig" erfolgen, aber konfigurierbar sein
- Das System soll dynamisch erweiterbar sein (mehr Unearthers hinzufügen)

### Ziel

Automatische Verteilung von Basismaterialien aus einem zentralen Lager (Drawer Controller) an mehrere Unearthers, sobald deren Eingangsinventare leer sind.

---

## Design-Entscheidungen

### Architektur-Evolution

Das System wurde ursprünglich als **Turtle-basiertes System** konzipiert:

**Ursprünglicher Plan (verworfen):**
- Turtle holt Items aus Drawer Controller
- Turtle fährt physisch zu Unearthern (lineare Reihe)
- GPS für Positionsbestimmung
- Pose-Tracking für Navigation
- Fuel-Management

**Finale Implementierung:**
- Stationärer CC:Tweaked Computer
- Wired-Modem-Netzwerk verbindet alle Inventare
- Remote-Inventarabfrage via `list()`
- Direkter Transfer via `pushItems()`

### Warum die Änderung?

Die Turtle-Lösung hätte folgende Nachteile gehabt:

| Problem | Auswirkung |
|---------|------------|
| Navigation | Komplex (Pose-Tracking, Kalibrierung, Recovery) |
| Fuel | Zusätzliche Logik für Betankung |
| Geschwindigkeit | Physisches Fahren dauert länger |
| Chunk-Unload | Turtle könnte "verloren gehen" |
| Erweiterung | Neue Unearthers erfordern Routen-Anpassung |

Die Wired-Lösung eliminiert all diese Probleme.

### Physische Anordnung

Die Unearthers müssen **nicht** in einer Reihe stehen. Solange alle Input-Chests über Wired-Modems am gleichen Netzwerk hängen, können sie beliebig positioniert werden.

---

## Konfiguration

### Materialien (`materials`)

Jedes Material hat:
- **itemId**: Minecraft Item-ID
- **minStock**: Minimum im Lager (nie unterschreiten)
- **weight**: Gewichtung für Auswahl (höher = häufiger)

```typescript
materials: {
    sand: {
        itemId: "minecraft:sand",
        minStock: 128,   // Nie unter 128 Items fallen
        weight: 3,       // 3× wahrscheinlicher als weight=1
    },
    soul_sand: {
        itemId: "minecraft:soul_sand",
        minStock: 64,
        weight: 1,
    },
    gravel: {
        itemId: "minecraft:gravel",
        minStock: 64,
        weight: 1,
    },
}
```

### Unearther-Typen (`uneartherTypes`)

Definiert, welche Materialien ein Unearther-Typ verarbeiten kann:

```typescript
uneartherTypes: {
    brusher: {
        // Kann Sand und Gravel verarbeiten
        supportedMaterials: ["sand", "gravel"],
    },
    soul_processor: {
        // Nur Soul Sand
        supportedMaterials: ["soul_sand"],
    },
    universal: {
        // Alles
        supportedMaterials: ["sand", "soul_sand", "gravel"],
    },
}
```

### Unearther-Instanzen (`unearthers`)

Konkrete Maschinen im Netzwerk:

```typescript
unearthers: {
    brusher_1: {
        id: "brusher_1",
        type: "brusher",                    // Referenz auf Type
        inputChest: "minecraft:chest_0",    // Netzwerk-Name der Input-Chest
    },
    brusher_2: {
        id: "brusher_2",
        type: "brusher",
        inputChest: "minecraft:chest_1",
    },
    soul_1: {
        id: "soul_1",
        type: "soul_processor",
        inputChest: "minecraft:chest_2",
    },
}
```

---

## Gewichtete Materialauswahl

### Scheduler-Algorithmus

Der `WeightedScheduler` wählt für jeden leeren Unearther ein passendes Material:

```
selectMaterial(unearther, inventoryContents, stackSize):

    1. HOLE supportedMaterials vom UneartherType
       z.B. brusher → ["sand", "gravel"]

    2. FILTERE auf verfügbare Materialien:
       Für jedes unterstützte Material:
       └─► benötigt = minStock + stackSize
       └─► Nur wenn inventoryCount >= benötigt → in available[]

    3. BERECHNE Gesamtgewicht:
       totalWeight = Σ material.weight

    4. GEWICHTETE ZUFALLSAUSWAHL:
       random = math.random() * totalWeight
       cumulative = 0
       FÜR JEDES Material in available[]:
       └─► cumulative += material.weight
       └─► WENN random < cumulative → RETURN dieses Material

    5. RETURN: materialId, config, erster verfügbarer Slot
```

### Beispiel

```
Unearther: brusher_1 (Typ: brusher)
Unterstützte Materialien: sand, gravel

Inventar:
  - sand:   count=500, minStock=128, weight=3
  - gravel: count=200, minStock=64,  weight=1

Prüfung (stackSize=64):
  - sand:   500 >= 128+64=192? ✓ verfügbar
  - gravel: 200 >= 64+64=128?  ✓ verfügbar

totalWeight = 3 + 1 = 4

Wahrscheinlichkeiten:
  - sand:   3/4 = 75%
  - gravel: 1/4 = 25%

Ergebnis: sand wird 3× häufiger gewählt als gravel
```

### Fairness über Zeit

Durch die gewichtete Zufallsauswahl ergibt sich über Zeit eine faire Verteilung entsprechend der konfigurierten Gewichte. Ein Material mit `weight: 3` wird ungefähr 3× so oft gewählt wie eines mit `weight: 1`.

---

## Transfer-Ablauf

### Ablauf pro leerem Unearther

```
┌─────────────────────────────────────────────────────────────┐
│ DISTRIBUTION PHASE (Phase 3 der Hauptschleife)             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Für jeden leeren Unearther:                                │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 1. MATERIAL AUSWÄHLEN                                 │ │
│  │    scheduler.selectMaterial(unearther, inventory, 64) │ │
│  │    ├─► Filtere auf supportedMaterials                │ │
│  │    ├─► Prüfe minStock + stackSize                    │ │
│  │    └─► Gewichtete Zufallsauswahl                     │ │
│  │                                                       │ │
│  │    Ergebnis: { materialId, config, sourceSlot }      │ │
│  │    oder null wenn nichts verfügbar                   │ │
│  └───────────────────────────────────────────────────────┘ │
│                          │                                  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 2. SLOT VERIFIZIEREN (Race-Condition-Schutz)         │ │
│  │    materialSource.getItemDetail(sourceSlot)           │ │
│  │    └─► Ist Item noch das erwartete?                  │ │
│  │        Falls nein → ERR_SLOT_CHANGED, skip           │ │
│  └───────────────────────────────────────────────────────┘ │
│                          │                                  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 3. TRANSFER AUSFÜHREN                                 │ │
│  │    materialSource.pushItems(inputChest, slot, 64)     │ │
│  │    └─► Rückgabe: Anzahl transferierter Items         │ │
│  │        Falls 0 → ERR_TRANSFER_FAILED                 │ │
│  └───────────────────────────────────────────────────────┘ │
│                          │                                  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 4. INVENTAR-TRACKING AKTUALISIEREN                    │ │
│  │    inventoryContents[itemId].totalCount -= transferred│ │
│  │    └─► Verhindert doppelte Auswahl im selben Loop    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### pushItems() Mechanik

Der Transfer erfolgt **direkt über das Wired-Netzwerk**:

```typescript
// Von Drawer Controller direkt in Input-Chest
const transferred = materialSource.pushItems(
    "minecraft:chest_0",  // Ziel: Input-Chest des Unearthers
    5,                    // Quell-Slot im Drawer Controller
    64                    // Anzahl (1 Stack)
);
```

Vorteile gegenüber physischem Transport:
- **Sofort** - keine Fahrzeit
- **Zuverlässig** - keine Blockierung möglich
- **Skalierbar** - beliebig viele Unearthers gleichzeitig

---

## Edge Cases

### Unearther-Chest offline

**Situation:** Eine Input-Chest ist nicht erreichbar.

**Handling:**
- Warnung wird geloggt
- Unearther wird als "nicht leer" markiert (kein Befüllversuch)
- System überspringt, scannt nächsten Unearther

### Kein Material verfügbar

**Situation:** Alle unterstützten Materialien unter minStock.

**Handling:**
- Unearther bleibt leer
- Im nächsten Loop-Durchlauf wird erneut geprüft
- Kein Fehler, normaler Betrieb

### Slot geändert (Race Condition)

**Situation:** Zwischen Scan und Transfer wurde der Slot-Inhalt geändert.

**Handling:**
- Fehlercode: `ERR_SLOT_CHANGED`
- Transfer wird abgebrochen
- Nächster Unearther wird verarbeitet

### Unbekannter Unearther-Typ

**Situation:** Ein Unearther referenziert einen nicht definierten Typ.

**Handling:**
- Boot-Validierung schlägt fehl
- System startet nicht
- Fehler muss in Config korrigiert werden

---

## Erweiterung

### Neuen Unearther hinzufügen

1. **Input-Chest platzieren** und mit Wired Modem ans Netzwerk anschließen

2. **Peripheral-Namen ermitteln**:
   - In-Game: F3+H aktivieren, dann Chest anschauen
   - Oder: `peripheral.getNames()` am Computer

3. **In Config eintragen**:

```typescript
unearthers: {
    // ... bestehende Unearthers ...
    new_brusher: {
        id: "new_brusher",
        type: "brusher",                    // Existierender Typ
        inputChest: "minecraft:chest_99",   // Neuer Peripheral-Name
    },
}
```

4. **Skript neu starten** (Computer rebooten oder Programm neu starten)

### Neuen Unearther-Typ hinzufügen

1. **In `uneartherTypes` definieren**:

```typescript
uneartherTypes: {
    // ... bestehende Typen ...
    netherrack_processor: {
        supportedMaterials: ["netherrack", "soul_sand"],
    },
}
```

2. **Materialien sicherstellen** - alle referenzierten Materials müssen existieren

3. **Unearther-Instanzen mit neuem Typ anlegen**

### Neues Material hinzufügen

1. **In `materials` definieren**:

```typescript
materials: {
    // ... bestehende Materialien ...
    netherrack: {
        itemId: "minecraft:netherrack",
        minStock: 64,
        weight: 2,
    },
}
```

2. **In Unearther-Typen referenzieren** (wo gewünscht)

---

## Verwandte Dokumentation

- **Systemarchitektur:** [system.md](./system.md)
- **Material Processing:** [material-processing.md](./material-processing.md)
