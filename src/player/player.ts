// Composition root of the heroine rig. Returns two roots, because they live in
// two different frames:
//
// - `group` is the body in world space: legs, coat skirt and the torso with the
//   pack (the head inside it is hidden). The pose animator puts it on the pilot's
//   feet and heading, so the boots stay on the ground while the camera looks
//   around.
// - `view` is the arm assembly. It is pinned to the camera every frame, so the
//   mittens do not slide out of the frame when the pilot looks up or down.
//
// Nothing here knows about state or input: systems/playerPose.ts moves what this
// function returns. The head and the bulky chest are hidden by default — the eye
// line is inside the skull, and the chest top would fill the look-down view — but
// the waist, the coat and the legs are drawn, and the full model is ready for a
// third-person camera.
import { PLAYER_RIG, PLAYER_VIEW } from '../config/player.js';
import { CAMERA } from '../config/render.js';
import { createPlayerArms } from './playerArms.js';
import { createPlayerBackpack } from './playerBackpack.js';
import { createPlayerCoat } from './playerCoat.js';
import { createPlayerHead } from './playerHead.js';
import { createPlayerLegs } from './playerLegs.js';
import { createPlayerMaterials } from './playerMaterials.js';
import * as THREE from 'three';

export interface PlayerRig {
    // World-space body, feet on y = 0 of the rig.
    group: THREE.Group;
    // Camera-anchored arms.
    view: THREE.Group;
    // Joints the pose animator writes.
    torso: THREE.Group;
    skirt: THREE.Group;
    // Rest height of the torso pivot (breathing is added to it).
    torsoBaseY: number;
    // [left, right] pairs.
    hips: [THREE.Group, THREE.Group];
    knees: [THREE.Group, THREE.Group];
    shoulders: [THREE.Group, THREE.Group];
    elbows: [THREE.Group, THREE.Group];
    mittens: [THREE.Group, THREE.Group];
}

export function buildPlayer(): PlayerRig {
    const materials = createPlayerMaterials();

    const group = new THREE.Group();
    group.name = 'player';
    // One uniform scale for the whole heroine: the body, the coat and the boots
    // keep their proportions, the feet stay on the rig origin.
    group.scale.setScalar(PLAYER_RIG.SCALE);

    const legs = createPlayerLegs(materials);
    const coat = createPlayerCoat(materials);
    const head = createPlayerHead(materials);
    // The camera eye line is inside the skull: the helmet would cover the whole
    // frame. The group stays in the model for a third-person camera.
    head.visible = false;
    coat.chest.add(createPlayerBackpack(materials), head);
    // The chest is the one part of the body the first-person camera cannot keep:
    // its top face sits 0.3 m below the eye and fills the whole lower frame as soon
    // as the pilot looks down, hiding both the legs and the mittens. The waist and
    // the coat skirt stay drawn, so the body still reads as the heroine; the chest
    // is restored for any third-person camera.
    coat.chest.visible = false;
    group.add(legs.group, coat.skirt, coat.torso);

    const arms = createPlayerArms(materials);
    // The arms are a viewmodel: they scale with the body so the mittens keep the
    // same size relative to the coat.
    arms.group.scale.setScalar(PLAYER_RIG.SCALE);
    // The model faces +Z, the camera looks -Z: one half-turn puts the sleeves on
    // the correct side of the view.
    const modelFrame = new THREE.Group();
    modelFrame.name = 'player-view-frame';
    modelFrame.rotation.y = Math.PI;
    // The shoulder line is 1.36 m above the feet in model space (~0.91 m after the
    // 0.67 rig scale); the shoulder root is dropped by the camera eye height so the
    // shoulders sit ~0.30 m below the eye, matching an 11-year-old child. PLAYER_VIEW adds
    // the two offsets that keep the sleeves out of the near field: FORWARD along
    // the look axis (+Z of the rig is the view's -Z, see modelFrame) and DROP
    // below it, which puts the mittens on the bottom edge of the frame.
    const shoulderRoot = new THREE.Group();
    shoulderRoot.name = 'player-view-rig';
    shoulderRoot.position.set(0, -CAMERA.FP_EYE_HEIGHT - PLAYER_VIEW.DROP, PLAYER_VIEW.FORWARD);
    shoulderRoot.add(arms.group);
    modelFrame.add(shoulderRoot);

    const view = new THREE.Group();
    view.name = 'player-view';
    view.add(modelFrame);

    group.visible = false;
    view.visible = false;

    return {
        group,
        view,
        torso: coat.torso,
        skirt: coat.skirt,
        torsoBaseY: coat.torsoBaseY,
        hips: legs.hips,
        knees: legs.knees,
        shoulders: arms.shoulders,
        elbows: arms.elbows,
        mittens: arms.mittens
    };
}
