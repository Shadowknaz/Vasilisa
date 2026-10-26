// Application composition root: wires stage, world, mech, state, systems and render loop.
import { DEBUG } from './config/layout.js';
import { COLORS } from './config/colors.js';
import { NIGHT } from './config/render.js';
import { setVertexSnapEnabled } from './core/ps1Material.js';
import { RENDER_FLAGS, setRenderFlag } from './core/renderFlags.js';
import { setGlowVisible } from './core/glow.js';
import { createStage } from './core/stage.js';
import { buildMech } from './mech/mech.js';
import { buildPlayer } from './player/player.js';
import { applyNightExposure, type LampEmitter } from './core/atmosphere.js';
import { createFrameMeter } from './render/frameMeter.js';
import { createFrameRender } from './render/frameRender.js';
import { startRenderLoop } from './render/loop.js';
import { createPS1Display } from './render/ps1Display.js';
import { createViewmodelCamera, markViewmodel, syncViewmodelCamera } from './render/viewmodel.js';
import { resizeViewport } from './render/resize.js';
import { createInputState } from './state/inputState.js';
import { createInteriorState } from './state/interiorState.js';
import { createMechState } from './state/mechState.js';
import { createPilotState } from './state/pilotState.js';
import { createViewState } from './state/viewState.js';
import { createCollisionWorld } from './systems/collision.js';
import { createDustSystem } from './systems/dust.js';
import { initInput } from './systems/input.js';
import { createInteriorRuntime } from './systems/interiorController.js';
import { createSearchlightEmitters } from './systems/searchlight.js';
import { createFlashlightEmitter } from './systems/flashlight.js';
import { updateSimulation, type SimulationContext } from './systems/simulation.js';
import { createLayout } from './world/layout/createLayout.js';
import { LAMP_EMITTERS } from './world/layout/lighting.js';
import { setDecayEnabled } from './world/khrushchyovkaDecay.js';
import { setInteriorsEnabled } from './world/interiors/interiorSelection.js';
import { localToWorld } from './world/interiors/index.js';
import { mountDebugPanel, mountErrorOverlay } from './world/debugLayout.js';
import { buildWorld } from './world/index.js';
import { createSurfaceField } from './world/surfaceField.js';
import { createSnowTrackSystem } from './world/snowTracks.js';
import { createWeatherSystem } from './systems/weather.js';
import * as THREE from 'three';

function readFlag(query: string, value: string): boolean {
    return new URLSearchParams(window.location.search).get(query) === value;
}

function hasFlag(query: string): boolean {
    return new URLSearchParams(window.location.search).has(query);
}

// Numeric URL override for the exposure sweep; anything unparsable falls back to
// the config value, which stays the single source of truth.
function readNumber(query: string, fallback: number): number {
    const raw = new URLSearchParams(window.location.search).get(query);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

let teardown: (() => void) | null = null;

function init(): void {
    if (teardown) {
        teardown();
        teardown = null;
    }

    const debugMode = readFlag(DEBUG.LAYOUT_QUERY, DEBUG.LAYOUT_VALUE);
    const perfMode = hasFlag(DEBUG.PERF_QUERY);

    // Diagnostic switches for the render audit. They must be set before anything
    // renders: the snap holder is read by every material while it is uploaded.
    setRenderFlag('postProcess', !readFlag(DEBUG.POST_QUERY, DEBUG.OFF_VALUE));
    setRenderFlag('lights', !readFlag(DEBUG.LIGHTS_QUERY, DEBUG.OFF_VALUE));
    setRenderFlag('fog', !readFlag(DEBUG.FOG_QUERY, DEBUG.OFF_VALUE));
    // Master night switch: key N flips the same flag at runtime.
    setRenderFlag('night', !readFlag(DEBUG.NIGHT_QUERY, DEBUG.OFF_VALUE));
    setVertexSnapEnabled(!readFlag(DEBUG.SNAP_QUERY, DEBUG.OFF_VALUE));
    // Decay is geometry, not a shader switch: it has to be decided before the
    // world is built, and then there is nothing left to toggle.
    setDecayEnabled(!readFlag(DEBUG.DECAY_QUERY, DEBUG.OFF_VALUE));
    // Interiors change the plan itself (porch walkways, doorway cuts), so the
    // switch is read before createLayout, not after the scene exists.
    setInteriorsEnabled(!readFlag(DEBUG.INTERIOR_QUERY, DEBUG.OFF_VALUE));
    // Exposure sweep (?surf=0.19&sky=0.24): the two night budgets move for this
    // boot only. It has to happen before createStage(), because the sky colour and
    // the fog colour are read from skyTone() when the stage is built.
    applyNightExposure(
        readNumber(DEBUG.EXPOSURE_SURFACE_QUERY, NIGHT.EXPOSURE.SURFACE),
        readNumber(DEBUG.EXPOSURE_SKY_QUERY, NIGHT.EXPOSURE.SKY)
    );

    // The plan comes first: without a validated layout there is no scene at all.
    const built = createLayout({ verifyDeterminism: debugMode });
    window.__DIORAMA_LAYOUT__ = built.layout;
    window.__DIORAMA_VALIDATION__ = built.validation;

    if (!built.validation.ok) {
        mountErrorOverlay(built.validation);
        return;
    }

    const displayCanvas = document.getElementById('ps1-canvas') as HTMLCanvasElement | null;
    if (!displayCanvas) throw new Error('ps1-canvas element not found');
    const display = createPS1Display(displayCanvas);

    const stage = createStage();
    const collision = createCollisionWorld({
        half: built.layout.world.half,
        walkMargin: built.layout.world.walkMargin
    });

    const dioramaGroup = new THREE.Group();
    stage.scene.add(dioramaGroup);
    // One surface field for the whole scene: the relief mesh, the pavement plates
    // and the searchlight's ground pool read the same height lookup.
    const surface = createSurfaceField({ layout: built.layout, surfaceRects: built.surfaceRects });
    const world = buildWorld({
        group: dioramaGroup,
        collision,
        layout: built.layout,
        masks: built.masks,
        grid: built.grid,
        surface,
        debug: debugMode
    });
    const snowTracks = createSnowTrackSystem(dioramaGroup, surface);

    if (debugMode) {
        mountDebugPanel(built);
    }

    const mech = buildMech();
    stage.scene.add(mech.group);
    // The searchlight pool lives in its own world-space group: the pose animator
    // writes its world x/z every frame instead of inheriting the leg rig.
    stage.scene.add(mech.ground.group);

    // The heroine the pilot sees from her own eyes. The body is world-space (its
    // boots stand on the pilot's floor), the arms are pinned to the camera by
    // systems/playerPose.ts. Both roots stay hidden outside the FP mode.
    const player = buildPlayer();
    stage.scene.add(player.group, player.view);
    // The arms are the only geometry that reaches the camera, so they are drawn in
    // their own pass with its own near plane (render/viewmodel.ts).
    markViewmodel(player.view);
    const viewmodelCamera = createViewmodelCamera();

    // Every practical of the frame in one list: the static fixtures of the plan plus
    // the two the walker carries. The atmosphere uploads this to the shader once per
    // frame, so a lamp cannot light anything the fixture table does not know about.
    // The battery bulb of every opened stairwell is part of the static layer: the
    // one porch of the district that still has light has to read from the yard too.
    const searchlightEmitters = createSearchlightEmitters(mech.searchlight);
    const flashlightEmitter = createFlashlightEmitter(stage.scene);
    const interiorLamps: LampEmitter[] = world.interiors.flatMap((instance) =>
        instance.plan.lights.map((light) => {
            const world = localToWorld(instance, light.x, light.z);
            return {
                position: new THREE.Vector3(world.x, light.y, world.z),
                color: COLORS.INTERIOR_LAMP,
                intensity: COLORS.INTERIOR_LAMP_INTENSITY,
                range: COLORS.INTERIOR_LAMP_RANGE
            };
        })
    );
    const lamps: LampEmitter[] = [...LAMP_EMITTERS, ...searchlightEmitters, ...interiorLamps, flashlightEmitter];

    const weather = createWeatherSystem(stage.scene);
    if (readFlag(DEBUG.SNOW_QUERY, DEBUG.OFF_VALUE)) weather.setEnabled(false);

    const dust = createDustSystem(stage.scene);

    const mechState = createMechState();
    const pilotState = createPilotState();
    const viewState = createViewState();
    const inputState = createInputState();

    // The interior layer of the district: porch crossings and stair floors. It
    // shares the layout-approved plans with the geometry above.
    const interiorState = createInteriorState();
    const interior = createInteriorRuntime({
        instances: world.interiors,
        state: interiorState,
        pilotState,
        viewState,
        exterior: collision
    });

    const stopInput = initInput({
        displayCanvas,
        inputState,
        viewState,
        pilotState,
        mechState,
        collision,
        // Indoors the action key is not a boarding key: a walker can never be
        // entered through a stairwell wall.
        onAction: () => interior.isInside()
    });

    if (debugMode) {
        // Debug-only handle: the layout panel and the acceptance run read the scene,
        // the collision set and the interiors through it instead of guessing from
        // screenshots.
        window.__DIORAMA_DEBUG__ = {
            built,
            stage,
            collision,
            surface,
            weather,
            interiors: world.interiors,
            interiorState,
            pilotState,
            viewState,
            player
        };
    }

    const frame = createFrameRender(stage.renderer, display);
    const onResize = (): void => resizeViewport(display, stage.renderer, stage.camera, frame);
    onResize();
    window.addEventListener('resize', onResize);

    const frameMeter = perfMode ? createFrameMeter(stage.renderer, display, frame) : null;

    const simulationContext: SimulationContext = {
        viewState,
        mechState,
        pilotState,
        inputState,
        mech,
        player,
        collision,
        interior,
        surface,
        snowTracks,
        dust,
        camera: stage.camera,
        scene: stage.scene,
        lamps,
        searchlightEmitters,
        flashlightEmitter
    };

    // One place per frame: simulate, settle the light overlays, draw. The overlays
    // are additive glow (lamp pools, halos, the searchlight pool), so they follow the
    // single night switch instead of every builder reading the flag.
    function renderFrame(dt: number): void {
        updateSimulation(dt, simulationContext);
        setGlowVisible(RENDER_FLAGS.night);
        // The arms follow the settled eye pose of this frame, and only exist in FP:
        // outside it there is nothing to draw in the second pass at all.
        syncViewmodelCamera(stage.camera, viewmodelCamera);
        frame.render(stage.scene, stage.camera, player.view.visible ? viewmodelCamera : null);
    }

    // One synchronous frame before the loop starts. requestAnimationFrame does not
    // fire in a hidden or backgrounded tab, and without this the canvas would stay
    // blank until the tab is focused — so every capture path (a screenshot of the
    // page, a headless run, a thumbnail) would photograph nothing. dt = 0 runs the
    // whole frame order without advancing any state, which also packs the lamp
    // array before the first painted pixel.
    renderFrame(0);

    const stopLoop = startRenderLoop((dt) => {
        renderFrame(dt);
        if (frameMeter) frameMeter.sample(dt);
    });

    teardown = (): void => {
        stopLoop();
        stopInput();
        window.removeEventListener('resize', onResize);
        frame.dispose();
        weather.dispose();
        dust.dispose();
        snowTracks.dispose();
        stage.dispose();
        delete window.__DIORAMA_LAYOUT__;
        delete window.__DIORAMA_VALIDATION__;
        delete window.__DIORAMA_DEBUG__;
        delete window.__DIORAMA_CLEANUP__;
    };

    window.__DIORAMA_CLEANUP__ = teardown;
}

init();

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (teardown) {
            teardown();
            teardown = null;
        }
    });
}
