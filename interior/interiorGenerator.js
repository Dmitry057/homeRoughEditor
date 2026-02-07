/**
 * interiorGenerator.js
 * Main orchestrator for interior wall generation.
 * Currently: Voronoi → AABB rectangles (visualization stage).
 */

import { segmentsToPolygon, computeVoronoiCells, renderVoronoiDebug, clearVoronoiDebug } from './voronoiRooms.js';
import { solve as nearMergeSolve, extractLoopsFromRectSet, mergeRectSet, normRect, rectArea } from './nearEdgeMerger.js';

function InteriorGenerator(config) {
  config = config || {};
  this.config = {
    targetRoomRatio: config.targetRoomRatio || 3,
    interiorThickness: config.interiorThickness || 10,
    doorWidth: config.doorWidth || 66,
    doorProbability: config.doorProbability || 0.3,
    minWallLength: config.minWallLength || 20,
    mergeRay: config.mergeRay !== undefined ? config.mergeRay : 8,
    mergeProb: config.mergeProb !== undefined ? config.mergeProb : 0.5
  };

  this.showVoronoi = false;
  this.builtWalls = [];
  this.rooms = [];
  this.cells = [];
  this.cellToRoom = {};
  this.boundaryPolygon = [];
  this.delaunay = null;
}

InteriorGenerator.prototype.generate = function (nodes, edges, boundarySegments) {
  this.clear();

  if (!nodes || nodes.length < 3 || !boundarySegments || boundarySegments.length < 3) {
    console.warn('InteriorGenerator: insufficient data (need 3+ nodes and 3+ boundary segments)');
    return { rooms: [], walls: [], cells: [], boundaryPolygon: [] };
  }

  // Step 1: Convert boundary segments to polygon
  console.time('  6a. Segments -> polygon');
  this.boundaryPolygon = segmentsToPolygon(boundarySegments);
  console.timeEnd('  6a. Segments -> polygon');
  console.log('    Boundary vertices:', this.boundaryPolygon.length);

  if (this.boundaryPolygon.length < 3) {
    console.warn('InteriorGenerator: could not build boundary polygon from segments');
    return { rooms: [], walls: [], cells: [], boundaryPolygon: [] };
  }

  // Step 2: Compute Voronoi cells with AABB rects (filtered by boundary via rayCasting)
  console.time('  6b. Voronoi cells + AABB');
  var voronoiResult = computeVoronoiCells(nodes, this.boundaryPolygon);
  this.cells = voronoiResult.cells;
  this.delaunay = voronoiResult.delaunay;
  console.timeEnd('  6b. Voronoi cells + AABB');
  console.log('    Voronoi cells:', this.cells.length);

  // Step 3: Merge rects using nearEdgeMerger (fast, no overlaps)
  console.time('  6c. Near-edge merge');
  var mergeResult = mergeCellsWithNearMerger(this.cells, this.config.mergeRay, this.config.mergeProb);
  this.rooms = mergeResult.rooms;
  this.cellToRoom = mergeResult.cellToRoom;
  console.timeEnd('  6c. Near-edge merge');
  console.log('    Rooms after merge:', this.rooms.length);

  // Debug visualization (AABB rectangles)
  if (this.showVoronoi) {
    var debugCells = this.rooms && this.rooms.length ? this.rooms : this.cells;
    renderVoronoiDebug(debugCells, this.cellToRoom);
  }

  return {
    rooms: this.rooms,
    walls: this.builtWalls,
    cells: this.cells,
    boundaryPolygon: this.boundaryPolygon,
    cellToRoom: this.cellToRoom
  };
};

InteriorGenerator.prototype.setShowVoronoi = function (show) {
  this.showVoronoi = show;
  if (show && this.cells.length > 0) {
    var debugCells = this.rooms && this.rooms.length ? this.rooms : this.cells;
    renderVoronoiDebug(debugCells, this.cellToRoom);
  } else {
    clearVoronoiDebug();
  }
};

InteriorGenerator.prototype.clear = function () {
  clearVoronoiDebug();
  this.builtWalls = [];
  this.rooms = [];
  this.cells = [];
  this.cellToRoom = {};
  this.boundaryPolygon = [];
  this.delaunay = null;
};

window.InteriorGenerator = InteriorGenerator;

export default InteriorGenerator;

// ============================================================================
// Helpers
// ============================================================================

function rectsOverlap(a, b, eps) {
  if (!a || !b) return false;
  eps = eps !== undefined ? eps : 0.5;
  return !(a.x + a.w <= b.x + eps ||
           b.x + b.w <= a.x + eps ||
           a.y + a.h <= b.y + eps ||
           b.y + b.h <= a.y + eps);
}

function rectToPolygon(rect) {
  if (!rect) return [];
  var x1 = rect.x, y1 = rect.y;
  var x2 = rect.x + rect.w, y2 = rect.y + rect.h;
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 }
  ];
}

/**
 * Compute union area and centroid of multiple axis-aligned rectangles.
 * Centroid is exact for the rect union.
 */
function unionAreaAndCentroid(rects) {
  if (!rects || rects.length === 0) {
    return { area: 0, centroid: { x: 0, y: 0 } };
  }

  var events = [];
  for (var i = 0; i < rects.length; i++) {
    var r = rects[i];
    events.push({ x: r.x, type: 1, y1: r.y, y2: r.y + r.h });
    events.push({ x: r.x + r.w, type: -1, y1: r.y, y2: r.y + r.h });
  }

  events.sort(function (a, b) {
    if (a.x === b.x) return b.type - a.type; // add before remove
    return a.x - b.x;
  });

  var active = [];
  var area = 0;
  var cxSum = 0;
  var cySum = 0;
  var prevX = events[0].x;

  function coverageStats(intervals) {
    if (intervals.length === 0) return { len: 0, yMoment: 0 };
    var segs = intervals.slice().sort(function (a, b) { return a.y1 - b.y1; });
    var merged = [];
    var cur = { y1: segs[0].y1, y2: segs[0].y2 };
    for (var i = 1; i < segs.length; i++) {
      if (segs[i].y1 <= cur.y2) {
        cur.y2 = Math.max(cur.y2, segs[i].y2);
      } else {
        merged.push(cur);
        cur = { y1: segs[i].y1, y2: segs[i].y2 };
      }
    }
    merged.push(cur);

    var len = 0;
    var yMoment = 0; // ∫ y dA over width=1
    for (var j = 0; j < merged.length; j++) {
      var h = merged[j].y2 - merged[j].y1;
      len += h;
      yMoment += (merged[j].y1 + merged[j].y2) / 2 * h;
    }
    return { len: len, yMoment: yMoment };
  }

  var e = 0;
  while (e < events.length) {
    var x = events[e].x;
    var dx = x - prevX;
    if (dx > 0 && active.length > 0) {
      var stats = coverageStats(active);
      var slabArea = stats.len * dx;
      area += slabArea;
      cxSum += ((x + prevX) / 2) * slabArea;
      cySum += stats.yMoment * dx;
    }

    // process all events at this x
    while (e < events.length && events[e].x === x) {
      var ev = events[e];
      if (ev.type === 1) {
        active.push({ y1: ev.y1, y2: ev.y2 });
      } else {
        for (var k = 0; k < active.length; k++) {
          if (active[k].y1 === ev.y1 && active[k].y2 === ev.y2) {
            active.splice(k, 1);
            break;
          }
        }
      }
      e++;
    }
    prevX = x;
  }

  var centroid = area > 0 ? { x: cxSum / area, y: cySum / area } : { x: 0, y: 0 };
  return { area: area, centroid: centroid };
}

/**
 * Compute outer boundary (axis-aligned segments) of union of rectangles.
 * Removes internal shared edges, keeps only exterior outline.
 *
 * @param {Array} rects - [{x,y,w,h}]
 * @returns {Array} segments - [{x1,y1,x2,y2}]
 */
function rectUnionOutline(rects) {
  if (!rects || rects.length === 0) return [];

  // Merge intervals helper
  function mergeIntervals(intervals) {
    if (!intervals || intervals.length === 0) return [];
    intervals.sort(function (a, b) { return a.start - b.start; });
    var res = [intervals[0]];
    for (var i = 1; i < intervals.length; i++) {
      var last = res[res.length - 1];
      var cur = intervals[i];
      if (cur.start <= last.end) {
        last.end = Math.max(last.end, cur.end);
      } else {
        res.push({ start: cur.start, end: cur.end });
      }
    }
    return res;
  }

  // Build sorted unique x coordinates
  var xs = [];
  for (var i = 0; i < rects.length; i++) {
    xs.push(rects[i].x);
    xs.push(rects[i].x + rects[i].w);
  }
  xs = Array.from(new Set(xs)).sort(function (a, b) { return a - b; });
  if (xs.length < 2) return [];

  // Coverage intervals per slab midpoint
  var slabCoverage = []; // index i -> coverage between xs[i] and xs[i+1]
  for (var xi = 0; xi < xs.length - 1; xi++) {
    var mid = (xs[xi] + xs[xi + 1]) / 2;
    var intervals = [];
    for (var r = 0; r < rects.length; r++) {
      var rect = rects[r];
      if (rect.x <= mid && rect.x + rect.w >= mid) {
        intervals.push({ start: rect.y, end: rect.y + rect.h });
      }
    }
    slabCoverage[xi] = mergeIntervals(intervals);
  }

  // Vertical edges via symmetric difference of coverage on left/right of each x
  function xorIntervals(a, b) {
    var result = [];
    // Simpler: build events
    var events = [];
    for (var k = 0; k < a.length; k++) {
      events.push({ y: a[k].start, delta: 1 });
      events.push({ y: a[k].end, delta: -1 });
    }
    for (var k2 = 0; k2 < b.length; k2++) {
      events.push({ y: b[k2].start, delta: 1 });
      events.push({ y: b[k2].end, delta: -1 });
    }
    events.sort(function (p, q) { return p.y - q.y || q.delta - p.delta; });
    var balance = 0;
    for (var e = 0; e < events.length - 1; e++) {
      balance += events[e].delta;
      var y1 = events[e].y;
      var y2 = events[e + 1].y;
      if (balance % 2 === 1 && y2 > y1) { // XOR => odd count
        result.push({ start: y1, end: y2 });
      }
    }
    return result;
  }

  var outline = [];

  for (var xi = 0; xi < xs.length; xi++) {
    var leftCov = xi === 0 ? [] : slabCoverage[xi - 1];
    var rightCov = xi === xs.length - 1 ? [] : slabCoverage[xi];
    var diff = xorIntervals(leftCov, rightCov);
    for (var d = 0; d < diff.length; d++) {
      outline.push({
        x1: xs[xi],
        y1: diff[d].start,
        x2: xs[xi],
        y2: diff[d].end
      });
    }
  }

  // Horizontal edges: for each slab coverage, add top/bottom lines
  for (var si = 0; si < slabCoverage.length; si++) {
    var cov = slabCoverage[si];
    var x1 = xs[si], x2 = xs[si + 1];
    for (var ci = 0; ci < cov.length; ci++) {
      outline.push({ x1: x1, y1: cov[ci].start, x2: x2, y2: cov[ci].start });
      outline.push({ x1: x1, y1: cov[ci].end, x2: x2, y2: cov[ci].end });
    }
  }

  return outline;
}

function boundarySegmentsToPolygons(segments) {
  var polys = [];
  if (!segments || !segments.length) return polys;
  var unused = segments.slice();
  var eps = 1e-3;

  while (unused.length) {
    var seg = unused.pop();
    var poly = [{ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 }];
    var closed = false;

    while (!closed) {
      var last = poly[poly.length - 1];
      var idx = -1;
      for (var i = 0; i < unused.length; i++) {
        var s = unused[i];
        var connectStart = Math.abs(s.x1 - last.x) < eps && Math.abs(s.y1 - last.y) < eps;
        var connectEnd = Math.abs(s.x2 - last.x) < eps && Math.abs(s.y2 - last.y) < eps;
        if (connectStart || connectEnd) {
          idx = i;
          if (connectStart) poly.push({ x: s.x2, y: s.y2 });
          else poly.push({ x: s.x1, y: s.y1 });
          unused.splice(i, 1);
          break;
        }
      }

      if (idx === -1) break;

      var first = poly[0];
      var curr = poly[poly.length - 1];
      if (Math.abs(curr.x - first.x) < eps && Math.abs(curr.y - first.y) < eps && poly.length > 2) {
        poly.pop();
        closed = true;
      }
    }

    if (poly.length >= 3) polys.push(poly);
  }

  return polys;
}

// nearEdgeMerger is the source of truth for merging; helper wrappers remain minimal.

function mergeCellsWithNearMerger(cells, mergeRay, mergeProb) {
  if (!cells || !cells.length) return { rooms: [], cellToRoom: {} };
  mergeProb = Math.max(0, Math.min(1, mergeProb !== undefined ? mergeProb : 0.5));

  // Build rectangles in min/max form
  var rects = [];
  for (var i = 0; i < cells.length; i++) {
    var r = cells[i].rect;
    if (!r) continue;
    rects.push({
      min_x: r.x,
      min_y: r.y,
      max_x: r.x + r.w,
      max_y: r.y + r.h
    });
  }

  var res = nearMergeSolve(rects, mergeRay);

  // --- Union-Find for probabilistic merging ---
  var n = res.length;
  var parent = [];
  for (var ui = 0; ui < n; ui++) parent[ui] = ui;
  function ufFind(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function ufUnion(a, b) { a = ufFind(a); b = ufFind(b); if (a !== b) parent[a] = b; }

  // Build adjacency: two items are adjacent if any of their rects touch (tolerance EPS)
  var ADJ_TOL = 1;
  for (var ai = 0; ai < n; ai++) {
    for (var bi = ai + 1; bi < n; bi++) {
      if (rectsTouch(res[ai].rects, res[bi].rects, ADJ_TOL)) {
        if (Math.random() < mergeProb) {
          ufUnion(ai, bi);
        }
      }
    }
  }

  // Group by root
  var groups = {};
  for (var gi = 0; gi < n; gi++) {
    var root = ufFind(gi);
    if (!groups[root]) groups[root] = [];
    groups[root].push(gi);
  }

  // Build rooms from groups
  var rooms = [];
  var cellToRoom = {};

  var groupKeys = Object.keys(groups);
  for (var gk = 0; gk < groupKeys.length; gk++) {
    var members = groups[groupKeys[gk]];

    // Combine rect-sets (in min/max form) from all members
    var combinedRects = [];
    var combinedCellIds = [];
    for (var mi = 0; mi < members.length; mi++) {
      var item = res[members[mi]];
      combinedCellIds.push(item.id);
      for (var ri = 0; ri < item.rects.length; ri++) {
        combinedRects.push(item.rects[ri]);
      }
    }

    // Merge and extract loops
    var merged = mergeRectSet(combinedRects);
    var rawLoops = extractLoopsFromRectSet(merged);

    var loops = rawLoops.map(function(loop) {
      return loop.map(function(p) { return { x: p[0], y: p[1] }; });
    });

    var boundarySegs = [];
    for (var l = 0; l < loops.length; l++) {
      var loop = loops[l];
      for (var lk = 0; lk < loop.length - 1; lk++) {
        boundarySegs.push({ x1: loop[lk].x, y1: loop[lk].y, x2: loop[lk + 1].x, y2: loop[lk + 1].y });
      }
    }

    var area = 0;
    for (var l2 = 0; l2 < loops.length; l2++) {
      var poly = loops[l2];
      var aSum = 0;
      for (var p = 0; p < poly.length; p++) {
        var pn = (p + 1) % poly.length;
        aSum += poly[p].x * poly[pn].y - poly[pn].x * poly[p].y;
      }
      area += Math.abs(aSum) / 2;
    }

    var centroid = { x: 0, y: 0 };
    if (loops[0]) {
      var poly0 = loops[0];
      var A = 0, Cx = 0, Cy = 0;
      for (var p2 = 0; p2 < poly0.length; p2++) {
        var n2 = (p2 + 1) % poly0.length;
        var cross = poly0[p2].x * poly0[n2].y - poly0[n2].x * poly0[p2].y;
        A += cross;
        Cx += (poly0[p2].x + poly0[n2].x) * cross;
        Cy += (poly0[p2].y + poly0[n2].y) * cross;
      }
      if (Math.abs(A) > 1e-6) {
        A *= 0.5;
        centroid = { x: Cx / (6 * A), y: Cy / (6 * A) };
      }
    }

    var roomId = rooms.length;
    rooms.push({
      id: roomId,
      roomId: roomId,
      cellIds: combinedCellIds,
      rects: merged.map(function(r) {
        return { x: r.min_x, y: r.min_y, w: r.max_x - r.min_x, h: r.max_y - r.min_y };
      }),
      area: area,
      centroid: centroid,
      polygon: loops,
      boundarySegments: boundarySegs
    });
    for (var ci = 0; ci < combinedCellIds.length; ci++) {
      cellToRoom[combinedCellIds[ci]] = roomId;
    }
  }

  return { rooms: rooms, cellToRoom: cellToRoom };
}

// Check if any rect from set A touches any rect from set B (within tolerance)
function rectsTouch(rectsA, rectsB, tol) {
  for (var i = 0; i < rectsA.length; i++) {
    var a = rectsA[i];
    for (var j = 0; j < rectsB.length; j++) {
      var b = rectsB[j];
      if (!(a.max_x < b.min_x - tol || a.min_x > b.max_x + tol ||
            a.max_y < b.min_y - tol || a.min_y > b.max_y + tol)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Merge overlapping AABB rectangles based on probability.
 * Uses Union-Find so transitive overlaps are merged when chosen.
 */
function mergeOverlappingRectangles(cells, mergeProb, mergeRay) {
  mergeProb = Math.max(0, Math.min(1, mergeProb || 0));
  mergeRay = Math.max(1, mergeRay || 1);
  if (!cells || cells.length === 0) return { rooms: [], cellToRoom: {} };

  // Each shape keeps a rect set (union of rects) and tracks original ids inside
  var shapes = [];
  for (var ci = 0; ci < cells.length; ci++) {
    if (!cells[ci].rect) continue;
    shapes.push({
      ids: [cells[ci].id],
      rects: [{ x: cells[ci].rect.x, y: cells[ci].rect.y, w: cells[ci].rect.w, h: cells[ci].rect.h }]
    });
  }

  // Resolve overlaps and apply inside/outside bridges until stable
  var changed = true;
  while (changed) {
    changed = false;
    outer: for (var a = 0; a < shapes.length; a++) {
      for (var b = 0; b < shapes.length; b++) {
        if (a === b) continue;

        var hit = processShapePair(shapes[a], shapes[b], mergeRay, mergeProb);
        if (hit) {
          changed = true;
          break outer;
        }
      }
    }
  }

  // Build rooms
  var rooms = [];
  var cellToRoom = {};
  for (var si = 0; si < shapes.length; si++) {
    var rects = normalizeRectSet(shapes[si].rects);
    var unionStats = unionAreaAndCentroid(rects);
    var boundary = rectUnionOutline(rects);
    var polys = boundarySegmentsToPolygons(boundary);

    var roomId = rooms.length;
    rooms.push({
      id: roomId,
      cellIds: shapes[si].ids.slice(),
      rects: rects,
      area: unionStats.area,
      centroid: unionStats.centroid,
      polygon: polys,
      boundarySegments: boundary
    });
    for (var k = 0; k < shapes[si].ids.length; k++) {
      cellToRoom[shapes[si].ids[k]] = roomId;
    }
  }

  return { rooms: rooms, cellToRoom: cellToRoom };
}
