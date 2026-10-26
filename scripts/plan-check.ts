// Layout validation CLI: runs the pure planner in Node and prints the report.
// The browser validates the same layout on every load; this harness exists so a
// plan change can be checked without a browser (?debug=layout shows the plan).
import { createLayout } from '../src/world/layout/createLayout.js';

const built = createLayout({ verifyDeterminism: true });
const { layout, masks, grid, validation } = built;

console.log(`layout hash ${layout.configHash}, seed ${layout.seed}, generator ${layout.generatorVersion}`);
console.log(`serialized ${built.serialized.length} bytes, second run identical ${validation.checks.some((check) => check.id === 'DETERMINISM' && check.passed)}`);
console.log(
    `masks: asphalt ${masks.areas.asphalt.toFixed(2)} m2, sidewalk ${masks.areas.sidewalk.toFixed(2)} m2, ` +
        `pedestrian ${masks.areas.pedestrian.toFixed(2)} m2, paving ${masks.areas.paving.toFixed(2)} m2, ` +
        `crossing ${masks.areas.crossing.toFixed(2)} m2`
);
console.log(
    `grid ${grid.nx} x ${grid.nz}, curbs ${layout.curbs.length} segments / ${layout.maskSummary.curbLength.toFixed(2)} m, ` +
        `crossings ${layout.crossings.length}`
);

interface RuleTally {
    passed: number;
    failed: number;
    details: string[];
}

const byId = new Map<string, RuleTally>();
validation.checks.forEach((check) => {
    const entry = byId.get(check.id) || { passed: 0, failed: 0, details: [] };
    if (check.passed) entry.passed += 1;
    else {
        entry.failed += 1;
        entry.details.push(check.detail);
    }
    byId.set(check.id, entry);
});

console.log(`\n${validation.checks.length} checks, ${validation.errors.length} errors, ${byId.size} distinct rules`);
byId.forEach((entry, id) => {
    const state = entry.failed === 0 ? 'OK  ' : 'FAIL';
    console.log(`${state} ${id}: ${entry.passed} passed${entry.failed ? `, ${entry.failed} failed` : ''}`);
    entry.details.forEach((detail) => console.log(`       - ${detail}`));
});

console.log('\nmeasurements:');
Object.keys(validation.measurements)
    .sort()
    .forEach((key) => console.log(`  ${key} = ${validation.measurements[key]}`));

if (validation.errors.length) {
    console.log('\nERRORS:');
    validation.errors.forEach((error) => console.log(`  ${error}`));
    process.exitCode = 1;
}
