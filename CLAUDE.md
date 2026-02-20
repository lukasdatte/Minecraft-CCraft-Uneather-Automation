# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CC:Tweaked computer-based automation system that compiles TypeScript to Lua using TypeScriptToLua (TSTL). Uses a modular orchestrator architecture to manage machines (hammers, unearthers) by distributing materials from central storage to input chests via wired modem network.

### Systems

**Production (Hammer Chain):** Cobblestone → Gravel → Dirt → Sand → Dust
- Stock-based scheduler assigns recipes to machines by output urgency
- Pipes behind processing chest distribute to physical hammers

**Distribution (Unearthers):** Weighted random material selection for unearther types
- Each unearther type (archaeologist, geologist, dimensionalist) has different supported materials

## Build Commands

```bash
npm run build       # Lint + compile TS to unearther.lua (runs prebuild automatically)
npm run typecheck   # Type-check only (no emit)
npm run lint        # Typecheck + ESLint
npm run lint:fix    # Typecheck + ESLint with auto-fix
```

Output: `dist/unearther.lua` (bundled entry point for CC:Tweaked).

## Architecture (4-Layer)

```
Layer 4: entries/     ← Per-computer entry points + config
Layer 3: apps/        ← Concrete systems (production, distribution)
Layer 2: lib/         ← Shared reusable modules
Layer 1: core/        ← Universal utilities
```

Dependency rule: Only downward, never upward.

### Layer 1: Core (`src/core/`)
- `result.ts` - `Result<T>` pattern (`ok()`, `okNoop()`, `err()`, `forwardErr()`)
- `errors.ts` - Error codes (`ResultCode` type)
- `logger.ts` - Structured logging with level support and log rotation
- `safe-peripheral.ts` - `SafePeripheral<T>` wrapper for resilient peripheral access

### Layer 2: Shared Modules (`src/lib/`)
- `inventory/scanner.ts` - `getInventoryContents()`, `isInventoryEmpty()` standalone functions
- `inventory/types.ts` - `InventoryItemInfo`, `SlotInfo`
- `transfer/transfer.ts` - `executeTransfer()` race-condition-safe batch transfer
- `peripheral/registry.ts` - Generic peripheral validation (task-agnostic)
- `orchestrator/orchestrator.ts` - Core engine: scan machines + execute assignments
- `orchestrator/types.ts` - `MachineConfig`, `MachineState`, `Assignment`, `Scheduler` interface
- `scheduler/weighted.ts` - Weighted random selection (for distribution)
- `scheduler/stock-based.ts` - Urgency-based selection (for production)
- `task/types.ts` - `Task<TConfig, TState>` interface, `TaskContext`
- `task/registry.ts` - Task lifecycle management with pcall isolation
- `dashboard/renderer.ts` - Widget-based dashboard renderer
- `dashboard/widgets/` - Header, stock table, machine status widgets

### Layer 3: Applications (`src/apps/`)
- `production/task.ts` - `ProductionTask` (Orchestrator + StockBasedScheduler)
- `distribution/task.ts` - `DistributionTask` (Orchestrator + WeightedScheduler)

### Layer 4: Entry Points (`src/entries/`)
- `main.ts` - Boot sequence, main loop
- `config.ts` - Hardware-specific configuration
- `types.ts` - `AppConfig` referencing app types

## Key Patterns

- **Orchestrator pattern**: Generic engine receives `Assignment[]` from `Scheduler`, executes transfers
- **Scheduler interface**: `schedule(machines, inventory) → Assignment[]` - different implementations for different strategies
- **Config-first**: Peripherals and machines defined in `entries/config.ts`, validated at boot
- **Result pattern**: All functions return `Result<T>` with `.ok`, `.code`, `.value` or `.detail`
- **Path aliases**: `@core/*`, `@lib/*`, `@apps/*`, `@entries/*` (configured in tsconfig.json)
- **No implicit self**: TSTL configured with `noImplicitSelf: true`

### Peripheral Resilience (SafePeripheral)

CC:Tweaked peripherals can disconnect at runtime. `SafePeripheral<T>` provides resilience:

- **Try/catch** around all operations (compiles to Lua `pcall`)
- **Caller-controlled reconnect** via explicit `ensureConnected()` call
- **NO automatic retry** - prevents double transfers on partial failures

**Pattern - race-condition-safe transfer (lib/transfer/transfer.ts):**
```typescript
source.ensureConnected();
const result = source.call((p) => {
    const currentItem = p.getItemDetail(slot);
    if (!currentItem || currentItem.name !== expected) {
        return { error: "slot_changed", actual: currentItem?.name };
    }
    const transferred = p.pushItems(target, slot, amount);
    if (transferred === 0) return { error: "transfer_failed" };
    return { transferred };
}, { error: "disconnected" });
```

### Adding New Machine Types

1. Create new `Scheduler` implementation in `lib/scheduler/` (or reuse existing)
2. Create new app in `apps/my-system/` with `Task` + config types
3. Add machine configs and register task in `entries/config.ts` + `entries/main.ts`
4. Optionally add dashboard widgets

### Error Forwarding

When delegating to functions that return `Result<A>` but you need `Result<B>`:
```typescript
import { forwardErr } from "@core/result";
const result = someFunction();
if (!result.ok) return forwardErr(result);
```
This is needed because `strict: false` in tsconfig prevents proper discriminated union narrowing.

## TSTL Specifics

- Target: `CC-5.2` (ComputerCraft Lua)
- Types: `@jackmacwindows/lua-types/cc-5.2`, `craftos-types`, `cc-types`
- Bundle mode: All TS compiled into single `unearther.lua`

### Peripheral Types & @noSelf

CC:Tweaked peripherals use function-call syntax (`.`) not method-call syntax (`:`).
Use global types from `craftos-types` (declared via tsconfig `types` array):
```typescript
// Globally available - no import needed!
// InventoryPeripheral, WiredModemPeripheral, MonitorPeripheral, WriteFileHandle
```

**Do NOT define custom peripheral interfaces!** The `craftos-types` package uses `@noSelfInFile` for correct Lua codegen.
