// Shared materials reused by all world builders ("чёрные провалы у оснований объектов").
import { COLORS } from '../config/colors.js';
import { makePS1Material } from './ps1Material.js';
import { textures } from './textures.js';
import * as THREE from 'three';

export const innerVoidMat = new THREE.MeshBasicMaterial({ color: COLORS.VOID });

export const topHighlightMat = makePS1Material({ color: COLORS.HIGHLIGHT });

export const darkFrameMat = makePS1Material({ color: COLORS.FRAME_DARK });

// Winter dressing shared by trees, fences, snow fields and the plate yard: one
// material per meaning, so a snow cap looks the same wherever it sits. Snow is
// a Lambert surface, never emissive — the walker stays the brightest silhouette.
export const snowCapMat = makePS1Material({ map: textures.winterSnow, color: COLORS.SNOW }, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
export const snowSoilMat = makePS1Material({ map: textures.winterSnow, color: COLORS.SNOW_SOIL }, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
export const whitewashMat = makePS1Material({ color: COLORS.FENCE_WHITEWASH });
