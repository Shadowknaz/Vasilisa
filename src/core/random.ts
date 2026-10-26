// Deterministic Lehmer generator shared by the procedural texture modules.
// Every texture module draws from its own instance with a fixed seed, so two page
// loads paint identical pixels and the noise never depends on call order elsewhere.

const MULTIPLIER = 16807;
const MODULUS = 2147483647;

type Random = () => number;

export function createSeededRandom(seed: number): Random {
    let state = seed;
    return () => {
        state = (state * MULTIPLIER) % MODULUS;
        return (state - 1) / (MODULUS - 1);
    };
}
