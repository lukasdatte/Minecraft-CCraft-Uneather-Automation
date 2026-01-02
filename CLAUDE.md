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
