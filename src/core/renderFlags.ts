// Runtime render switches, set at boot from the URL (?post=off, ?lights=off,
// ?fog=off, ?night=off) and togglable from the keyboard. They exist so a visual
// artefact can be attributed to one layer — atmosphere, lighting, post-processing
// or the whole night model — without editing sources.
// Vertex snapping is not here: it is a shader uniform owned by
// core/ps1Material.ts (setVertexSnapEnabled), because it has to be readable from
// inside the GLSL upload rather than at boot.
export const RENDER_FLAGS = {
    postProcess: true,
    lights: true,
    fog: true,
    // Master switch of the night model: the surface shader falls back to a neutral
    // studio light, the grade, the fog and every practical go off together. Key N
    // flips it at runtime for A/B inspection (?night=off does the same at boot).
    night: true
};

type RenderFlagName = keyof typeof RENDER_FLAGS;

export function setRenderFlag(name: RenderFlagName, enabled: boolean): void {
    RENDER_FLAGS[name] = enabled;
}
