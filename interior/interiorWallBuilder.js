/**
 * interiorWallBuilder.js
 * Builds interior walls between rooms using Voronoi cell boundary edges.
 * Uses Delaunay neighbors + cellToRoom mapping (no polygon edge matching).
 */

import { findSharedEdge } from './voronoiRooms.js';

var ALLOWED_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315].map(function (d) {
  return d * Math.PI / 180;
});

function snapAngle(angle) {
  while (angle < 0) angle += Math.PI * 2;
  while (angle >= Math.PI * 2) angle -= Math.PI * 2;

  var bestAngle = 0;
  var bestDiff = Infinity;
  for (var i = 0; i < ALLOWED_ANGLES.length; i++) {
    var diff = Math.abs(angle - ALLOWED_ANGLES[i]);
    var diff2 = Math.abs(angle - ALLOWED_ANGLES[i] + Math.PI * 2);
    var diff3 = Math.abs(angle - ALLOWED_ANGLES[i] - Math.PI * 2);
    var minDiff = Math.min(diff, diff2, diff3);
    if (minDiff < bestDiff) {
      bestDiff = minDiff;
      bestAngle = ALLOWED_ANGLES[i];
    }
  }
  return bestAngle;
}

function orthogonalizeSegment(p1, p2) {
  var dx = p2.x - p1.x;
  var dy = p2.y - p1.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  var angle = Math.atan2(dy, dx);
  var snapped = snapAngle(angle);

  var mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  var halfLen = len / 2;

  return {
    start: {
      x: mid.x - Math.cos(snapped) * halfLen,
      y: mid.y - Math.sin(snapped) * halfLen
    },
    end: {
      x: mid.x + Math.cos(snapped) * halfLen,
      y: mid.y + Math.sin(snapped) * halfLen
    }
  };
}

function segLen(s) {
  var dx = s.end.x - s.start.x, dy = s.end.y - s.start.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Build MST on room adjacency using Kruskal's.
 */
function buildMST(adjacency, numRooms) {
  var sorted = adjacency.map(function (e, i) { return { idx: i, weight: -e.sharedLength }; });
  sorted.sort(function (a, b) { return a.weight - b.weight; });

  var parent = [];
  for (var i = 0; i < numRooms; i++) parent[i] = i;

  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }

  var mstEdges = new Set();
  for (var i = 0; i < sorted.length; i++) {
    var edge = adjacency[sorted[i].idx];
    var ra = find(edge.roomA), rb = find(edge.roomB);
    if (ra !== rb) {
      parent[ra] = rb;
      mstEdges.add(sorted[i].idx);
    }
  }
  return mstEdges;
}

/**
 * Find all boundary edges between rooms using Delaunay neighbors.
 * For each pair of Voronoi cells belonging to different rooms,
 * finds the shared edge from their clipped polygons.
 *
 * @param {Array} cells - [{id, polygon, ...}]
 * @param {Object} delaunay - d3 Delaunay object
 * @param {Object} cellToRoom - { cellId: roomId }
 * @param {number} numRooms - total rooms
 * @returns {Array} [{roomA, roomB, segments: [{start, end}], sharedLength}]
 */
function findRoomBoundaries(cells, delaunay, cellToRoom, numRooms) {
  var cellById = {};
  for (var i = 0; i < cells.length; i++) {
    cellById[cells[i].id] = cells[i];
  }

  // Collect all boundary edges between room pairs
  var pairMap = {}; // "roomA_roomB" -> { segments, sharedLength }
  var seen = {};

  for (var i = 0; i < cells.length; i++) {
    var cellId = cells[i].id;
    var roomA = cellToRoom[cellId];
    if (roomA === undefined || roomA === -1) continue;

    var neighbors = delaunay.neighbors(cellId);
    for (var iter = neighbors.next(); !iter.done; iter = neighbors.next()) {
      var neighborId = iter.value;
      if (!cellById[neighborId]) continue;

      var roomB = cellToRoom[neighborId];
      if (roomB === undefined || roomB === -1) continue;
      if (roomA === roomB) continue; // Same room, skip

      // Canonical key
      var key = Math.min(cellId, neighborId) + '_' + Math.max(cellId, neighborId);
      if (seen[key]) continue;
      seen[key] = true;

      var pairKey = Math.min(roomA, roomB) + '_' + Math.max(roomA, roomB);
      if (!pairMap[pairKey]) {
        pairMap[pairKey] = {
          roomA: Math.min(roomA, roomB),
          roomB: Math.max(roomA, roomB),
          segments: [],
          sharedLength: 0
        };
      }

      var sharedEdges = findSharedEdge(cellById[cellId].polygon, cellById[neighborId].polygon);
      for (var s = 0; s < sharedEdges.length; s++) {
        var len = segLen(sharedEdges[s]);
        pairMap[pairKey].segments.push(sharedEdges[s]);
        pairMap[pairKey].sharedLength += len;
      }
    }
  }

  // Convert to array
  var result = [];
  for (var k in pairMap) {
    if (pairMap[k].segments.length > 0) {
      result.push(pairMap[k]);
    }
  }

  console.log('    Room boundaries found:', result.length,
    'total segments:', result.reduce(function(sum, p) { return sum + p.segments.length; }, 0));

  return result;
}

/**
 * Build interior walls between rooms with door gaps.
 *
 * @param {Array} cells - original Voronoi cells
 * @param {Object} delaunay - d3 Delaunay object
 * @param {Object} cellToRoom - cellId → roomId mapping
 * @param {Array} rooms - merged rooms
 * @param {Object} config
 * @returns {Array} built wall objects
 */
export function buildInteriorWalls(cells, delaunay, cellToRoom, rooms, config) {
  config = config || {};
  var thickness = config.interiorThickness || 10;
  var doorWidth = config.doorWidth || 66;
  var doorProbability = config.doorProbability || 0.3;
  var minWallLength = config.minWallLength || 20;

  // Find all boundary edges between rooms
  var boundaries = findRoomBoundaries(cells, delaunay, cellToRoom, rooms.length);

  if (boundaries.length === 0) {
    console.warn('    No room boundaries found!');
    return [];
  }

  // Build MST for mandatory doors
  var mstEdges = buildMST(boundaries, rooms.length);

  var builtWalls = [];

  for (var bi = 0; bi < boundaries.length; bi++) {
    var pair = boundaries[bi];
    var needsDoor = mstEdges.has(bi) || Math.random() < doorProbability;
    var doorPlaced = false;

    // Merge collinear segments between this room pair
    var mergedSegs = mergeCollinearSegments(pair.segments);

    for (var si = 0; si < mergedSegs.length; si++) {
      var seg = mergedSegs[si];
      var len = segLen(seg);

      if (len < minWallLength) continue;

      // Orthogonalize
      var ortho = orthogonalizeSegment(seg.start, seg.end);

      if (needsDoor && !doorPlaced && len > doorWidth + 20) {
        var wallParts = splitForDoor(ortho.start, ortho.end, doorWidth);
        for (var wi = 0; wi < wallParts.length; wi++) {
          if (segLen(wallParts[wi]) < 5) continue;
          var wall = buildWallSegment(wallParts[wi].start, wallParts[wi].end, thickness);
          if (wall) builtWalls.push(wall);
        }
        doorPlaced = true;
      } else {
        var wall = buildWallSegment(ortho.start, ortho.end, thickness);
        if (wall) builtWalls.push(wall);
      }
    }
  }

  // Finalize
  if (typeof editor !== 'undefined') {
    editor.architect(WALLS);
  }
  if (typeof renderAllCurvedWalls === 'function') {
    renderAllCurvedWalls();
  }
  if (typeof save === 'function') {
    save();
  }

  return builtWalls;
}

/**
 * Merge collinear segments that are end-to-end into longer segments.
 */
function mergeCollinearSegments(segments) {
  if (segments.length <= 1) return segments;

  var eps = 3;
  var angleTol = 0.15; // ~8.5 degrees
  var merged = segments.slice();
  var changed = true;

  while (changed) {
    changed = false;
    for (var i = 0; i < merged.length; i++) {
      for (var j = i + 1; j < merged.length; j++) {
        var a = merged[i], b = merged[j];

        // Check if endpoints touch
        var connected = false;
        var newSeg = null;

        var angleA = Math.atan2(a.end.y - a.start.y, a.end.x - a.start.x);
        var angleB = Math.atan2(b.end.y - b.start.y, b.end.x - b.start.x);
        var angleDiff = Math.abs(angleA - angleB);
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
        var collinear = angleDiff < angleTol || Math.abs(angleDiff - Math.PI) < angleTol;

        if (!collinear) continue;

        if (ptDist(a.end, b.start) < eps) {
          newSeg = { start: a.start, end: b.end };
          connected = true;
        } else if (ptDist(a.end, b.end) < eps) {
          newSeg = { start: a.start, end: b.start };
          connected = true;
        } else if (ptDist(a.start, b.end) < eps) {
          newSeg = { start: b.start, end: a.end };
          connected = true;
        } else if (ptDist(a.start, b.start) < eps) {
          newSeg = { start: a.end, end: b.end };
          connected = true;
        }

        if (connected && newSeg) {
          merged[i] = newSeg;
          merged.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return merged;
}

function ptDist(a, b) {
  var dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function splitForDoor(start, end, doorWidth) {
  var dx = end.x - start.x, dy = end.y - start.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  var dirX = dx / len, dirY = dy / len;

  var halfDoor = doorWidth / 2;
  var midX = (start.x + end.x) / 2, midY = (start.y + end.y) / 2;

  return [
    { start: start, end: { x: midX - dirX * halfDoor, y: midY - dirY * halfDoor } },
    { start: { x: midX + dirX * halfDoor, y: midY + dirY * halfDoor }, end: end }
  ];
}

function buildWallSegment(start, end, thickness) {
  var dx = end.x - start.x, dy = end.y - start.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  var dir = { x: dx / len, y: dy / len };
  var pawn = new Pawn(start, dir, thickness);
  pawn.buildWallTo(end);
  return pawn.addToEditor({ skipArchitect: true, skipSave: true });
}

export function clearInteriorWalls(walls) {
  if (!walls) return;
  for (var i = 0; i < walls.length; i++) {
    var wall = walls[i];
    if (wall && wall.graph) wall.graph.remove();
    if (typeof WALLS !== 'undefined') {
      var idx = WALLS.indexOf(wall);
      if (idx > -1) WALLS.splice(idx, 1);
    }
  }
}
