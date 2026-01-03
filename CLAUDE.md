# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CC:Tweaked computer-based distributor that compiles TypeScript to Lua using TypeScriptToLua. The system manages unearther machines by distributing materials from a central storage to input chests via wired modem network.

### Material Processing System

The system includes an automated material processing chain for hammer-based transformation:

```
Cobblestone → Dirt → Gravel → Sand → Dust
```

**How it works:**
- Computer monitors stock levels in the central storage (Drawer Controller)
- When input material exceeds reserve threshold and output is below maximum, transfers 1 stack to processing chest
- External pipe system handles distribution to hammers and return of processed materials

**See `docs/material-processing.md` for detailed documentation.**

## Build Commands

```bash
npm run build       # Lint + compile TS to main.lua (runs prebuild automatically)
npm run typecheck   # Type-check only (no emit)
npm run lint        # Typecheck + ESLint
npm run lint:fix    # Typecheck + ESLint with auto-fix
```

Output: `dist/main.lua` (bundled entry point for CC:Tweaked).

## Architecture

### Entry Point
- `src/main.ts` - Boot sequence, main loop (scan → process → distribute → sleep)

### Configuration (`src/`)
- `config.ts` - Runtime configuration (peripherals, materials, unearthers, processing)
  - `peripherals.processingChest` - Processing chest for hammer chain input
  - `processing.chain` - Input→Output material mappings
  - `processing.minInputReserveStacks` / `maxOutputStacks` - Thresholds in stacks (× 64)
- `types.ts` - All TypeScript interfaces (`AppConfig`, `ProcessingConfig`, `UneartherInstance`, etc.)

### Core (`src/core/`)
- `result.ts` - `Result<T>` pattern used throughout (`ok()`, `okNoop()`, `err()`)
- `errors.ts` - Error codes (`ResultCode` type)
- `logger.ts` - Structured logging with level support (debug, info, warn, error)

### Engine (`src/engine/`)
- `scanner.ts` - Scans unearthers and material source via wired modem
- `scheduler.ts` - Weighted material selection for distribution
- `transfer.ts` - Item transfer operations to unearthers
- `processing.ts` - Material processing chain (Cobblestone→Dirt→Gravel→Sand→Dust)

### Registry (`src/registry/`)
- `peripheral.ts` - Peripheral validation and wrapping (modem, inventories, monitor)

### Documentation (`docs/`)
- `material-processing.md` - Detailed documentation of the material processing system

## Key Patterns

- **Config-first**: Stations and peripherals are defined in `config.ts`, validated against wired network at boot
- **Result pattern**: All functions return `Result<T>` with `.ok`, `.code`, `.value` or `.detail`
- **No implicit self**: TSTL configured with `noImplicitSelf: true` (no Lua `self` parameter)

## TSTL Specifics

- Target: `CC-5.2` (ComputerCraft Lua)
- Types: `@jackmacwindows/lua-types/cc-5.2`, `craftos-types`, `cc-types`
- Bundle mode: All TS compiled into single `main.lua`

### Peripheral Types & @noSelf

CC:Tweaked peripherals use **function-call syntax** (`.`) instead of method-call syntax (`:`).
We use `@jackmacwindows/craftos-types` which provides properly annotated interfaces with `@noSelf`.

**Why this matters:**
- TSTL default for interface methods: `obj:method()` (passes `self` as first argument)
- CC:Tweaked expects: `obj.method()` (no `self` parameter)
- Without `@noSelf`: Runtime error `bad argument #1 (number expected, got table)`

**Example of the problem:**
```typescript
// If you define your own interface WITHOUT @noSelf:
interface MyInventory {
    getItemDetail(slot: number): ItemDetail;
}
// TSTL generates: inventory:getItemDetail(slot)
// CC:Tweaked receives: getItemDetail(self, slot) -- WRONG!
// Error: "bad argument #1 (number expected, got table)"
```

**Solution:** Use the global types from `craftos-types` (declared via tsconfig `types` array):
```typescript
// These types are globally available - no import needed!
// InventoryPeripheral, WiredModemPeripheral, MonitorPeripheral, WriteFileHandle

function wrapInventory(name: string): InventoryPeripheral {
    return peripheral.wrap(name) as InventoryPeripheral;
}
```

**Do NOT define custom peripheral interfaces in `src/types.ts`!**
The `craftos-types` package uses `@noSelfInFile` annotation which tells TSTL to generate `.` calls.

**Note:** These types are globally declared (via `declare class`), not module exports.
You cannot import them - they are available automatically through the tsconfig `types` configuration.
