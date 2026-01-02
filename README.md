# Unearther Distributor (TS2Lua)

This project targets **CC:Tweaked** turtles and compiles TypeScript to Lua using TypeScriptToLua.

It is **infrastructure-complete**:
- Config-first peripheral registry & validation
- Dock orientation check using a **wired modem on a configured side**
- Wired remote scanning of feed chests (empty = 0 items)
- Job queue, executor, linear navigation (home <-> station)
- Health checks (dock connectivity, optional fuel checks)
- Optional runtime state persistence (JSON)

It intentionally **does not implement item selection/delivery logic** yet.
The executor will *visit* stations that are empty and record results, but will not move items.

## Build
```bash
npm install
npm run build
```
This produces `main.lua` in the project root.

## Configure
Edit `src/config.ts`.

### Dock
- `dock.netSide`: side where the WIRED modem must be adjacent at the home dock.
- `dock.requiredRemote`: (optional) list of remote peripheral names which must be visible on the wired network.

### Base
- `base.controllers`: remote inventory peripherals (drawer controller(s)) used for validation/diagnostics.
- `base.refuel`: optional. If your turtle needs fuel, put a **fuel chest** adjacent at the dock and set its direction.

### Stations
- `stations[].feedChest`: remote peripheral name of the station feed chest (wired).
- `stations[].distanceSteps`: station index along the line.
- The turtle navigates linearly: `distanceSteps * world.stepDistance` blocks forward from home.

## Run
On the turtle:
```lua
lua main.lua
```

## Diagnostics
Set `runtime.printRemoteOnBoot = true` to print all remote peripheral names the dock modem sees.
