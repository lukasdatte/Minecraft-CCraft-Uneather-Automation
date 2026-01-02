# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CC:Tweaked turtle distributor that compiles TypeScript to Lua using TypeScriptToLua. The turtle navigates linearly between a home dock and stations, scanning feed chests via wired modem. Currently infrastructure-complete with item delivery logic intentionally stubbed.

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
- `src/main.ts` - Boot sequence, main loop (scan → queue → execute → persist)

### Configuration (`src/`)
- `config.ts` - Runtime configuration (dock, stations, world, refuel settings)
- `types.ts` - All TypeScript interfaces (`AppConfig`, `Job`, `StationConfig`, etc.)

### Core (`src/core/`)
- `result.ts` - `Result<T>` pattern used throughout (`ok()`, `okNoop()`, `err()`)
- `state.ts` - Runtime state tracking (jobs executed, scan history)
- `storage.ts` - JSON persistence on turtle filesystem
- `checks.ts` - Dock/fuel validation
- `errors.ts` - Error codes (`ResultCode` type)
- `logger.ts` - Structured logging

### Engine (`src/engine/`)
- `scanner.ts` - Scans remote feed chests via wired modem, creates jobs
- `queue.ts` - FIFO job queue
- `executor.ts` - Executes jobs (navigate to station, return home)

### I/O (`src/io/`)
- `inventory.ts` - Remote/local inventory wrappers
- `turtle_inv.ts` - Turtle inventory helpers
- `refuel.ts` - Fuel mechanics

### Networking (`src/net/`)
- `wired.ts` - Wired modem abstraction
- `registry.ts` - `Directory` type: validated peripheral registry built from config

### World (`src/world/`)
- `nav_line.ts` - Linear navigation (forward/back N steps)
- `calibrate.ts` - Dock orientation calibration

## Key Patterns

- **Config-first**: Stations and peripherals are defined in `config.ts`, validated against wired network at boot
- **Result pattern**: All functions return `Result<T>` with `.ok`, `.code`, `.value` or `.detail`
- **No implicit self**: TSTL configured with `noImplicitSelf: true` (no Lua `self` parameter)

## TSTL Specifics

- Target: `CC-5.2` (ComputerCraft Lua)
- Types: `@jackmacwindows/lua-types/cc-5.2`, `craftos-types`, `cc-types`
- Bundle mode: All TS compiled into single `main.lua`
