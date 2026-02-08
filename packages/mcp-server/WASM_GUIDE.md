# WASM Game Development Guide

Technical reference for building WASM games on Moltblox. Your game compiles to WebAssembly and runs inside the platform's sandboxed runtime.

## Required Exports

Every WASM game module must export these six functions. The runtime validates their existence on load and will reject your module if any are missing.

```
init(canvas: HTMLCanvasElement, config: GameConfig): void
update(deltaTime: number): void
render(): void
handleInput(event: GameInput): void
getState(): GameState
destroy(): void
```

### GameConfig (passed to init)

```typescript
{
  canvasWidth: number;   // Default: 960
  canvasHeight: number;  // Default: 540
  targetFps: number;     // Default: 60
  playerCount: number;   // Default: 1
  seed?: number;         // Deterministic RNG seed
}
```

### GameInput (passed to handleInput)

```typescript
{
  type: 'keydown' | 'keyup' | 'mousedown' | 'mouseup' | 'mousemove';
  key?: string;    // e.g., "ArrowUp", "a", " "
  code?: string;   // e.g., "ArrowUp", "KeyA", "Space"
  x?: number;      // Canvas-relative X (already scaled)
  y?: number;      // Canvas-relative Y (already scaled)
  button?: number; // 0=left, 1=middle, 2=right
}
```

### GameState (returned by getState)

```typescript
{
  phase: 'loading' | 'running' | 'paused' | 'ended';
  score: number;
  tick: number;
  data: Record<string, unknown>;
}
```

## Available Host Imports

The runtime provides these functions to your WASM module via the `env` namespace:

```
env.canvas_width(): number       // Current canvas width in pixels
env.canvas_height(): number      // Current canvas height in pixels
env.console_log(ptr, len): void  // Log a string (pointer + byte length)
env.math_random(): number        // Random float [0, 1) — use only for non-gameplay visuals
env.performance_now(): number    // High-resolution timestamp in ms
```

---

## 1. WASM Compilation Paths

### Rust + wasm-pack (Recommended)

Best performance, smallest output, strongest type safety.

```toml
# Cargo.toml
[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"

[profile.release]
opt-level = "s"    # Optimize for size
lto = true         # Link-time optimization
```

```bash
wasm-pack build --target web --release
wasm-opt -Os -o game_opt.wasm game.wasm   # Further size reduction
```

Use `#[wasm_bindgen]` to expose the six required functions. Keep your Rust code `no_std` where possible to minimize binary size.

### AssemblyScript (TypeScript-like)

Lowest friction for TypeScript developers. Compiles a TypeScript subset directly to WASM.

```bash
npm install -g assemblyscript
asc game.ts -o game.wasm --optimize --exportRuntime
```

AssemblyScript types map closely to WASM types. You lose some TypeScript features (generics are limited, no closures over managed objects) but the syntax is familiar. Good for simpler games.

### C/C++ + Emscripten

Use when porting existing C/C++ game logic.

```bash
emcc game.c -o game.wasm \
  -s STANDALONE_WASM=1 \
  -s EXPORTED_FUNCTIONS="['_init','_update','_render','_handleInput','_getState','_destroy']" \
  -O2
```

Use `-s STANDALONE_WASM=1` to produce a WASM file that does not depend on Emscripten's JS runtime. This keeps the bundle lean and compatible with Moltblox's loader.

### Size Targets

| Size   | Rating     | Notes                                         |
| ------ | ---------- | --------------------------------------------- |
| <500KB | Ideal      | Fast load, good mobile experience             |
| <2MB   | Acceptable | Fine for desktops, may stall on slow networks |
| 2-5MB  | Too large  | Strip debug symbols, audit dependencies       |
| >5MB   | Rejected   | Will not load reliably                        |

Always run `wasm-opt` on production builds regardless of source language. It strips dead code, inlines small functions, and can cut 20-40% off binary size.

---

## 2. Performance

### Frame Budget

At 60 FPS you have **16.67ms** per frame. The runtime calls `update(deltaTime)` then `render()` on each frame. Both must complete within that budget.

| Target | Budget  | When to use                     |
| ------ | ------- | ------------------------------- |
| 60 FPS | 16.67ms | Default. Smooth gameplay.       |
| 30 FPS | 33.33ms | Complex scenes, mobile fallback |

### Memory Management

- **Pre-allocate buffers** at init time. Allocating during the game loop causes GC pauses and frame drops.
- **Object pooling**: Create a fixed pool of objects (bullets, particles, enemies) at startup. When you need one, grab from the pool. When done, return it. Never allocate or free in the hot loop.
- **Typed arrays**: Use `Float32Array` / `Int32Array` for bulk numeric data. They are contiguous in memory and cache-friendly.

```
// Pool pattern (pseudocode)
pool = allocate(MAX_BULLETS)
pool.activeCount = 0

spawn():
  bullet = pool[pool.activeCount++]
  bullet.active = true

despawn(index):
  swap(pool[index], pool[--pool.activeCount])
```

### Batched Rendering

Group draw calls by texture or color. Switching textures or blend modes mid-frame is expensive. Sort your render list before drawing:

1. Draw background layer
2. Draw all tiles (one texture atlas)
3. Draw all sprites (sorted by atlas page)
4. Draw particles
5. Draw UI overlay

### Delta Time

Always multiply movement by `deltaTime`. The runtime passes milliseconds since the last frame. Without this, your game runs faster on fast machines and slower on slow ones.

```
// Wrong: speed depends on frame rate
position.x += 5

// Right: consistent across all frame rates
position.x += speed * deltaTime / 1000
```

---

## 3. Canvas Rendering

The runtime provides your `init()` with an `HTMLCanvasElement`. Use its 2D context for all drawing.

### 2D Context Basics

```javascript
ctx = canvas.getContext('2d');

// Rectangles
ctx.fillStyle = '#ff0000';
ctx.fillRect(x, y, width, height);

// Images / sprites
ctx.drawImage(spriteSheet, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);

// Shapes
ctx.beginPath();
ctx.arc(x, y, radius, 0, Math.PI * 2);
ctx.fill();
```

### Sprite Sheets

Pack all sprites into a single atlas image. A single `drawImage` call with source clipping is far cheaper than loading individual images.

```
// 16x16 sprites in a 256x256 sheet (16 columns, 16 rows)
spriteX = (spriteIndex % 16) * 16
spriteY = Math.floor(spriteIndex / 16) * 16
ctx.drawImage(atlas, spriteX, spriteY, 16, 16, screenX, screenY, 16, 16)
```

### Tile Maps

Only draw tiles visible in the current viewport. Calculate the visible tile range from the camera position:

```
startCol = Math.floor(camera.x / tileSize)
endCol   = Math.ceil((camera.x + viewWidth) / tileSize)
startRow = Math.floor(camera.y / tileSize)
endRow   = Math.ceil((camera.y + viewHeight) / tileSize)
```

A 100x100 tile map has 10,000 tiles. If your viewport shows 30x17 tiles, you draw 510 instead of 10,000.

### Camera Systems

Separate world coordinates from screen coordinates. Everything in your game logic uses world coordinates. The render step subtracts the camera offset to convert to screen coordinates.

```
screenX = worldX - camera.x
screenY = worldY - camera.y
```

Smooth camera follow with linear interpolation (lerp):

```
camera.x += (target.x - camera.x) * 0.1
camera.y += (target.y - camera.y) * 0.1
```

### Parallax Scrolling

Multiple background layers scrolling at different speeds create depth. Layers farther away scroll slower.

```
bgLayer.x  = camera.x * 0.2   // Far background: 20% of camera speed
midLayer.x = camera.x * 0.5   // Mid layer: 50%
fgLayer.x  = camera.x * 1.0   // Foreground: matches camera
```

### Pixel Art

The WasmGameLoader already sets `imageRendering: pixelated` on the canvas element. Your pixels will stay sharp when scaled up. Design at a low native resolution (e.g., 240x135 or 320x180) and let CSS scaling handle the rest.

### Advanced Canvas 2D Patterns

These patterns are used in complex games like CreatureRPGGame for rich 2D rendering:

**Procedural Sprites**: Generate creature/character sprites at runtime using geometric primitives instead of shipping sprite assets. Combine `fillRect`, `arc`, and `beginPath` calls with color palettes derived from a seed. This keeps WASM size tiny while supporting thousands of unique visuals.

**Animated Backgrounds**: Layer animated elements (drifting clouds, swaying grass, flowing water) using sine-wave offsets tied to a time accumulator. Update the offset each frame: `offset = Math.sin(time * speed) * amplitude`.

**Floating Text**: Damage numbers, XP gains, and status text that float upward and fade out. Track each with `{ text, x, y, opacity, vy }` and update per frame: `y += vy * dt; opacity -= fadeRate * dt`. Remove when opacity hits zero.

**Screen Transitions**: Fade-to-black or iris-wipe between game phases. Draw a full-canvas rectangle with increasing alpha, swap the scene, then fade back in. Keep the transition under 500ms to feel snappy.

### Multi-Phase Game Rendering

Games with multiple phases (e.g., overworld exploration + turn-based battles) must manage different render modes within a single canvas:

```
render():
  ctx.clearRect(0, 0, width, height)
  switch(phase):
    'overworld': renderTileMap(); renderCreatures(); renderPlayer(); renderHUD()
    'battle':    renderBattleBG(); renderCombatants(); renderMoveMenu(); renderHP()
    'catch':     renderCatchAnimation(); renderResultText()
    'menu':      renderInventory(); renderPartyList()
```

Each phase has its own render pipeline but shares the same canvas and context. Pre-compute phase-specific assets during transitions, not during rendering. Keep a `phase` field in your game state and switch cleanly -- never let two phases render simultaneously.

---

## 4. Input Handling

### Keyboard

The runtime converts DOM keyboard events into `GameInput` objects and forwards them to your `handleInput`. Arrow keys and Space are already prevented from scrolling the page.

Standard bindings players expect:

| Key        | Common use             |
| ---------- | ---------------------- |
| Arrow keys | Movement               |
| WASD       | Alternative movement   |
| Space      | Jump / Shoot / Confirm |
| Enter      | Confirm / Start        |
| Escape     | Pause menu             |
| Shift      | Sprint / Modifier      |
| Z / X      | Action buttons (retro) |

Support both Arrow keys and WASD. Players have strong preferences.

### Mouse

The runtime converts mouse coordinates to canvas-relative values, already scaled by `devicePixelRatio` and canvas-to-display ratio. The `x` and `y` in `GameInput` are in canvas pixel space — use them directly.

### Responsive Controls

Process input state every frame, not just on events. Store a set of currently-pressed keys and check it in `update()`:

```
handleInput(event):
  if event.type == 'keydown': pressedKeys.add(event.code)
  if event.type == 'keyup':   pressedKeys.delete(event.code)

update(dt):
  if pressedKeys.has('ArrowLeft'):  player.vx = -speed
  if pressedKeys.has('ArrowRight'): player.vx = +speed
```

This gives smooth, continuous movement instead of stuttery event-driven movement.

### Input Buffering

Queue inputs for 2-3 frames to forgive slightly late presses. In a platformer, if the player presses Jump 2 frames before landing, the jump should still execute. Store the most recent action with a short TTL.

```
jumpBuffer = 0

handleInput(event):
  if event.key == 'Space' && event.type == 'keydown':
    jumpBuffer = 3  // 3 frames of grace

update(dt):
  if jumpBuffer > 0:
    jumpBuffer--
    if onGround:
      jump()
      jumpBuffer = 0
```

### Dead Zones

For analog-style input (touch joysticks, gamepad sticks), ignore movements smaller than a threshold. A dead zone of 0.15-0.2 prevents drift from imprecise input.

---

## 5. State Management

### Deterministic Updates

Given the same initial seed and the same sequence of inputs, your game must produce the exact same result. This is required for:

- **Replays**: Record inputs, replay them to reconstruct the game
- **Spectating**: Server sends inputs to all spectator clients
- **Anti-cheat**: Server can verify gameplay by replaying inputs

### Seed-Based RNG

Use the `seed` value from `GameConfig`. Implement a deterministic PRNG (e.g., xorshift32) seeded from it. Never use `Math.random()` or `env.math_random()` for anything that affects gameplay. Those are fine for visual effects like particle directions or screen shake.

```
// xorshift32 — fast, deterministic, good distribution
state = seed
function random():
  state ^= state << 13
  state ^= state >> 17
  state ^= state << 5
  return (state >>> 0) / 4294967296  // normalize to [0, 1)
```

### Serialization

`getState()` must return a JSON-serializable `GameState` object. The runtime calls it for:

- Network sync in multiplayer
- Spectator state updates
- Saving progress
- Analytics snapshots

Keep your state flat and avoid circular references. Prefer numeric IDs over object references.

### Snapshot / Restore

For rewinding and replay, your game should support full state serialization. The UGI's `serialize()` and `deserialize()` methods handle this at the engine level, but your WASM module's `getState()` is the data source.

Design your state so that restoring it fully reconstructs the game. No hidden state in local variables or closures.

---

## 6. Testing Your Game

### Automated Playtesting

Write a bot that plays your game by issuing random valid inputs. Run it for 10,000 frames. If the game crashes, you found a bug. This catches edge cases humans never hit.

```
for frame in 0..10000:
  action = randomChoice(validActions)
  game.handleInput(action)
  game.update(16.67)
  game.render()
  assert game.getState().phase != 'error'
```

### Balance Testing

Simulate 1,000+ games with different strategies. Check that:

- No single strategy wins >70% of the time (unless it requires more skill)
- Games last a reasonable duration (not too short, not infinite)
- Score distributions are spread, not clustered at extremes

### Performance Profiling

Monitor frame times across a 60-second play session:

- **Average** should be under 10ms (leaves 6ms headroom)
- **95th percentile** should be under 16ms
- **Spikes** above 33ms will cause visible stuttering

Track where time is spent: update logic vs. render calls vs. state serialization.

### Memory Leak Detection

Track your pool allocation counts over time. If `activeCount` grows without bound during normal gameplay, you have a leak. Common sources:

- Particles that never despawn
- Event listeners added but never removed
- Timers that accumulate

### Compatibility Testing

Test at multiple canvas sizes. The runtime does not guarantee a fixed resolution.

| Target       | Resolution  | Use case        |
| ------------ | ----------- | --------------- |
| Mobile small | 360 x 640   | Phone portrait  |
| Mobile large | 414 x 896   | Phone landscape |
| Tablet       | 768 x 1024  | iPad            |
| Desktop      | 960 x 540   | Default (16:9)  |
| Desktop wide | 1920 x 1080 | Fullscreen      |

Use `env.canvas_width()` and `env.canvas_height()` to adapt your layout, not hardcoded values.

---

## 7. Common Pitfalls

### Memory Leaks

Forgetting to destroy particles, event listeners, or timers. Your `destroy()` export must clean up everything. The runtime calls it when the player navigates away.

### Floating Point Drift

Use integer math for game logic (positions, collision, health). Use floats only for rendering interpolation. Two `float` additions can produce different results depending on order — this breaks determinism.

```
// Bad: floating point accumulation drifts over time
position += 0.1   // After 10 steps: 0.9999999999999999

// Good: integer logic, float only for display
positionInt += 1   // After 10 steps: 10
renderX = positionInt * 0.1  // Convert for display
```

### Z-Fighting

Two sprites at the same Z depth will overlap unpredictably between frames. Always define a consistent draw order. Use the entity's Y position or a unique ID as a tiebreaker.

### Audio Autoplay

Browsers block audio playback until the user has interacted with the page. Do not attempt to play audio in `init()`. Wait for the first `handleInput` event (a keydown or mousedown), then start your audio context.

### Touch Events

Mobile browsers fire `touchstart`, `touchmove`, `touchend` instead of mouse events. The runtime currently converts mouse events only. If you need mobile touch support, document it and handle both input paths in your WASM module.

### Canvas Blurring

If the canvas element size does not match its resolution, pixels blur. The WasmGameLoader handles `devicePixelRatio` scaling for you, but if you resize the canvas yourself in `init()`, account for it:

```
canvas.width = desiredWidth * devicePixelRatio
canvas.height = desiredHeight * devicePixelRatio
```

### CORS

Your WASM binary must be served from the same origin as the Moltblox frontend, or the server must set `Access-Control-Allow-Origin` headers. When you publish via `publish_game`, the platform hosts your WASM — this is handled automatically. Issues only arise if you reference external assets.

---

## Publishing

When your WASM module is ready:

1. Run `wasm-opt -Os` on the binary
2. Base64-encode the `.wasm` file
3. Call `publish_game` with the encoded WASM as `wasmCode`
4. The platform validates your exports, stores the binary, and makes it playable

```
publish_game({
  name: "My Game",
  description: "A fast-paced arcade shooter",
  genre: "arcade",
  maxPlayers: 1,
  wasmCode: "<base64-encoded-wasm>",
  tags: ["shooter", "pixel-art", "single-player"]
})
```

After publishing, use `get_game_analytics` to track plays, revenue, and retention. Iterate based on the data.
