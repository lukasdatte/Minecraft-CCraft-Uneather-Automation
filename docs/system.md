# Systemarchitektur

Dieses Dokument beschreibt die gemeinsame Systemarchitektur des CC:Tweaked-basierten Unearther Distribution Systems. Die hier beschriebenen Komponenten und Abläufe werden von allen Subsystemen (Distribution, Processing) gemeinsam genutzt.

## Inhaltsverzeichnis

- [Hardware-Setup](#hardware-setup)
- [Wired-Modem-Netzwerk](#wired-modem-netzwerk)
- [Boot-Sequenz](#boot-sequenz)
- [Hauptschleife](#hauptschleife)
- [Inventar-Scanning](#inventar-scanning)
- [Result-Pattern](#result-pattern)
- [Race-Condition-Schutz](#race-condition-schutz)
- [Logging](#logging)
- [Konfigurationsstruktur](#konfigurationsstruktur)

---

## Hardware-Setup

### Komponenten

| Komponente | Beschreibung | Pflicht |
|------------|--------------|---------|
| **CC:Tweaked Computer** | Zentraler Controller (kein Turtle!) | Ja |
| **Wired Modem** | Am Computer angeschlossen (Seite konfigurierbar) | Ja |
| **Netzwerkkabel** | Verbindet alle Peripheriegeräte | Ja |
| **Drawer Controller** | Zentrales Lager für alle Materialien | Ja |
| **Input-Chests** | Je eine Truhe pro Unearther (Zuführung) | Ja |
| **Processing Chest** | Truhe als Input für Hammer-Verarbeitung | Optional |
| **Monitor** | Statusanzeige (scrollender Log-Buffer) | Optional |

### Warum stationärer Computer statt Turtle?

| Aspekt | Turtle-Lösung | Stationäre Lösung |
|--------|---------------|-------------------|
| Komplexität | Hoch (Navigation, Pose, Fuel) | Niedrig (nur Netzwerk) |
| Geschwindigkeit | Langsam (physisch fahren) | Schnell (sofortiger Transfer) |
| Zuverlässigkeit | Anfällig (Blockierung, Chunk-Unload) | Robust (Netzwerk-basiert) |
| Erweiterbarkeit | Aufwändig (Routen anpassen) | Einfach (Chest ans Netz) |

---

## Wired-Modem-Netzwerk

### Warum Wired statt Wireless?

In CC:Tweaked sind **Remote-Peripheral-APIs nur über Wired-Modems** verfügbar:

- `peripheral.wrap(remoteName)` - Entferntes Peripheral wrappen
- `modem.getNamesRemote()` - Alle Remote-Peripherals auflisten
- `modem.isPresentRemote(name)` - Prüfen ob Peripheral online ist
- `inventory.pushItems(targetName, slot, count)` - Items direkt transferieren

**Wireless-Modems** unterstützen nur:
- Nachrichten (rednet/transmit)
- GPS-Ortung

### Netzwerk-Topologie

```
[Computer]
    |
[Wired Modem] ─────┬─────────────────┬──────────────────┬───────────────┐
                   |                 |                  |               |
            [Drawer Controller] [Input-Chest 1]  [Processing Chest]  [Monitor]
             (materialSource)    (Unearther 1)      (optional)       (optional)
```

### Anforderungen

- Alle Inventare benötigen ein **Wired Modem**
- Alle Modems müssen mit **Networking Cable** verbunden sein
- Der Computer muss ein Wired Modem an einer **konfigurierten Seite** haben

---

## Boot-Sequenz

Beim Start durchläuft das System eine strukturierte Validierung:

```
1. Config laden
   └─► Statische Konfiguration aus config.ts

2. Logger initialisieren (ohne Monitor)
   └─► Log-Level aus Config (debug/info/warn/error)

3. Phase 1: Peripherals validieren
   ├─► Wired Modem auf konfigurierter Seite prüfen
   │   └─► Muss existieren und darf NICHT wireless sein
   ├─► Material Source (Drawer Controller) erreichbar?
   │   └─► Muss list() und pushItems() unterstützen
   ├─► Alle Unearther Input-Chests erreichbar?
   │   └─► Für jeden konfigurierten Unearther
   ├─► Processing Chest erreichbar? (optional)
   │   └─► Nur wenn processing.enabled = true
   │   └─► Bei Fehler: Warning, Processing wird deaktiviert
   └─► Config-Konsistenz prüfen
       ├─► Alle UneartherTypes existieren?
       └─► Alle referenzierten Materials existieren?

4. Phase 1.5: Logger mit Monitor initialisieren
   └─► Falls Monitor konfiguriert und erreichbar
   └─► Bei Fehler: Warning, weiter ohne Monitor

5. Phase 2: Scheduler erstellen
   └─► WeightedScheduler für Materialauswahl

6. Phase 3: Initial-State erstellen
   └─► Leerer Status für alle Unearthers (isEmpty: false)

7. Konfigurationsübersicht loggen
   └─► Anzahl Unearthers, Materials, Types, Scan-Intervall

8. Hauptschleife starten
```

### Fehler bei Boot

| Fehler | Verhalten |
|--------|-----------|
| Fehlendes/falsches Modem | **Abbruch** - System kann nicht starten |
| Material Source offline | **Abbruch** - Kein Zugriff auf Materialien |
| Unearther-Chest offline | **Abbruch** - Unvollständige Konfiguration |
| Processing Chest offline | **Warning** - Processing wird deaktiviert, Distribution läuft |
| Monitor offline | **Warning** - Weiter ohne Monitor-Ausgabe |

---

## Hauptschleife

Die Hauptschleife läuft kontinuierlich mit konfigurierbarem Intervall. **Wichtig:** Die Schleife enthält mehrere Early-Exit-Punkte, bei denen sie vorzeitig zum Sleep springt.

```
┌──────────────────────────────────────────────────────────────────┐
│                        HAUPTSCHLEIFE                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  loopStart = os.epoch("utc")  ◄── Zeitmessung für adaptives Sleep│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ PHASE 1: SCAN UNEARTHERS                                │    │
│  │ scanAllUnearthers(config, modem)                        │    │
│  │  ├─► Für jeden Unearther: Input-Chest remote wrappen   │    │
│  │  ├─► inventory.list() aufrufen                         │    │
│  │  └─► Ergebnis: Liste leerer Unearthers                 │    │
│  │                                                         │    │
│  │  ⚠ EARLY EXIT: Wenn Scan fehlschlägt → sleep & continue│    │
│  │  ⚠ EARLY EXIT: Wenn keine leeren → sleep & continue    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ PHASE 2: INVENTAR LESEN                                 │    │
│  │ getInventoryContents(materialSource)                    │    │
│  │  └─► Map<itemId, {totalCount, slots[]}>                │    │
│  │                                                         │    │
│  │  ⚠ EARLY EXIT: Wenn Scan fehlschlägt → sleep & continue│    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ PHASE 2.5: MATERIAL PROCESSING (optional)               │    │
│  │ runProcessingPhase(...)                                 │    │
│  │  ├─► Nur wenn processing.enabled = true                │    │
│  │  ├─► Transferiert Material zur Processing Chest        │    │
│  │  └─► Nach erfolgreichen Transfers: Inventar NEU SCANNEN│    │
│  │                                                         │    │
│  │  Siehe: material-processing.md                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ PHASE 3: DISTRIBUTION                                   │    │
│  │ processEmptyUnearthers(...)                             │    │
│  │  ├─► Für jeden leeren Unearther:                       │    │
│  │  │   ├─► scheduler.selectMaterial()                    │    │
│  │  │   ├─► transferToUnearther()                         │    │
│  │  │   └─► Inventar-Tracking aktualisieren               │    │
│  │                                                         │    │
│  │  Siehe: unearther-distribution.md                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ PHASE 4: STATE UPDATE                                   │    │
│  │ updateState(state, transfers)                           │    │
│  │  ├─► isEmpty-Status aktualisieren                      │    │
│  │  ├─► lastMaterial speichern                            │    │
│  │  ├─► lastTransferTime setzen (os.epoch("utc"))         │    │
│  │  └─► totalTransfers inkrementieren                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ PHASE 5: SLEEP                                          │    │
│  │                                                         │    │
│  │  elapsed = (os.epoch("utc") - loopStart) / 1000        │    │
│  │  └─► Division durch 1000: Millisekunden → Sekunden     │    │
│  │                                                         │    │
│  │  sleepTime = max(0.1, scanIntervalSeconds - elapsed)   │    │
│  │  └─► Minimum 0.1s um CPU nicht zu blockieren           │    │
│  │                                                         │    │
│  │  sleep(sleepTime)                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│              ←── Nächste Iteration ──                           │
└──────────────────────────────────────────────────────────────────┘
```

### Timing-Details

| Parameter | Beschreibung |
|-----------|--------------|
| `os.epoch("utc")` | Gibt Millisekunden seit Unix-Epoch zurück |
| `/ 1000` | Konvertiert Millisekunden zu Sekunden |
| `scanIntervalSeconds` | Konfiguriertes Intervall (Standard: 2 Sekunden) |
| `max(0.1, ...)` | Garantiert mindestens 0.1s Sleep, auch wenn Loop länger dauerte |

### Early-Exit-Bedingungen

Das System springt vorzeitig zum Sleep wenn:

1. **Scan fehlschlägt** (`!scanRes.ok`) - z.B. Netzwerkfehler
2. **Keine leeren Unearthers** (`emptyUnearthers.length === 0`) - Nichts zu tun
3. **Inventar-Scan fehlschlägt** (`!contentsRes.ok`) - Kann nicht verteilen

Dies verhindert unnötige Verarbeitung und spart Ressourcen.

---

## Inventar-Scanning

### Definition: "Leeres Inventar"

Ein Inventar gilt als **leer**, wenn es **keine Items mit count > 0** enthält:

```typescript
function isInventoryEmpty(inv: InventoryPeripheral): boolean {
    const items = inv.list();  // Gibt LuaTable zurück
    for (const [, item] of pairs(items)) {
        if (item && item.count > 0) {
            return false;  // Mindestens 1 Item gefunden
        }
    }
    return true;  // Keine Items mit count > 0
}
```

### Warum Iteration statt length-Check?

In Lua/CC:Tweaked gibt `inventory.list()` eine **sparse table** zurück - leere Slots sind nicht enthalten. Daher muss man iterieren und auf `count > 0` prüfen.

### Inventar-Contents-Struktur

```typescript
// Ergebnis von getInventoryContents()
Map<itemId, InventoryItemInfo>

interface InventoryItemInfo {
    totalCount: number;  // Gesamtanzahl über alle Slots
    slots: number[];     // Liste der Slot-Nummern mit diesem Item
}

// Beispiel:
{
    "minecraft:sand" => { totalCount: 512, slots: [3, 7, 12] },
    "minecraft:gravel" => { totalCount: 128, slots: [5] }
}
```

---

## Result-Pattern

Alle Funktionen verwenden ein einheitliches Result-Pattern für Fehlerbehandlung. **Keine Exceptions** - alle Fehler werden explizit als Rückgabewert behandelt.

```typescript
type Result<T> =
  | { ok: true; code: "OK" | "OK_NOOP"; value: T }
  | { ok: false; code: ResultCode; detail?: unknown }

// Erfolgreich mit Wert
ok<T>(value: T): Result<T>

// Erfolgreich, aber keine Aktion nötig (z.B. nichts zu verarbeiten)
okNoop<T>(value: T): Result<T>

// Fehler mit Code und optionalem Detail
err<T>(code: ResultCode, detail?: unknown): Result<T>
```

### Verwendung

```typescript
const result = scanAllUnearthers(config, modem);
if (!result.ok) {
    log.error("Scan failed", { code: result.code });
    return;  // Early exit
}
const data = result.value;  // Type-safe Zugriff
```

### Vollständige Fehlercode-Referenz

#### Success Codes

| Code | Beschreibung |
|------|--------------|
| `OK` | Operation erfolgreich abgeschlossen |
| `OK_NOOP` | Erfolgreich, aber keine Aktion nötig |

#### Peripheral-Fehler

| Code | Beschreibung |
|------|--------------|
| `ERR_PERIPHERAL_OFFLINE` | Peripheral ist offline oder nicht verbunden |
| `ERR_PERIPHERAL_NOT_INVENTORY` | Peripheral hat keine Inventory-Methoden (list, pushItems) |
| `ERR_PERIPHERAL_WRONG_TYPE` | Peripheral-Typ stimmt nicht mit Erwartung überein |
| `ERR_MODEM_MISSING` | Wired Modem nicht auf konfigurierter Seite gefunden |
| `ERR_MODEM_WIRELESS` | Gefundenes Modem ist wireless, nicht wired |
| `ERR_MATERIAL_SOURCE_MISSING` | Material Source (Drawer/Chest) nicht gefunden |

#### Konfigurations-Fehler

| Code | Beschreibung |
|------|--------------|
| `ERR_CONFIG_INVALID` | Konfiguration ist ungültig |
| `ERR_UNKNOWN_MATERIAL` | Referenzierte Material-ID existiert nicht |
| `ERR_UNKNOWN_UNEARTHER_TYPE` | Referenzierter Unearther-Typ existiert nicht |
| `ERR_UNKNOWN_UNEARTHER` | Referenzierte Unearther-ID existiert nicht |

#### Inventar/Transfer-Fehler

| Code | Beschreibung |
|------|--------------|
| `ERR_INVENTORY_EMPTY` | Inventar ist leer |
| `ERR_INSUFFICIENT_STOCK` | Nicht genug Material (unter Minimum) |
| `ERR_TRANSFER_FAILED` | Item-Transfer hat 0 Items übertragen |
| `ERR_NO_SLOT_FOUND` | Kein Slot mit dem gesuchten Item gefunden |

#### Scan-Fehler

| Code | Beschreibung |
|------|--------------|
| `ERR_SCAN_FAILED` | Inventar-Scan konnte nicht durchgeführt werden |

#### Race-Condition-Fehler

| Code | Beschreibung |
|------|--------------|
| `ERR_SLOT_CHANGED` | Slot-Inhalt hat sich zwischen Prüfung und Transfer geändert |

#### Processing-Fehler

| Code | Beschreibung |
|------|--------------|
| `ERR_PROCESSING_DISABLED` | Processing ist in Config deaktiviert |
| `ERR_PROCESSING_CHEST_MISSING` | Processing Chest nicht gefunden oder offline |
| `ERR_PROCESSING_CHEST_FULL` | Processing Chest hat keinen freien Platz mehr |
| `ERR_INPUT_BELOW_RESERVE` | Input-Material würde unter Reserve-Minimum fallen |
| `ERR_OUTPUT_AT_MAX` | Output-Material bereits bei/über Maximum |

#### Allgemeine Fehler

| Code | Beschreibung |
|------|--------------|
| `ERR_IO` | Allgemeiner I/O-Fehler |

---

## Race-Condition-Schutz

### Problem

Zwischen Inventar-Scan und Transfer können externe Systeme (Pipes, Hopper, andere Computer) den Slot-Inhalt ändern:

1. Computer scannt Slot 5: "64x Sand"
2. Externes System nimmt Sand aus Slot 5
3. Computer versucht Transfer aus Slot 5 → falsches Item oder leer

### Lösung: Slot-Verifizierung mit pcall()

Vor jedem Transfer wird der Slot-Inhalt erneut geprüft. **Wichtig:** Alle Peripheral-Aufrufe sind in `pcall()` gewrappt, um Lua-Errors abzufangen.

```typescript
// 1. Slot verifizieren (mit pcall für Error-Handling)
const [detailSuccess, currentItem] = pcall(() =>
    materialSource.getItemDetail(sourceSlot)
) as LuaMultiReturn<[boolean, ItemDetail | null]>;

// pcall fehlgeschlagen → Peripheral-Problem
if (!detailSuccess || !currentItem) {
    return err("ERR_SLOT_CHANGED", { slot: sourceSlot });
}

// Item stimmt nicht überein → Race Condition
if (currentItem.name !== expectedItemId) {
    return err("ERR_SLOT_CHANGED", {
        slot: sourceSlot,
        expected: expectedItemId,
        actual: currentItem.name
    });
}

// 2. Transfer durchführen (auch mit pcall)
const [transferSuccess, transferred] = pcall(() =>
    materialSource.pushItems(targetChest, sourceSlot, stackSize)
) as LuaMultiReturn<[boolean, number]>;

if (!transferSuccess || transferred === 0) {
    return err("ERR_TRANSFER_FAILED", { slot: sourceSlot });
}
```

### Warum pcall()?

In Lua/CC:Tweaked können Peripheral-Aufrufe jederzeit fehlschlagen (z.B. wenn das Peripheral während des Aufrufs entfernt wird). `pcall()` (protected call) fängt diese Fehler ab und gibt stattdessen `false` als ersten Rückgabewert zurück.

### Anwendung

Dieses Pattern wird verwendet in:
- `transferToUnearther()` - Distribution (src/engine/transfer.ts)
- `transferToProcessingChest()` - Processing (src/engine/processing.ts)

---

## Logging

### Logger-Interface

```typescript
// Verfügbare Methoden
log.debug(message: string, data?: object): void
log.info(message: string, data?: object): void
log.warn(message: string, data?: object): void
log.error(message: string, data?: object): void
```

### Log-Level

| Level | Beschreibung | Beispiele |
|-------|-------------|-----------|
| `debug` | Alle Details | Slot-Nummern, Item-Mengen, Peripheral-Listen |
| `info` | Wichtige Ereignisse | Transfers, Scan-Ergebnisse, Boot-Status |
| `warn` | Nicht-kritische Probleme | Material nicht verfügbar, optionales Peripheral offline |
| `error` | Kritische Fehler | Pflicht-Peripheral offline, Config ungültig |

### Format

```
[LEVEL] HH:MM Message {key: value, ...}
```

### Beispiele

```
[INFO]  14:32 Boot sequence starting...
[DEBUG] 14:32 Wired modem found {side: "left"}
[DEBUG] 14:32 Remote peripherals found {count: 5, names: ["storagedrawers:controller_0", ...]}
[INFO]  14:32 Material source validated {name: "storagedrawers:controller_0"}
[WARN]  14:32 Monitor not available, continuing without {name: "monitor_0"}
[INFO]  14:32 === Starting main loop ===
[INFO]  14:32 Scan complete {total: 3, empty: 1}
[DEBUG] 14:32 Selected material {unearther: "u1", material: "sand", weight: 3}
[INFO]  14:32 Transfer complete {unearther: "u1", material: "sand", items: 64}
[ERROR] 14:35 Peripheral offline {name: "minecraft:chest_5"}
```

### Monitor-Output (optional)

Falls ein Monitor konfiguriert **und erreichbar** ist:

- Scrollender 20-Zeilen Buffer
- Farbcodierung nach Log-Level (rot für error, gelb für warn, etc.)
- Separater Status-Bereich für aktuelle Statistiken

**Wenn kein Monitor konfiguriert oder offline:** System läuft normal weiter, nur Terminal-Output.

---

## Konfigurationsstruktur

### Config-First-Prinzip

Alle Einstellungen werden **deklarativ in `config.ts`** definiert. Das System führt keine Auto-Discovery durch, sondern validiert nur, dass die konfigurierten Peripherals existieren.

### Struktur

```typescript
interface AppConfig {
    peripherals: PeripheralRegistry;    // Hardware-Referenzen
    materials: MaterialRegistry;         // Verfügbare Materialien
    uneartherTypes: UneartherTypeRegistry;  // Typen-Definitionen
    unearthers: UneartherRegistry;      // Konkrete Instanzen
    system: SystemConfig;               // Allgemeine Einstellungen
    processing?: ProcessingConfig;      // Optional: Verarbeitungskette
}
```

### Peripherals

```typescript
peripherals: {
    modem: {
        name: "left",                          // Seite am Computer (left/right/top/bottom/front/back)
        type: "modem",
    },
    materialSource: {
        name: "storagedrawers:controller_0",   // Drawer Controller - Peripheral-Name im Netzwerk
        type: "drawer_controller",
    },
    monitor: {                                  // OPTIONAL - System läuft ohne
        name: "monitor_0",
        type: "monitor",
    },
    processingChest: {                         // OPTIONAL - Nur für Processing-Feature
        name: "minecraft:chest_10",
        type: "chest",
    },
}
```

### System

```typescript
system: {
    scanIntervalSeconds: 2,    // Loop-Intervall in Sekunden
    transferStackSize: 64,     // Items pro Transfer (siehe unten)
    logLevel: "info",          // Logging-Verbosity (debug/info/warn/error)
}
```

#### transferStackSize erklärt

| Wert | Bedeutung |
|------|-----------|
| `64` | Standard Minecraft Stack-Größe |
| `32` | Für Items die nur 32 stacken (z.B. Eier) |
| `16` | Für Items die nur 16 stacken (z.B. Ender Pearls) |

**Empfehlung:** Bei 64 belassen, es sei denn du verarbeitest spezielle Items.

### Konstanten

```typescript
const STACK_SIZE = 64;  // Standard Minecraft Stack-Größe

// Verwendung in Processing-Config:
minInputReserve: 2 * STACK_SIZE,   // = 128 Items (2 Stacks Reserve)
maxOutputStock: 4 * STACK_SIZE,    // = 256 Items (4 Stacks Maximum)
```

---

## Verwandte Dokumentation

- **Unearther Distribution:** [unearther-distribution.md](./unearther-distribution.md)
- **Material Processing:** [material-processing.md](./material-processing.md)
- **Build Commands:** [../CLAUDE.md](../CLAUDE.md)
