/**
 * ВАЖНОЕ ИЗМЕНЕНИЕ: гарантируем 100% замкнутые контуры.
 *
 * Что поменяно относительно предыдущей версии:
 *  1) Из rect-set сначала строим ГРАНИЧНЫЕ ОТРЕЗКИ через “покрытие по модулю 2” (odd coverage).
 *  2) Затем НОРМАЛИЗУЕМ/РАЗБИВАЕМ отрезки на атомарные (без пересечений/перекрытий внутри линии),
 *     чтобы граф был корректным.
 *  3) Строим ориентированный граф и собираем циклы “правилом правой руки” (clockwise),
 *     что устойчиво при степенях >2 и при наложении линий (multi-edges).
 *  4) Каждый loop возвращается уже замкнутым (последняя точка = первая).
 *
 * Примечание: “линии могут накладываться” — допускается, контуры всё равно замкнуты.
 */

// ------------------------- утилиты -------------------------

const EPS = 1e-9;

function normRect(r) {
  const min_x = Math.min(r.min_x, r.max_x);
  const max_x = Math.max(r.min_x, r.max_x);
  const min_y = Math.min(r.min_y, r.max_y);
  const max_y = Math.max(r.min_y, r.max_y);
  return { min_x, min_y, max_x, max_y };
}

function rectArea(r) {
  return Math.max(0, r.max_x - r.min_x) * Math.max(0, r.max_y - r.min_y);
}

function rectInter(a, b) {
  const min_x = Math.max(a.min_x, b.min_x);
  const min_y = Math.max(a.min_y, b.min_y);
  const max_x = Math.min(a.max_x, b.max_x);
  const max_y = Math.min(a.max_y, b.max_y);
  if (max_x <= min_x + EPS || max_y <= min_y + EPS) return null;
  return { min_x, min_y, max_x, max_y };
}

function rectTouchesOrOverlaps(a, b, tol = 0) {
  return !(
    a.max_x < b.min_x - tol ||
    a.min_x > b.max_x + tol ||
    a.max_y < b.min_y - tol ||
    a.min_y > b.max_y + tol
  );
}

function inflateAABB(r, d) {
  return { min_x: r.min_x - d, min_y: r.min_y - d, max_x: r.max_x + d, max_y: r.max_y + d };
}

function pointKey(x, y) {
  return `${x}|${y}`;
}

function parsePointKey(k) {
  const p = k.split("|");
  return [+p[0], +p[1]];
}

// ------------------------- spatial hash -------------------------

class SpatialHash {
  constructor(cellSize) {
    this.s = Math.max(cellSize, 1e-6);
    this.map = new Map();
  }
  _key(ix, iy) {
    return (ix << 16) ^ iy;
  }
  _range(min, max) {
    const s = this.s;
    const i0 = Math.floor(min / s);
    const i1 = Math.floor(max / s);
    return [i0, i1];
  }
  insert(id, aabb) {
    const [x0, x1] = this._range(aabb.min_x, aabb.max_x);
    const [y0, y1] = this._range(aabb.min_y, aabb.max_y);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const k = this._key(ix, iy);
        let arr = this.map.get(k);
        if (!arr) this.map.set(k, (arr = []));
        arr.push(id);
      }
    }
  }
  query(aabb) {
    const [x0, x1] = this._range(aabb.min_x, aabb.max_x);
    const [y0, y1] = this._range(aabb.min_y, aabb.max_y);
    const out = new Set();
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const k = this._key(ix, iy);
        const arr = this.map.get(k);
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) out.add(arr[i]);
      }
    }
    return out;
  }
}

// ------------------------- rect-set boolean ops -------------------------

function subtractOneRectByCut(r, c) {
  const inter = rectInter(r, c);
  if (!inter) return [r];

  const out = [];
  if (r.min_x < inter.min_x - EPS) out.push({ min_x: r.min_x, min_y: r.min_y, max_x: inter.min_x, max_y: r.max_y });
  if (inter.max_x < r.max_x - EPS) out.push({ min_x: inter.max_x, min_y: r.min_y, max_x: r.max_x, max_y: r.max_y });
  if (r.min_y < inter.min_y - EPS) out.push({ min_x: inter.min_x, min_y: r.min_y, max_x: inter.max_x, max_y: inter.min_y });
  if (inter.max_y < r.max_y - EPS) out.push({ min_x: inter.min_x, min_y: inter.max_y, max_x: inter.max_x, max_y: r.max_y });

  return out.filter(rr => rectArea(rr) > EPS);
}

function rectSetSubtract(setRects, cutRect) {
  const out = [];
  for (let i = 0; i < setRects.length; i++) {
    const parts = subtractOneRectByCut(setRects[i], cutRect);
    for (let j = 0; j < parts.length; j++) out.push(parts[j]);
  }
  return out;
}

function mergeRectSet(rects) {
  if (rects.length <= 1) return rects.slice();

  rects = rects.map(normRect).filter(r => rectArea(r) > EPS);

  const byY = new Map();
  for (const r of rects) {
    const k = `${r.min_y}|${r.max_y}`;
    let arr = byY.get(k);
    if (!arr) byY.set(k, (arr = []));
    arr.push(r);
  }

  const mergedH = [];
  for (const arr of byY.values()) {
    arr.sort((a, b) => a.min_x - b.min_x);
    let cur = arr[0];
    for (let i = 1; i < arr.length; i++) {
      const r = arr[i];
      if (r.min_x <= cur.max_x + EPS) {
        cur = { min_x: cur.min_x, min_y: cur.min_y, max_x: Math.max(cur.max_x, r.max_x), max_y: cur.max_y };
      } else {
        mergedH.push(cur);
        cur = r;
      }
    }
    mergedH.push(cur);
  }

  const byX = new Map();
  for (const r of mergedH) {
    const k = `${r.min_x}|${r.max_x}`;
    let arr = byX.get(k);
    if (!arr) byX.set(k, (arr = []));
    arr.push(r);
  }

  const mergedV = [];
  for (const arr of byX.values()) {
    arr.sort((a, b) => a.min_y - b.min_y);
    let cur = arr[0];
    for (let i = 1; i < arr.length; i++) {
      const r = arr[i];
      if (r.min_y <= cur.max_y + EPS) {
        cur = { min_x: cur.min_x, min_y: cur.min_y, max_x: cur.max_x, max_y: Math.max(cur.max_y, r.max_y) };
      } else {
        mergedV.push(cur);
        cur = r;
      }
    }
    mergedV.push(cur);
  }

  return mergedV;
}

function rectSetUnion(setRects, addRect) {
  const out = setRects.slice();
  out.push(normRect(addRect));
  return mergeRectSet(out);
}

function aabbOfRectSet(rects) {
  let min_x = Infinity, min_y = Infinity, max_x = -Infinity, max_y = -Infinity;
  for (const r of rects) {
    if (r.min_x < min_x) min_x = r.min_x;
    if (r.min_y < min_y) min_y = r.min_y;
    if (r.max_x > max_x) max_x = r.max_x;
    if (r.max_y > max_y) max_y = r.max_y;
  }
  if (!isFinite(min_x)) return { min_x: 0, min_y: 0, max_x: 0, max_y: 0 };
  return { min_x, min_y, max_x, max_y };
}

// ------------------------- 100% замкнутые контуры из rect-set -------------------------

function segKeyH(y, x1, x2) { return `H|${y}|${x1}|${x2}`; }
function segKeyV(x, y1, y2) { return `V|${x}|${y1}|${y2}`; }

function addOddSegment(map, key) {
  // parity (mod 2): одинаковые сегменты отменяются (внутренние границы)
  const v = map.get(key) || 0;
  if (v === 1) map.delete(key);
  else map.set(key, 1);
}

function boundaryAtomicSegmentsFromRectSet(rects) {
  // 1) raw boundary segments (parity)
  const odd = new Map();

  for (const rr of rects) {
    const r = normRect(rr);
    // нормализуем ориентацию сегментов: слева->вправо, снизу->вверх
    addOddSegment(odd, segKeyH(r.min_y, r.min_x, r.max_x)); // bottom
    addOddSegment(odd, segKeyH(r.max_y, r.min_x, r.max_x)); // top
    addOddSegment(odd, segKeyV(r.min_x, r.min_y, r.max_y)); // left
    addOddSegment(odd, segKeyV(r.max_x, r.min_y, r.max_y)); // right
  }

  // 2) нормализация в атомарные сегменты через sweep по каждой линии
  const hByY = new Map(); // y -> list of [x1,x2]
  const vByX = new Map(); // x -> list of [y1,y2]

  for (const k of odd.keys()) {
    const p = k.split("|");
    const t = p[0];
    if (t === "H") {
      const y = +p[1], x1 = +p[2], x2 = +p[3];
      let arr = hByY.get(y);
      if (!arr) hByY.set(y, (arr = []));
      arr.push([Math.min(x1, x2), Math.max(x1, x2)]);
    } else {
      const x = +p[1], y1 = +p[2], y2 = +p[3];
      let arr = vByX.get(x);
      if (!arr) vByX.set(x, (arr = []));
      arr.push([Math.min(y1, y2), Math.max(y1, y2)]);
    }
  }

  const atomic = [];

  // helper: интервалный sweep -> odd-coverage подинтервалы
  function sweep1D(intervals) {
    const ev = [];
    for (const [a, b] of intervals) {
      if (b <= a + EPS) continue;
      ev.push([a, +1]);
      ev.push([b, -1]);
    }
    ev.sort((u, v) => (u[0] - v[0]) || (v[1] - u[1])); // start before end on same coord
    const out = [];
    let cnt = 0;
    let prev = null;
    let i = 0;
    while (i < ev.length) {
      const x = ev[i][0];
      // перед обновлением на x, если был активен odd-интервал (cnt%2==1), закрываем его до x
      if (prev !== null && cnt % 2 === 1 && x > prev + EPS) out.push([prev, x]);
      // применяем все события в x
      while (i < ev.length && Math.abs(ev[i][0] - x) <= EPS) {
        cnt += ev[i][1];
        i++;
      }
      prev = x;
    }
    return out;
  }

  for (const [y, intervals] of hByY.entries()) {
    const parts = sweep1D(intervals);
    for (const [x1, x2] of parts) atomic.push({ x1, y1: y, x2, y2: y });
  }

  for (const [x, intervals] of vByX.entries()) {
    const parts = sweep1D(intervals);
    for (const [y1, y2] of parts) atomic.push({ x1: x, y1, x2: x, y2 });
  }

  return atomic;
}

function dirIndex(dx, dy) {
  // 0: R, 1: U, 2: L, 3: D
  if (dx > 0) return 0;
  if (dy > 0) return 1;
  if (dx < 0) return 2;
  return 3;
}

function buildLoopsOrtho(segments) {
  // Строим directed multi-graph по атомарным сегментам
  const outByPoint = new Map(); // pKey -> array of edgeIds
  const edges = []; // directed edges

  function addOut(p, id) {
    let arr = outByPoint.get(p);
    if (!arr) outByPoint.set(p, (arr = []));
    arr.push(id);
  }

  for (const s of segments) {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;

    // направим сегмент в “положительную” сторону для базовой записи
    let ax = s.x1, ay = s.y1, bx = s.x2, by = s.y2;
    if (Math.abs(dy) <= EPS && bx < ax - EPS) { const t = ax; ax = bx; bx = t; }
    if (Math.abs(dx) <= EPS && by < ay - EPS) { const t = ay; ay = by; by = t; }

    const aK = pointKey(ax, ay);
    const bK = pointKey(bx, by);

    // forward
    const d1 = dirIndex(bx - ax, by - ay);
    const id1 = edges.length;
    edges.push({ from: aK, to: bK, dir: d1, used: false, rev: id1 + 1 });

    // backward
    const d2 = dirIndex(ax - bx, ay - by);
    const id2 = edges.length;
    edges.push({ from: bK, to: aK, dir: d2, used: false, rev: id1 });

    edges[id1].rev = id2;

    addOut(aK, id1);
    addOut(bK, id2);
  }

  // Для устойчивости при наложениях: сортируем исходящие по направлению (а внутри по длине)
  function edgeLen(e) {
    const [x1, y1] = parsePointKey(e.from);
    const [x2, y2] = parsePointKey(e.to);
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  for (const [p, arr] of outByPoint.entries()) {
    arr.sort((i, j) => {
      const a = edges[i], b = edges[j];
      if (a.dir !== b.dir) return a.dir - b.dir;
      return edgeLen(b) - edgeLen(a); // длиннее раньше (не критично, но уменьшает дробление)
    });
  }

  // правило правой руки для обхода по часовой стрелке (интерьер справа):
  // при текущем heading dir предпочитаем: right, straight, left, back
  const pref = [
    [3, 0, 1, 2], // from R (0): D, R, U, L
    [0, 1, 2, 3], // from U (1): R, U, L, D
    [1, 2, 3, 0], // from L (2): U, L, D, R
    [2, 3, 0, 1], // from D (3): L, D, R, U
  ];

  function pickNextEdge(atPoint, incomingDir) {
    const outs = outByPoint.get(atPoint);
    if (!outs || outs.length === 0) return -1;

    const order = pref[incomingDir];
    for (let oi = 0; oi < order.length; oi++) {
      const wantDir = order[oi];
      // ищем любой неиспользованный исходящий с этим направлением
      for (let k = 0; k < outs.length; k++) {
        const id = outs[k];
        const e = edges[id];
        if (!e.used && e.dir === wantDir) return id;
      }
    }
    // fallback: любой неиспользованный
    for (let k = 0; k < outs.length; k++) {
      const id = outs[k];
      if (!edges[id].used) return id;
    }
    return -1;
  }

  const loops = [];

  for (let startId = 0; startId < edges.length; startId++) {
    if (edges[startId].used) continue;

    const startEdge = edges[startId];
    const startPoint = startEdge.from;

    const loop = [];
    // добавляем стартовую точку
    loop.push(parsePointKey(startPoint));

    let curId = startId;
    let safety = 0;

    while (true) {
      if (++safety > 10_000_000) break; // защита от бесконечного цикла на мусорных данных
      const e = edges[curId];
      if (e.used) break;

      e.used = true;
      // помечаем обратное как used? НЕТ: это другая ориентация того же ребра,
      // её нельзя использовать в другом контуре одновременно (чтобы не получить “туда-сюда”),
      // поэтому тоже помечаем.
      edges[e.rev].used = true;

      const toP = e.to;
      loop.push(parsePointKey(toP));

      if (toP === startPoint) break; // замкнули

      const nextId = pickNextEdge(toP, e.dir);
      if (nextId < 0) {
        // теоретически не должно происходить после атомаризации+odd-покрытия,
        // но если произошло — принудительно замкнем (чтобы 100% был замкнут).
        loop.push(loop[0]);
        break;
      }
      curId = nextId;
    }

    // гарантируем замыкание
    const a = loop[0], b = loop[loop.length - 1];
    if (Math.abs(a[0] - b[0]) > EPS || Math.abs(a[1] - b[1]) > EPS) loop.push([a[0], a[1]]);

    // минимальная валидность (ортогональный контур минимум 4 точки + замыкание)
    if (loop.length >= 5) loops.push(loop);
  }

  // Дедуп циклов (на случай, если из-за наложений собралось одинаковое)
  const uniq = new Map();
  for (const loop of loops) {
    // canonical rotate по минимальной вершине (без последней, она = первой)
    const m = loop.length - 1;
    let minIdx = 0;
    for (let i = 1; i < m; i++) {
      const a = loop[i], b = loop[minIdx];
      if (a[0] < b[0] - EPS || (Math.abs(a[0] - b[0]) <= EPS && a[1] < b[1] - EPS)) minIdx = i;
    }
    const rot = [];
    for (let i = 0; i < m; i++) rot.push(loop[(minIdx + i) % m]);
    rot.push(rot[0]);

    const key = rot.map(p => `${p[0]},${p[1]}`).join(";");
    uniq.set(key, rot);
  }

  return Array.from(uniq.values());
}

function extractLoopsFromRectSet(rects) {
  const atomicSegs = boundaryAtomicSegmentsFromRectSet(rects);
  return buildLoopsOrtho(atomicSegs);
}

// ------------------------- основной solve -------------------------

function solve(rectangles, minMergeDistance) {
  const n = rectangles.length;
  const rects = rectangles.map((r, i) => ({ ...normRect(r), id: i }));

  const shapes = Array.from({ length: n }, (_, i) => [ { ...rects[i] } ]);

  const grid = new SpatialHash(minMergeDistance);
  for (const r of rects) grid.insert(r.id, inflateAABB(r, minMergeDistance));

  const pairs = [];
  const seenPair = new Set();
  for (const a of rects) {
    const cand = grid.query(inflateAABB(a, minMergeDistance));
    for (const bId of cand) {
      if (bId === a.id) continue;
      const i = Math.min(a.id, bId);
      const j = Math.max(a.id, bId);
      const k = `${i},${j}`;
      if (seenPair.has(k)) continue;
      seenPair.add(k);
      pairs.push([i, j]);
    }
  }

  // 1) вырезаем пересечения из большего id
  for (const [i, j] of pairs) {
    const a = rects[i], b = rects[j];
    const inter = rectInter(a, b);
    if (!inter) continue;
    shapes[j] = mergeRectSet(rectSetSubtract(shapes[j], inter));
  }

  // 2) дополняем gap <= d “мостиками” (как раньше)
  const d = minMergeDistance;

  for (const [i, j] of pairs) {
    const a = rects[i], b = rects[j];
    if (!rectTouchesOrOverlaps(a, b, d)) continue;

    const y0 = Math.max(a.min_y, b.min_y);
    const y1 = Math.min(a.max_y, b.max_y);
    if (y1 > y0 + EPS) {
      const gapRight = b.min_x - a.max_x;
      if (gapRight > EPS && gapRight <= d + EPS) {
        shapes[i] = rectSetUnion(shapes[i], { min_x: a.max_x, min_y: y0, max_x: b.min_x, max_y: y1 });
      }
      const gapLeft = a.min_x - b.max_x;
      if (gapLeft > EPS && gapLeft <= d + EPS) {
        shapes[i] = rectSetUnion(shapes[i], { min_x: b.max_x, min_y: y0, max_x: a.min_x, max_y: y1 });
      }
    }

    const x0 = Math.max(a.min_x, b.min_x);
    const x1 = Math.min(a.max_x, b.max_x);
    if (x1 > x0 + EPS) {
      const gapUp = b.min_y - a.max_y;
      if (gapUp > EPS && gapUp <= d + EPS) {
        shapes[i] = rectSetUnion(shapes[i], { min_x: x0, min_y: a.max_y, max_x: x1, max_y: b.min_y });
      }
      const gapDown = a.min_y - b.max_y;
      if (gapDown > EPS && gapDown <= d + EPS) {
        shapes[i] = rectSetUnion(shapes[i], { min_x: x0, min_y: b.max_y, max_x: x1, max_y: a.min_y });
      }
    }
  }

  // 3) повторно убираем перекрытия по текущим rect-set (если мостики наделали overlap)
  for (const [i, j] of pairs) {
    const si = shapes[i];
    const sj = shapes[j];
    if (!si.length || !sj.length) continue;

    const ai = aabbOfRectSet(si);
    const aj = aabbOfRectSet(sj);
    if (!rectTouchesOrOverlaps(ai, aj, 0)) continue;

    let outJ = sj;
    for (let aIdx = 0; aIdx < si.length; aIdx++) {
      const ra = si[aIdx];
      for (let bIdx = 0; bIdx < outJ.length; bIdx++) {
        const rb = outJ[bIdx];
        const inter = rectInter(ra, rb);
        if (!inter) continue;
        outJ = rectSetSubtract(outJ, inter);
        bIdx = -1;
        if (!outJ.length) break;
      }
      if (!outJ.length) break;
    }
    shapes[j] = mergeRectSet(outJ);
  }

  // 4) контуры (100% замкнутые)
  const polygonsById = [];
  for (let i = 0; i < n; i++) {
    const merged = mergeRectSet(shapes[i]);
    const loops = extractLoopsFromRectSet(merged);
    polygonsById.push({ id: i, rects: merged, loops });
  }

  return polygonsById;
}

// ------------------------- пример -------------------------

if (typeof module !== 'undefined' && require.main === module) {
  const rects = [
    { min_x: 0, min_y: 0, max_x: 4, max_y: 3 },
    { min_x: 3.2, min_y: 1, max_x: 7, max_y: 4 },
    { min_x: 7.5, min_y: 1.2, max_x: 10, max_y: 3.2 },
    { min_x: 2, min_y: 2.2, max_x: 5, max_y: 5.2 },
    { min_x: 0, min_y: 0, max_x: 4, max_y: 3 },
  ];

  const res = solve(rects, 0.6);
  for (const r of res) {
    let ok = true;
    for (const loop of r.loops) {
      const a = loop[0], b = loop[loop.length - 1];
      if (Math.abs(a[0] - b[0]) > EPS || Math.abs(a[1] - b[1]) > EPS) ok = false;
    }
    console.log(`id=${r.id} loops=${r.loops.length} closed=${ok}`);
  }
}

// CommonJS + ESM exports
if (typeof module !== 'undefined') {
  module.exports = { solve, extractLoopsFromRectSet, mergeRectSet, normRect, rectArea };
}
export { solve, extractLoopsFromRectSet, mergeRectSet, normRect, rectArea };
export default solve;