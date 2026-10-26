# Winter weather and lighting

The weather layer is intentionally independent from the diorama. Create it with
`createWeatherSystem(scene)` and call `dispose()` when the level is unloaded.
`setEnabled(false)` hides the snowfall without reallocating its GPU buffers; the
`?snow=off` audit flag does the same from the URL.

`src/config/weather.ts` is the tuning surface:

- `SNOW.COUNT` controls the particle budget (the default is 1800 points).
- `SNOW.VOLUME` is the box the flakes live in: half extents in x and z plus the
  height above the ground plane. It is anchored to the level, not to the camera,
  and covers the 108 m slab with a margin.
- `SNOW.FALL_SPEED`, `SNOW.WIND` and `SNOW.SIZE` define the motion and the spread
  of flake sizes.
- `SNOW.POINT.SCALE` / `MAX_PIXELS` project a flake to
  `SIZE * SCALE / viewDepth` pixels, clamped to `[1, MAX_PIXELS]`.
- `SNOW.OPACITY` and `SNOW.COLOR` keep the flakes readable against the night fog.
- `SNOW.LAMP_TINT` is how much of a lamp's light a flake picks up as it crosses a
  pool: this is what makes a street lamp read as a source at night.
- `SNOW.SEED` fixes the scatter, so two reloads build an identical field and a
  pixel-scan comparison is not polluted by a different flake layout.

The snow shader lives in `src/render/winterShader.ts`. It combines soft circular
particles, wind sway, a subtle twinkle and clip-space quantization.

The field is a torus: the fall wraps through `VOLUME.HEIGHT` and the wind wraps
through the x and z extents. Density therefore stays constant forever — the cloud
cannot drift away from the level, and a frame after a long session looks like a
frame after one second.

The flake fade is not a local constant and not a copy of the fog either: the snow
material spreads the frame's shared `atmosphereUniforms` (see
`core/atmosphere.ts`) and calls the same `applyAtmosphere()` chunk the surface
shader uses. Flakes, geometry, light pools and the haze are therefore one model
with one set of values — the previous build faded snow on `smoothstep(near, far)`
while the yard faded on the linear `scene.fog`, and the two never matched.

There is no per-flake lighting model: the vertex shader asks `lampLighting()` for
the sum of the practicals at the flake position and tints the flake by it. At 1800
points x 10 lights per vertex this is free.

There is no shadow map in the scene at all — the night model (moon, hemisphere
ambient, practicals) is evaluated per fragment by the surface shader, and lighting
documentation lives in `docs/ATMOSPHERE.md`.
