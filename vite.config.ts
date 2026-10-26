import { defineConfig } from 'vite';

// The project entry is index.html at the repo root; it loads ./src/main.ts.
// Plain TS + CSS, no framework plugins required.
export default defineConfig({
    build: {
        outDir: 'dist',
        target: 'es2020'
    }
});
