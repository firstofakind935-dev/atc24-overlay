const assert = require('node:assert/strict');
const { computePerf, rwyFactor, PERF } = require('../perf.js');

// Nominal load (loadTO = loadLD = 0.85), no runway, no FL → baseline values
{
  const p = computePerf({ aircraft: 'B737' }, { tow: 85, ldw: 85, mtow: 100, mlw: 100 });
  assert.deepEqual(p, { toFlap: 1, ldgFlap: 5, n1: { to: 92, clb: 86, crz: 81, des: 40, ldg: 62 } });
}

// Heavy takeoff (loadTO 0.95 > 0.90) + high cruise FL (>=300)
{
  const p = computePerf({ aircraft: 'B737', fl: '350' }, { tow: 95, ldw: 85, mtow: 100, mlw: 100 });
  assert.equal(p.toFlap, 2);          // +1 notch when heavy
  assert.equal(p.ldgFlap, 5);
  assert.equal(p.n1.to, 94);          // round(92 + (0.95-0.85)*18)
  assert.equal(p.n1.clb, 88);         // round(86 + 0.10*6 + 1)
  assert.equal(p.n1.crz, 83);         // 81 + 2 (high FL)
}

// Light landing (loadLD 0.65 < 0.70) → one notch less landing flap + lower landing N1
{
  const p = computePerf({ aircraft: 'B737' }, { tow: 85, ldw: 65, mtow: 100, mlw: 100 });
  assert.equal(p.ldgFlap, 4);
  assert.equal(p.n1.ldg, 59);         // round(62 + (0.65-0.85)*10 - 1)
}

// Unknown aircraft → null
assert.equal(computePerf({ aircraft: 'F16' }, { tow: 50, ldw: 50, mtow: 100, mlw: 100 }), null);

// Missing weights → null
assert.equal(computePerf({ aircraft: 'B737' }, null), null);
assert.equal(computePerf({ aircraft: 'B737' }, { tow: 0, ldw: 0, mtow: 0, mlw: 0 }), null);
assert.equal(computePerf(null, { tow: 85, ldw: 85, mtow: 100, mlw: 100 }), null);

// rwyFactor is deterministic and 0-or-1
{
  const a = rwyFactor('27L'), b = rwyFactor('27L');
  assert.equal(a, b);
  assert.ok(a === 0 || a === 1);
  assert.equal(rwyFactor(''), 0);
  assert.equal(rwyFactor(undefined), 0);
}

// Runway factor path + concrete values (A320, depRwy '09R' → rwyFactor 1)
{
  const d = { aircraft: 'A320', depRwy: '09R', fl: '120' };
  const w = { tow: 70, ldw: 60, mtow: 90, mlw: 80 };
  const p = computePerf(d, w);
  assert.deepEqual(p, { toFlap: 2, ldgFlap: 4, n1: { to: 89, clb: 85, crz: 80, des: 38, ldg: 59 } });
  // determinism: identical inputs → identical output
  assert.deepEqual(computePerf(d, w), p);
}

// All N1 outputs stay within [30, 100] even at extreme weight
for (const ac of Object.keys(PERF)) {
  const p = computePerf({ aircraft: ac, fl: '400' }, { tow: 999, ldw: 999, mtow: 100, mlw: 100 });
  for (const phase of ['to', 'clb', 'crz', 'des', 'ldg']) {
    assert.ok(p.n1[phase] >= 30 && p.n1[phase] <= 100, `${ac} ${phase}=${p.n1[phase]} out of band`);
  }
  assert.ok(p.toFlap >= 1 && p.toFlap <= PERF[ac].flapMax - 1, `${ac} toFlap out of band`);
}

console.log('perf.test.js: all assertions passed');
