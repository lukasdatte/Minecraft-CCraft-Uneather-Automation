# Material Processing System

Dieses Dokument beschreibt das automatische Materialverarbeitungssystem (Hammer-Chain) für die Basismaterial-Produktion.

> **Hinweis:** Für allgemeine Systemarchitektur, Hardware-Setup, Boot-Sequenz und Logging siehe [system.md](./system.md).

## Inhaltsverzeichnis

- [Kontext & Hintergrund](#kontext--hintergrund)
- [Design-Entscheidung](#design-entscheidung)
- [Materialverarbeitungskette](#materialverarbeitungskette)
- [Hardware-Erweiterung](#hardware-erweiterung)
- [Konfiguration](#konfiguration)
- [Verarbeitungslogik](#verarbeitungslogik)
- [Edge Cases](#edge-cases)
- [Integration](#integration)

---

## Kontext & Hintergrund

### Cobblestone-Generatoren

In Minecraft-Modpacks (insbesondere Skyblock-Varianten) dienen Cobblestone-Generatoren als unendliche Ressourcenquelle. Lava und Wasser erzeugen kontinuierlich Cobblestone, der dann weiterverarbeitet werden kann.

### Hammer-Verarbeitung (Ex Nihilo / Outdoor Hammers)

Mit Hammer-Blöcken (z.B. aus Ex Nihilo oder Outdoor Hammers Mod) können Materialien in ihre nächste Stufe umgewandelt werden:

- Ein Hammer nimmt ein Input-Material
- Nach Verarbeitung (Redstone-Signal oder automatisch) entsteht das Output-Material
- Pipes oder Hopper transportieren das Ergebnis zurück ins Lager

### Ziel

Das System automatisiert die Produktion von Basismaterialien, sodass immer ein gewisser Vorrat vorhanden ist, ohne manuelles Eingreifen.

---

## Design-Entscheidung

### Eine gemeinsame Verarbeitungskette

Das System verwendet **eine gemeinsame Verarbeitungskette** mit einem Processing Chest für alle Materialien:

| Vorteil | Beschreibung |
|---------|--------------|
| **Einfachheit** | Eine Konfiguration, ein Inventar |
| **Flexibilität** | Verschiedene Materialien können gleichzeitig verarbeitet werden |
| **Wartbarkeit** | Weniger Peripherals zu konfigurieren |

**Alternative (nicht implementiert):** Separate Ketten mit jeweils eigenem Processing Chest für z.B. Netherrack-basierte Verarbeitung.

---

## Materialverarbeitungskette

### Hauptkette

```
Cobblestone → Dirt → Gravel → Sand → Dust
```

Jede Stufe wird durch einen Hammer verarbeitet. Die Kette ist konfigurierbar.

### Zusätzliche Basismaterialien

Neben der Hauptkette gibt es weitere Basismaterialien, die separat gehandhabt werden können:

- **Soul Sand** - Für Nether-bezogene Rezepte
- **Netherrack** - Für Nether-bezogene Rezepte
- **End Stone** - Für End-bezogene Rezepte

Diese Materialien können in eigenen Ketten oder als Endprodukte konfiguriert werden.

---

## Hardware-Erweiterung

Zusätzlich zum Standard-Setup (siehe [system.md](./system.md)) benötigt das Processing-System:

### Zusätzliche Komponenten

| Komponente | Beschreibung |
|------------|--------------|
| **Processing Chest** | Truhe als Input für das Pipe-System |
| **Pipes/Hopper** | Transportieren Material zu Hämmern und zurück |
| **Hämmer** | Verarbeiten die Materialien |

### Inventar-Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MATERIALFLUSS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Cobblestone-Generator]                                        │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────┐                                        │
│  │   BASISINVENTAR     │ ◄────────────────────────────────┐     │
│  │ (Drawer Controller) │                                  │     │
│  └──────────┬──────────┘                                  │     │
│             │                                             │     │
│             │ Computer prüft Schwellwerte                 │     │
│             │ und transferiert 1 Stack                    │     │
│             ▼                                             │     │
│  ┌─────────────────────┐                                  │     │
│  │  PROCESSING CHEST   │                                  │     │
│  │   (Input-Kiste)     │                                  │     │
│  └──────────┬──────────┘                                  │     │
│             │                                             │     │
│             │ Pipes verteilen auf Hämmer                  │     │
│             ▼                                             │     │
│  ┌─────────────────────┐                                  │     │
│  │      HÄMMER         │                                  │     │
│  │  ┌───┐ ┌───┐ ┌───┐  │                                  │     │
│  │  │ H │ │ H │ │ H │  │  (Mehrere parallel)              │     │
│  │  └───┘ └───┘ └───┘  │                                  │     │
│  └──────────┬──────────┘                                  │     │
│             │                                             │     │
│             │ Pipes führen Output zurück                  │     │
│             └─────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Detaillierter Ablauf

1. **Cobblestone-Generator** produziert kontinuierlich Cobblestone
2. Cobblestone wird (z.B. per Hopper) ins **Basisinventar** transportiert
3. **Computer** scannt das Basisinventar und prüft Schwellwerte
4. Wenn Bedingungen erfüllt: Computer transferiert 1 Stack zur **Processing Chest**
5. **Pipes** verteilen das Material auf verfügbare **Hämmer**
6. Hämmer verarbeiten das Material (Cobblestone → Dirt, etc.)
7. **Pipes** transportieren das Ergebnis zurück ins **Basisinventar**
8. Kreislauf beginnt von vorne

---

## Konfiguration

### Globale Konstante

```typescript
const STACK_SIZE = 64;  // Standard Minecraft Stack-Größe
```

### Processing-Konfiguration

```typescript
processing: {
    enabled: true,

    // Mindestmenge in Items, die IMMER im Lager bleiben muss
    // Beispiel: 2 * STACK_SIZE = 128 Items werden nie unterschritten
    minInputReserve: 2 * STACK_SIZE,

    // Maximale Menge in Items, ab der keine Produktion mehr stattfindet
    // Beispiel: 4 * STACK_SIZE = 256 Items stoppt die Produktion
    maxOutputStock: 4 * STACK_SIZE,

    // Verarbeitungskette: Input → Output
    chain: {
        "minecraft:cobblestone": "minecraft:dirt",
        "minecraft:dirt": "minecraft:gravel",
        "minecraft:gravel": "minecraft:sand",
        "minecraft:sand": "exnihilo:dust",
    },
}
```

### Peripheral-Konfiguration

```typescript
peripherals: {
    // ... andere Peripherals ...

    processingChest: {
        name: "minecraft:chest_10",  // Name im Wired Network
        type: "chest",
    },
}
```

---

## Verarbeitungslogik

### Algorithmus

```
FÜR JEDES (inputItem → outputItem) IN chain:

    1. PRÜFE: Hat Processing Chest noch Platz?
       WENN NEIN → Überspringe restliche Kette (break)

    2. LESE Schwellwerte aus Config:
       - minInputReserve (z.B. 2 * STACK_SIZE = 128)
       - maxOutputStock (z.B. 4 * STACK_SIZE = 256)
       - benötigt = minInputReserve + STACK_SIZE

    3. PRÜFE: inputMenge >= benötigt?
       WENN NEIN → Überspringe dieses Material (continue)

    4. PRÜFE: outputMenge < maxOutputStock?
       WENN NEIN → Überspringe dieses Material (continue)

    5. FINDE ersten Slot mit inputItem
       WENN NICHT GEFUNDEN → Überspringe (continue)

    6. VERIFIZIERE Slot (Race Condition Protection):
       - Lese Slot-Inhalt erneut
       - Prüfe ob Item noch vorhanden

    7. TRANSFERIERE STACK_SIZE Items (64):
       - pushItems(processingChestName, slot, STACK_SIZE)
       - Prüfe Rückgabewert > 0

    8. AKTUALISIERE lokales Inventory-Tracking

    9. LOGGE Transfer (bei Debug-Level)

ENDE FÜR
```

### Schwellwert-Berechnung

```
Konfiguration:
  minInputReserve: 2 * STACK_SIZE   // = 128 Items
  maxOutputStock: 4 * STACK_SIZE    // = 256 Items

Berechnung:
  benötigt = minInputReserve + STACK_SIZE = 128 + 64 = 192 Items

Beispiel Cobblestone → Dirt:
  - Cobblestone im Lager: 250
  - Dirt im Lager: 100

  Prüfung:
  - 250 >= 192? ✓ JA (genug Cobblestone)
  - 100 < 256? ✓ JA (Dirt unter Maximum)

  → Transfer von 64 Cobblestone zur Processing Chest
```

### Warum minInputReserve + STACK_SIZE?

Die Berechnung `benötigt = minInputReserve + STACK_SIZE` stellt sicher, dass:
1. **Nach** dem Transfer noch mindestens `minInputReserve` Items übrig sind
2. Wir immer einen **kompletten Stack** transferieren können

### Platzverfügbarkeitsprüfung

Bevor ein Material verarbeitet wird, prüft das System ob die Processing Chest Platz hat:

```typescript
function hasAvailableSpace(processingChest: InventoryPeripheral): boolean {
    const size = processingChest.size();      // Gesamtanzahl Slots
    const items = processingChest.list();     // Aktuelle Belegung

    // Zähle belegte Slots
    let occupied = 0;
    for (const [, item] of pairs(items)) {
        if (item && item.count > 0) {
            occupied++;
        }
    }

    return occupied < size;  // true wenn mind. 1 Slot frei
}
```

**Wichtig:** Die Prüfung erfolgt **vor jedem Material** in der Kette. Sobald die Chest voll ist, wird die **gesamte restliche Kette übersprungen** (`break`), nicht nur das aktuelle Material.

---

## Edge Cases

### Processing Chest ist voll

**Situation:** Die Processing Chest hat keine freien Slots mehr.

**Handling:**
- Restliche Kette wird übersprungen (`break`)
- Im nächsten Loop-Durchlauf wird erneut geprüft
- Log-Meldung (Debug-Level): "Processing chest full, skipping remaining chain"

### Mehrere Materialien gleichzeitig

**Situation:** Die Processing Chest enthält bereits andere Materialien.

**Handling:**
- **Erlaubt:** Processing Chest kann verschiedene Materialien gleichzeitig enthalten
- Jedes Material wird unabhängig verarbeitet
- Pipes/Hopper verteilen automatisch auf die richtigen Hämmer
- Erst wenn alle Slots voll sind, wird die Verarbeitung pausiert

### Nicht genug Input-Material

**Situation:** Cobblestone ist unter dem Minimum (z.B. nur 100 statt 192).

**Handling:**
- Dieses Material wird übersprungen (`continue`)
- Andere Materialien in der Kette werden weiter geprüft
- Kein Fehler, normaler Betrieb

### Output-Material am Maximum

**Situation:** Dirt hat bereits 300 Items (über dem Maximum von 256).

**Handling:**
- Keine weitere Dirt-Produktion
- Andere Materialien werden weiter geprüft
- Produktion startet automatisch wieder wenn Dirt verbraucht wird

### Race Condition (Slot geändert)

**Situation:** Zwischen Prüfung und Transfer wurde der Slot-Inhalt geändert.

**Handling:**
- Transfer wird abgebrochen
- Fehlercode: `ERR_SLOT_CHANGED`
- Kette wird mit nächstem Material fortgesetzt

### Netzwerk-Fehler

**Situation:** Processing Chest ist nicht erreichbar.

**Handling:**
- Fehlercode: `ERR_PROCESSING_CHEST_MISSING`
- Warning wird geloggt
- Processing-Phase wird übersprungen
- Distributor läuft normal weiter

---

## Integration

### Position im Main-Loop

```
Main Loop:
┌─────────────────────────────────────────┐
│ Phase 1: Scan Unearthers                │
│ Phase 2: Get Inventory Contents         │
│ ─────────────────────────────────────── │
│ Phase 2.5: MATERIAL PROCESSING ◄── HIER │
│ ─────────────────────────────────────── │
│ Phase 3: Process Empty Unearthers       │
│ Phase 4: Update State                   │
│ Phase 5: Sleep                          │
└─────────────────────────────────────────┘
```

### Warum VOR dem Distributor?

1. **Sicherstellung von Material:** Processing läuft zuerst, damit genug Material für Distribution vorhanden ist
2. **Inventory-Aktualität:** Nach Processing wird Inventory neu gescannt für aktuelle Werte
3. **Unabhängigkeit:** Processing-Fehler beeinflussen Distributor nicht

### Sequenzielle Ausführung

Processing und Distribution laufen **sequenziell** im gleichen Loop, nicht parallel. Dies verhindert Race Conditions beim Inventory-Zugriff.

### Inventory-Re-Scan

Nach erfolgreichen Processing-Transfers wird das Inventar **neu gescannt**, bevor die Distribution-Phase beginnt:

```typescript
if (processingRes.ok && processingRes.value.length > 0) {
    // Re-scan inventory after processing
    const updatedContentsRes = getInventoryContents(peripherals.materialSource);
    if (updatedContentsRes.ok) {
        inventoryContents = updatedContentsRes.value;
    }
}
```

---

## Konfigurationsbeispiele

### Minimale Konfiguration

```typescript
processing: {
    enabled: true,
    minInputReserve: 1 * STACK_SIZE,  // 64 Items Reserve
    maxOutputStock: 2 * STACK_SIZE,   // Max 128 Items
    chain: {
        "minecraft:cobblestone": "minecraft:gravel",
    },
}
```

### Vollständige Kette

```typescript
processing: {
    enabled: true,
    minInputReserve: 2 * STACK_SIZE,   // 128 Items Reserve
    maxOutputStock: 4 * STACK_SIZE,    // Max 256 Items
    chain: {
        "minecraft:cobblestone": "minecraft:dirt",
        "minecraft:dirt": "minecraft:gravel",
        "minecraft:gravel": "minecraft:sand",
        "minecraft:sand": "exnihilo:dust",
    },
}
```

### Große Lagerbestände

```typescript
processing: {
    enabled: true,
    minInputReserve: 3 * STACK_SIZE,   // 192 Items Reserve
    maxOutputStock: 10 * STACK_SIZE,   // Max 640 Items
    chain: {
        "minecraft:cobblestone": "minecraft:dirt",
    },
}
```

### Deaktiviert

```typescript
processing: {
    enabled: false,
    minInputReserve: 0,
    maxOutputStock: 0,
    chain: {},
}
```

---

## Verwandte Dokumentation

- **Systemarchitektur:** [system.md](./system.md)
- **Unearther Distribution:** [unearther-distribution.md](./unearther-distribution.md)
