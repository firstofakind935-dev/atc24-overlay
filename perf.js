// Computed flap & thrust performance. Pure logic — no DOM.
// Estimates in the same spirit as the V-speed model: plausible, deterministic,
// driven by aircraft baseline + weight + runway + cruise FL. Not a real engine model.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PerfModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // flapMax  = number of flap notches (landing/full = flapMax)
  // toFlapBase = baseline takeoff notch at nominal load
  // n1       = baseline thrust % per phase at nominal load (loadTO/LD = 0.85)
  const PERF = {
    'A220':    { flapMax: 4, toFlapBase: 1, n1: { to: 89, clb: 84, crz: 79, des: 37, ldg: 59 } },
    'A320':    { flapMax: 4, toFlapBase: 1, n1: { to: 90, clb: 85, crz: 80, des: 38, ldg: 60 } },
    'A330':    { flapMax: 4, toFlapBase: 2, n1: { to: 91, clb: 86, crz: 81, des: 38, ldg: 61 } },
    'A340':    { flapMax: 4, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 82, des: 38, ldg: 61 } },
    'A350':    { flapMax: 4, toFlapBase: 2, n1: { to: 90, clb: 85, crz: 80, des: 38, ldg: 60 } },
    'A380':    { flapMax: 4, toFlapBase: 2, n1: { to: 90, clb: 86, crz: 82, des: 38, ldg: 60 } },
    'BELUGAXL':{ flapMax: 4, toFlapBase: 2, n1: { to: 91, clb: 86, crz: 81, des: 38, ldg: 61 } },
    'B707':    { flapMax: 5, toFlapBase: 1, n1: { to: 92, clb: 87, crz: 82, des: 40, ldg: 62 } },
    'B727':    { flapMax: 5, toFlapBase: 2, n1: { to: 93, clb: 88, crz: 82, des: 40, ldg: 63 } },
    'B737':    { flapMax: 5, toFlapBase: 1, n1: { to: 92, clb: 86, crz: 81, des: 40, ldg: 62 } },
    'B747':    { flapMax: 5, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 83, des: 40, ldg: 62 } },
    'B757':    { flapMax: 5, toFlapBase: 1, n1: { to: 91, clb: 86, crz: 81, des: 40, ldg: 61 } },
    'B767':    { flapMax: 5, toFlapBase: 1, n1: { to: 91, clb: 86, crz: 81, des: 40, ldg: 61 } },
    'B777':    { flapMax: 5, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 83, des: 40, ldg: 62 } },
    'B787':    { flapMax: 5, toFlapBase: 2, n1: { to: 90, clb: 86, crz: 82, des: 39, ldg: 61 } },
    'ATR-72':  { flapMax: 3, toFlapBase: 1, n1: { to: 88, clb: 82, crz: 70, des: 35, ldg: 55 } },
    'CRJ700':  { flapMax: 4, toFlapBase: 1, n1: { to: 90, clb: 84, crz: 78, des: 37, ldg: 59 } },
    'Q400':    { flapMax: 3, toFlapBase: 1, n1: { to: 88, clb: 82, crz: 71, des: 35, ldg: 56 } },
    'L-1011':  { flapMax: 5, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 82, des: 40, ldg: 62 } },
    'DC-10':   { flapMax: 5, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 82, des: 40, ldg: 62 } },
    'MD-11':   { flapMax: 5, toFlapBase: 2, n1: { to: 92, clb: 87, crz: 83, des: 40, ldg: 62 } },
    'MD-90':   { flapMax: 5, toFlapBase: 1, n1: { to: 91, clb: 86, crz: 81, des: 40, ldg: 61 } },
    'AN-22':   { flapMax: 3, toFlapBase: 1, n1: { to: 90, clb: 84, crz: 72, des: 36, ldg: 58 } },
    'AN-225':  { flapMax: 4, toFlapBase: 2, n1: { to: 93, clb: 88, crz: 84, des: 40, ldg: 63 } },
    'COMET':   { flapMax: 4, toFlapBase: 1, n1: { to: 90, clb: 85, crz: 80, des: 40, ldg: 60 } },
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Deterministic per-runway nudge: 0 or +1, stable for a given runway string.
  function rwyFactor(rwy) {
    if (!rwy) return 0;
    let h = 0;
    const s = String(rwy).toUpperCase();
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 2;
  }

  // d:       dispatch payload ({ aircraft, depRwy, arrRwy, fl, ... })
  // weights: { tow, ldw, mtow, mlw } in kg. Any falsy → null returned.
  function computePerf(d, weights) {
    const ac = ((d && d.aircraft) || '').toUpperCase();
    const base = PERF[ac];
    if (!base) return null;
    const w = weights || {};
    if (!(w.tow > 0) || !(w.ldw > 0) || !(w.mtow > 0) || !(w.mlw > 0)) return null;

    const loadTO = clamp(w.tow / w.mtow, 0.5, 1.05);
    const loadLD = clamp(w.ldw / w.mlw, 0.5, 1.05);
    const heavyTO = loadTO > 0.90;
    const lightLD = loadLD < 0.70;
    const rwyTO = rwyFactor(d && d.depRwy);
    const flHi = Number(d && d.fl) >= 300;

    const toFlap = clamp(base.toFlapBase + (heavyTO ? 1 : 0) + rwyTO, 1, base.flapMax - 1);
    const ldgFlap = base.flapMax - (lightLD ? 1 : 0);

    const n1 = {
      to:  clamp(Math.round(base.n1.to  + (loadTO - 0.85) * 18), 30, 100),
      clb: clamp(Math.round(base.n1.clb + (loadTO - 0.85) * 6 + (flHi ? 1 : 0)), 30, 100),
      crz: clamp(Math.round(base.n1.crz + (flHi ? 2 : 0)), 30, 100),
      des: base.n1.des,
      ldg: clamp(Math.round(base.n1.ldg + (loadLD - 0.85) * 10 + (lightLD ? -1 : 0)), 30, 100),
    };

    return { toFlap, ldgFlap, n1 };
  }

  return { PERF, clamp, rwyFactor, computePerf };
});
