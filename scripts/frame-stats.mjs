// Visual acceptance harness: loads the game in headless Chrome over CDP, optionally
// sends a key sequence (o — overview, q/r — orbit), then measures the tone of the
// PS1 display canvas and writes a screenshot.
//
// It exists because "the frame is too dark" and "the lights do not read" are not
// verifiable by eye across a refactor: mean / p50 / p95 / p99 of the finished
// canvas are. See docs/ATMOSPHERE.md for the target numbers.
//
//   node scripts/frame-stats.mjs --url http://localhost:5174/ --out .tmp-iso.png
//   node scripts/frame-stats.mjs --url http://localhost:5174/ --keys q --out .tmp-beam.png
//   node scripts/frame-stats.mjs --url http://localhost:5174/ --hold w:9000 --out .tmp-close.png
//   (--hold presses a key, waits, then releases it: movement keys do nothing on a tap)
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

const KEY_MAP = {
    n: { code: 'KeyN', key: 'n', vk: 78 },
    o: { code: 'KeyO', key: 'o', vk: 79 },
    e: { code: 'KeyE', key: 'e', vk: 69 },
    q: { code: 'KeyQ', key: 'q', vk: 81 },
    r: { code: 'KeyR', key: 'r', vk: 82 },
    w: { code: 'KeyW', key: 'w', vk: 87 }
};

function parseArgs(argv) {
    const args = {
        url: 'http://localhost:5174/',
        keys: '',
        // Held keystrokes as `key:ms` pairs: "w:9000,f:1200". Pressed after the
        // tapped keys and released before the measurement.
        hold: '',
        out: '',
        width: 1280,
        height: 800,
        settle: 9000,
        // Optional normalised crop of the display canvas: x,y,w,h in 0..1. Used to
        // measure one light pool instead of the whole frame.
        rect: '',
        // Optional expression evaluated in the page after the measurement.
        eval: '',
        // Optional temporal stability probe: delay in ms between two samples of the
        // same canvas (0 = off).
        diff: 0
    };
    for (let index = 0; index < argv.length; index += 2) {
        const name = argv[index].replace(/^--/, '');
        const value = argv[index + 1];
        if (!(name in args)) continue;
        args[name] = ['width', 'height', 'settle'].includes(name) ? Number(value) : value;
    }
    return args;
}

function statsExpression(rect) {
    const region = rect ? rect.split(',').map(Number) : null;
    return `(() => {
    const canvas = document.getElementById('ps1-canvas');
    const context = canvas.getContext('2d');
    const region = ${JSON.stringify(region)};
    const x0 = region ? Math.floor(region[0] * canvas.width) : 0;
    const y0 = region ? Math.floor(region[1] * canvas.height) : 0;
    const w = region ? Math.max(1, Math.floor(region[2] * canvas.width)) : canvas.width;
    const h = region ? Math.max(1, Math.floor(region[3] * canvas.height)) : canvas.height;
    const { data } = context.getImageData(x0, y0, w, h);
    const histogram = new Array(256).fill(0);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
        const value = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
        sum += value;
        histogram[value] += 1;
        count += 1;
    }
    const percentile = (share) => {
        let accumulated = 0;
        for (let value = 0; value < 256; value += 1) {
            accumulated += histogram[value];
            if (accumulated >= count * share) return value;
        }
        return 255;
    };
    let peak = 255;
    while (peak > 0 && histogram[peak] === 0) peak -= 1;
    return JSON.stringify({
        mean: Math.round((sum / count) * 10) / 10,
        mean01: Math.round((sum / count / 255) * 1000) / 1000,
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
        max: peak,
        size: canvas.width + 'x' + canvas.height,
        region: region ? [x0, y0, w, h] : 'full'
    });
})()`;
}

// Temporal stability probe: samples the same canvas twice and reports how many
// pixels changed. With the camera still and ?snow=off the number must be ~0 — that
// is the quantitative form of "no boiling" for the dither/quantizer and the snow
// caps. Any real flicker on static geometry shows up here immediately.
function diffExpression(delayMs, rect) {
    const region = rect ? rect.split(',').map(Number) : null;
    return `(async () => {
    const canvas = document.getElementById('ps1-canvas');
    const context = canvas.getContext('2d');
    const region = ${JSON.stringify(region)};
    const x0 = region ? Math.floor(region[0] * canvas.width) : 0;
    const y0 = region ? Math.floor(region[1] * canvas.height) : 0;
    const w = region ? Math.max(1, Math.floor(region[2] * canvas.width)) : canvas.width;
    const h = region ? Math.max(1, Math.floor(region[3] * canvas.height)) : canvas.height;
    const read = () => context.getImageData(x0, y0, w, h).data;
    const first = read();
    await new Promise((resolve) => setTimeout(resolve, ${delayMs}));
    const second = read();
    let changed = 0;
    let bright = 0;
    let worst = 0;
    for (let i = 0; i < first.length; i += 4) {
        const a = (first[i] * 0.299 + first[i + 1] * 0.587 + first[i + 2] * 0.114) | 0;
        const b = (second[i] * 0.299 + second[i + 1] * 0.587 + second[i + 2] * 0.114) | 0;
        const delta = Math.abs(a - b);
        if (delta > 4) changed += 1;
        if (delta > 4 && b > 120) bright += 1;
        if (delta > worst) worst = delta;
    }
    const total = first.length / 4;
    return JSON.stringify({
        changedPixels: changed,
        changedShare: Math.round((changed / total) * 10000) / 10000,
        brightChanged: bright,
        maxDelta: worst,
        delayMs: ${delayMs},
        region: region ? [x0, y0, w, h] : 'full'
    });
})()`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(port) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        await sleep(250);
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/list`);
            const targets = await response.json();
            const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
            if (page) return page.webSocketDebuggerUrl;
        } catch (error) {
            // Chrome is still starting.
        }
    }
    throw new Error('CDP target not found');
}

const args = parseArgs(process.argv.slice(2));
const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chromePath) throw new Error('Chrome not found; set CHROME_PATH');

// The Chrome profile lives in the OS temp dir, never in the repository: a stale
// profile inside the working tree is the usual reason a second run cannot attach.
const port = Number(process.env.FRAME_STATS_PORT || 9395);
const profile = join(tmpdir(), 'vasilisa-frame-stats');
const chrome = spawn(chromePath, [
    '--headless=new',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--disable-extensions',
    '--no-first-run',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${args.width},${args.height}`,
    args.url
], { stdio: 'ignore' });

const socket = new WebSocket(await connect(port));
await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const resolve = pending.get(message.id);
    if (!resolve) return;
    pending.delete(message.id);
    resolve(message.result);
});

function command(method, params = {}) {
    const id = nextId++;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => pending.set(id, resolve));
}

await command('Page.enable');
// The scene is built (layout validation, world, shader compile) before the first
// frame, and SwiftShader is slow: settle before touching anything.
await sleep(args.settle);

// Held keys first, then the taps: a close-up is "walk there, then orbit to face
// it", and a rawKeyDown followed straight by keyUp never advances a gait.
for (const entry of args.hold.split(',').filter(Boolean)) {
    const [letter, duration] = entry.split(':');
    const key = KEY_MAP[letter];
    if (!key) continue;
    const event = {
        code: key.code,
        key: key.key,
        windowsVirtualKeyCode: key.vk,
        nativeVirtualKeyCode: key.vk
    };
    await command('Input.dispatchKeyEvent', { ...event, type: 'rawKeyDown' });
    await sleep(Number(duration) || 1000);
    await command('Input.dispatchKeyEvent', { ...event, type: 'keyUp' });
    // The gait blends out over a few hundred milliseconds; let it settle.
    await sleep(800);
}

for (const letter of args.keys) {
    const key = KEY_MAP[letter];
    if (!key) continue;
    const event = {
        code: key.code,
        key: key.key,
        windowsVirtualKeyCode: key.vk,
        nativeVirtualKeyCode: key.vk
    };
    await command('Input.dispatchKeyEvent', { ...event, type: 'rawKeyDown' });
    await command('Input.dispatchKeyEvent', { ...event, type: 'keyUp' });
    // Let transitions and blends settle (overview blend runs at 4/s).
    await sleep(1400);
}

const stats = await command('Runtime.evaluate', { expression: statsExpression(args.rect), returnByValue: true });
console.log(stats.result.value);

// Optional assertion hook: read anything out of the page (a debug readout, a
// uniform, a scene node) and print it. Keeps the harness usable for checks that
// are not a pixel histogram.
if (args.eval) {
    const extra = await command('Runtime.evaluate', { expression: args.eval, returnByValue: true });
    console.log(JSON.stringify(extra.result ? extra.result.value : null));
}

if (args.diff) {
    const diff = await command('Runtime.evaluate', {
        expression: diffExpression(Number(args.diff), args.rect),
        awaitPromise: true,
        returnByValue: true
    });
    console.log(diff.result.value);
}

if (args.out) {
    const shot = await command('Page.captureScreenshot', { format: 'png' });
    writeFileSync(args.out, Buffer.from(shot.data, 'base64'));
}

socket.close();
chrome.kill();
