/**
 * voronoiRooms.js
 * Builds Voronoi diagram from graph nodes, filters cells by boundary.
 * Returns cells AND the delaunay object for neighbor queries.
 */

import { Delaunay } from 'd3-delaunay';

/**
 * Convert AreaEstimator boundary segments into a closed polygon.
 * Segments are {x1,y1,x2,y2,h} — we chain them endpoint-to-endpoint.
 */
export function segmentsToPolygon(segments) {
  if (!segments || !segments.length) return [];

  var eps = 1;
  var unused = segments.map(function (s) {
    return { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 };
  });

  var poly = [{ x: unused[0].x1, y: unused[0].y1 }];
  var current = { x: unused[0].x2, y: unused[0].y2 };
  poly.push({ x: current.x, y: current.y });
  unused.splice(0, 1);

  while (unused.length > 0) {
    var foundIdx = -1;
    for (var i = 0; i < unused.length; i++) {
      var s = unused[i];
      if (Math.abs(s.x1 - current.x) < eps && Math.abs(s.y1 - current.y) < eps) {
        current = { x: s.x2, y: s.y2 };
        foundIdx = i;
        break;
      }
      if (Math.abs(s.x2 - current.x) < eps && Math.abs(s.y2 - current.y) < eps) {
        current = { x: s.x1, y: s.y1 };
        foundIdx = i;
        break;
      }
    }
    if (foundIdx === -1) break;
    unused.splice(foundIdx, 1);

    var last = poly[poly.length - 1];
    if (Math.abs(current.x - last.x) > eps || Math.abs(current.y - last.y) > eps) {
      poly.push({ x: current.x, y: current.y });
    }
  }

  if (poly.length > 2) {
    var first = poly[0];
    var end = poly[poly.length - 1];
    if (Math.abs(first.x - end.x) < eps && Math.abs(first.y - end.y) < eps) {
      poly.pop();
    }
  }

  return poly;
}

/**
 * Compute polygon area using shoelace formula (signed).
 */
export function polygonArea(poly) {
  var n = poly.length;
  var area = 0;
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    area += poly[i].x * poly[j].y;
    area -= poly[j].x * poly[i].y;
  }
  return area / 2;
}

/**
 * Ray casting point-in-polygon test.
 * Works with any simple polygon (convex or concave).
 */
export function pointInPolygon(point, polygon) {
  var x = point.x, y = point.y;
  var inside = false;
  var n = polygon.length;

  for (var i = 0, j = n - 1; i < n; j = i++) {
    var xi = polygon[i].x, yi = polygon[i].y;
    var xj = polygon[j].x, yj = polygon[j].y;

    if (((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Build Voronoi cells from nodes, filtered to those inside boundary polygon.
 * Uses rayCasting instead of Sutherland-Hodgman (works with concave boundaries).
 *
 * @param {Array} nodes - [{id, x, y}, ...]
 * @param {Array} boundaryPolygon - [{x,y}, ...] closed polygon
 * @returns {Object} { cells, delaunay, voronoi }
 */
export function computeVoronoiCells(nodes, boundaryPolygon) {
  if (!nodes || nodes.length < 2 || !boundaryPolygon || boundaryPolygon.length < 3) {
    return { cells: [], delaunay: null, voronoi: null };
  }

  // Bounding box with padding
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (var b = 0; b < boundaryPolygon.length; b++) {
    if (boundaryPolygon[b].x < minX) minX = boundaryPolygon[b].x;
    if (boundaryPolygon[b].y < minY) minY = boundaryPolygon[b].y;
    if (boundaryPolygon[b].x > maxX) maxX = boundaryPolygon[b].x;
    if (boundaryPolygon[b].y > maxY) maxY = boundaryPolygon[b].y;
  }
  var pad = 50;
  var bounds = [minX - pad, minY - pad, maxX + pad, maxY + pad];

  var delaunay = Delaunay.from(nodes, function (n) { return n.x; }, function (n) { return n.y; });
  var voronoi = delaunay.voronoi(bounds);

  var cells = [];
  var skipped = 0;
  for (var i = 0; i < nodes.length; i++) {
    // Filter: node must be inside boundary
    if (!pointInPolygon(nodes[i], boundaryPolygon)) {
      skipped++;
      continue;
    }

    var cellPoly = voronoi.cellPolygon(i);
    if (!cellPoly || cellPoly.length < 3) continue;

    // Convert [[x,y],...] (last==first) to [{x,y},...]
    var poly = [];
    for (var p = 0; p < cellPoly.length - 1; p++) {
      poly.push({ x: cellPoly[p][0], y: cellPoly[p][1] });
    }

    var area = Math.abs(polygonArea(poly));
    if (area < 1) continue;

    // Compute axis-aligned bounding box (AABB)
    var bMinX = poly[0].x, bMinY = poly[0].y, bMaxX = poly[0].x, bMaxY = poly[0].y;
    for (var r = 1; r < poly.length; r++) {
      if (poly[r].x < bMinX) bMinX = poly[r].x;
      if (poly[r].y < bMinY) bMinY = poly[r].y;
      if (poly[r].x > bMaxX) bMaxX = poly[r].x;
      if (poly[r].y > bMaxY) bMaxY = poly[r].y;
    }

    cells.push({
      id: i,
      nodeId: nodes[i].id,
      polygon: poly,
      rect: { x: bMinX, y: bMinY, w: bMaxX - bMinX, h: bMaxY - bMinY },
      area: area
    });
  }

  if (skipped > 0) {
    console.log('    Voronoi: skipped', skipped, 'nodes outside boundary');
  }

  return { cells: cells, delaunay: delaunay, voronoi: voronoi };
}

/**
 * Find shared edge between two cell polygons.
 * Returns array of shared edge segments [{start:{x,y}, end:{x,y}}].
 */
export function findSharedEdge(polyA, polyB, eps) {
  eps = eps || 2;
  var shared = [];

  for (var i = 0; i < polyA.length; i++) {
    var a1 = polyA[i];
    var a2 = polyA[(i + 1) % polyA.length];

    for (var j = 0; j < polyB.length; j++) {
      var b1 = polyB[j];
      var b2 = polyB[(j + 1) % polyB.length];

      var match1 = ptDist(a1, b1) < eps && ptDist(a2, b2) < eps;
      var match2 = ptDist(a1, b2) < eps && ptDist(a2, b1) < eps;
      if (match1 || match2) {
        shared.push({ start: { x: a1.x, y: a1.y }, end: { x: a2.x, y: a2.y } });
      }
    }
  }

  return shared;
}

function ptDist(a, b) {
  var dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Render Voronoi cells as SVG for debug visualization.
 *
 * @param {Array} cells - [{id, polygon, ...}]
 * @param {Object} cellToRoom - {cellId: roomId}
 * @param {string} layerId - SVG group ID to render into
 */
export function renderVoronoiDebug(cells, cellToRoom, layerId) {
  layerId = layerId || 'boxDebug';

  // Remove previous debug layer
  var existing = document.getElementById('voronoi-debug');
  if (existing) existing.remove();

  var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('id', 'voronoi-debug');
  group.setAttribute('pointer-events', 'none');

  var fillColors = [
    'rgba(255,100,100,0.35)', 'rgba(100,200,255,0.35)', 'rgba(100,255,100,0.35)',
    'rgba(255,200,50,0.35)', 'rgba(200,100,255,0.35)', 'rgba(255,150,50,0.35)',
    'rgba(50,255,200,0.35)', 'rgba(255,50,150,0.35)', 'rgba(150,150,255,0.35)',
    'rgba(200,255,100,0.35)'
  ];
  var strokeColors = [
    '#ff6464', '#64c8ff', '#64ff64', '#ffc832', '#c864ff',
    '#ff9632', '#32ffc8', '#ff3296', '#9696ff', '#c8ff64'
  ];

  for (var i = 0; i < cells.length; i++) {
    var cell = cells[i];
    var roomId = (cell.roomId !== undefined) ? cell.roomId :
      (cellToRoom ? cellToRoom[cell.id] : i);
    var colorIdx = (roomId !== undefined && roomId >= 0) ? roomId % fillColors.length : i % fillColors.length;

    var polygons = [];
    if (cell.polygon && cell.polygon.length) {
      polygons = Array.isArray(cell.polygon[0]) ? cell.polygon : [cell.polygon];
    }

    if (polygons.length === 0 && cell.boundarySegments && cell.boundarySegments.length) {
      polygons = [segmentsToPolygonFromSegments(cell.boundarySegments)];
    }

    if (polygons.length === 0 && cell.rect) {
      var r = cell.rect;
      polygons = [[
        { x: r.x, y: r.y },
        { x: r.x + r.w, y: r.y },
        { x: r.x + r.w, y: r.y + r.h },
        { x: r.x, y: r.y + r.h }
      ]];
    }

    if (polygons.length === 0) continue;

    // Combine all loops into a single path with evenodd fill-rule
    // This correctly handles holes (inner loops are subtracted from outer)
    var d = '';
    for (var p = 0; p < polygons.length; p++) {
      var poly = polygons[p];
      if (!poly || poly.length < 3) continue;
      d += 'M ' + poly[0].x + ' ' + poly[0].y;
      for (var k = 1; k < poly.length; k++) {
        d += ' L ' + poly[k].x + ' ' + poly[k].y;
      }
      d += ' Z ';
    }

    if (!d) continue;

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d.trim());
    path.setAttribute('fill', fillColors[colorIdx]);
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('stroke', strokeColors[colorIdx]);
    path.setAttribute('stroke-width', '1.5');
    group.appendChild(path);
  }

  var parent = document.getElementById(layerId);
  if (parent) {
    parent.appendChild(group);
  }
}

/**
 * Remove Voronoi debug visualization.
 */
export function clearVoronoiDebug() {
  var existing = document.getElementById('voronoi-debug');
  if (existing) existing.remove();
}

// Helpers
function segmentsToPolygonFromSegments(segs) {
  if (!segs || !segs.length) return [];
  var eps = 1e-3;
  var unused = segs.slice();
  var poly = [];
  var start = unused.pop();
  poly.push({ x: start.x1, y: start.y1 });
  poly.push({ x: start.x2, y: start.y2 });
  while (unused.length) {
    var last = poly[poly.length - 1];
    var idx = unused.findIndex(function (s) {
      return (Math.abs(s.x1 - last.x) < eps && Math.abs(s.y1 - last.y) < eps) ||
             (Math.abs(s.x2 - last.x) < eps && Math.abs(s.y2 - last.y) < eps);
    });
    if (idx === -1) break;
    var seg = unused.splice(idx, 1)[0];
    if (Math.abs(seg.x1 - last.x) < eps && Math.abs(seg.y1 - last.y) < eps) {
      poly.push({ x: seg.x2, y: seg.y2 });
    } else {
      poly.push({ x: seg.x1, y: seg.y1 });
    }
    var first = poly[0];
    var curr = poly[poly.length - 1];
    if (Math.abs(curr.x - first.x) < eps && Math.abs(curr.y - first.y) < eps) {
      poly.pop();
      break;
    }
  }
  return poly;
}
