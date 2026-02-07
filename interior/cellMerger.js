/**
 * cellMerger.js
 * Merges adjacent Voronoi cells into rooms using hierarchical clustering.
 * Uses Delaunay neighbor info for adjacency (not polygon edge matching).
 */

import { polygonArea, findSharedEdge } from './voronoiRooms.js';

function dist(a, b) {
  var dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function centroid(poly) {
  var cx = 0, cy = 0;
  for (var i = 0; i < poly.length; i++) {
    cx += poly[i].x;
    cy += poly[i].y;
  }
  return { x: cx / poly.length, y: cy / poly.length };
}

/**
 * Build adjacency map from Delaunay neighbors.
 * Only includes pairs where both cells exist in the cells array.
 *
 * @param {Array} cells - [{id, ...}]
 * @param {Object} delaunay - d3 Delaunay object
 * @returns {Object} { cellId: [{neighborId, sharedLength}] }
 */
function buildAdjacencyFromDelaunay(cells, delaunay) {
  var cellById = {};
  var adj = {};

  for (var i = 0; i < cells.length; i++) {
    cellById[cells[i].id] = cells[i];
    adj[cells[i].id] = [];
  }

  var seen = {};
  for (var i = 0; i < cells.length; i++) {
    var cellId = cells[i].id;
    var neighbors = delaunay.neighbors(cellId);
    for (var iter = neighbors.next(); !iter.done; iter = neighbors.next()) {
      var neighborId = iter.value;
      if (!cellById[neighborId]) continue;

      var key = Math.min(cellId, neighborId) + '_' + Math.max(cellId, neighborId);
      if (seen[key]) continue;
      seen[key] = true;

      // Find shared edge length from original cell polygons
      var shared = findSharedEdge(cellById[cellId].polygon, cellById[neighborId].polygon);
      var sharedLen = 0;
      for (var s = 0; s < shared.length; s++) {
        sharedLen += dist(shared[s].start, shared[s].end);
      }

      // Even if shared edge not found geometrically (clipping artifacts),
      // still count as neighbors from Delaunay with a default length
      if (sharedLen === 0) sharedLen = 10;

      adj[cellId].push({ neighborId: neighborId, sharedLength: sharedLen });
      adj[neighborId].push({ neighborId: cellId, sharedLength: sharedLen });
    }
  }

  return adj;
}

/**
 * Merge Voronoi cells into rooms via hierarchical agglomerative clustering.
 * Returns rooms with cellToRoom mapping for downstream wall building.
 *
 * @param {Array} cells - [{id, nodeId, polygon, area}, ...]
 * @param {Array} edges - graph edges (unused currently, kept for API compat)
 * @param {number} targetRooms - desired number of rooms
 * @param {Object} delaunay - d3 Delaunay object for neighbor lookups
 * @returns {Object} { rooms: [{id, cellIds, area, centroid}], cellToRoom: {} }
 */
export function mergeCells(cells, edges, targetRooms, delaunay) {
  if (!cells || cells.length === 0) return { rooms: [], cellToRoom: {} };
  targetRooms = Math.max(1, targetRooms || Math.ceil(cells.length / 3));

  // Build cell-to-room mapping (cell.id → room index)
  var cellToRoom = {};
  for (var i = 0; i < cells.length; i++) {
    cellToRoom[cells[i].id] = i;
  }

  if (cells.length <= targetRooms) {
    var simpleRooms = cells.map(function (c, i) {
      return {
        id: i,
        cellIds: [c.id],
        area: c.area,
        centroid: centroid(c.polygon)
      };
    });
    return { rooms: simpleRooms, cellToRoom: cellToRoom };
  }

  // Initialize rooms — each cell is its own room
  var rooms = cells.map(function (c, i) {
    return {
      id: i,
      cellIds: [c.id],
      area: c.area,
      centroid: centroid(c.polygon),
      alive: true
    };
  });

  // Build adjacency from Delaunay neighbors
  var adj = buildAdjacencyFromDelaunay(cells, delaunay);

  // Compute total area for size limits
  var totalArea = 0;
  for (var i = 0; i < rooms.length; i++) totalArea += rooms[i].area;
  var avgArea = totalArea / targetRooms;
  var maxArea = avgArea * 2.5;

  var aliveCount = rooms.length;

  while (aliveCount > targetRooms) {
    var bestI = -1, bestJ = -1, bestScore = Infinity;

    for (var ri = 0; ri < rooms.length; ri++) {
      if (!rooms[ri].alive) continue;

      var neighborRooms = {};
      for (var ci = 0; ci < rooms[ri].cellIds.length; ci++) {
        var cid = rooms[ri].cellIds[ci];
        if (!adj[cid]) continue;
        for (var ni = 0; ni < adj[cid].length; ni++) {
          var neighborCellId = adj[cid][ni].neighborId;
          var neighborRoomId = cellToRoom[neighborCellId];
          if (neighborRoomId !== ri && rooms[neighborRoomId] && rooms[neighborRoomId].alive) {
            if (!neighborRooms[neighborRoomId]) neighborRooms[neighborRoomId] = 0;
            neighborRooms[neighborRoomId] += adj[cid][ni].sharedLength;
          }
        }
      }

      for (var nrId in neighborRooms) {
        var rj = parseInt(nrId);
        var combinedArea = rooms[ri].area + rooms[rj].area;
        if (combinedArea > maxArea) continue;

        var score = combinedArea / (1 + neighborRooms[nrId]);
        if (score < bestScore) {
          bestScore = score;
          bestI = ri;
          bestJ = rj;
        }
      }
    }

    if (bestI === -1 || bestJ === -1) break;

    // Merge bestJ into bestI (no polygon merging needed — we use cell-level edges)
    rooms[bestI].cellIds = rooms[bestI].cellIds.concat(rooms[bestJ].cellIds);
    rooms[bestI].area = rooms[bestI].area + rooms[bestJ].area;

    // Recompute centroid from all cell centroids
    var allCellCentroids = [];
    for (var ci = 0; ci < rooms[bestI].cellIds.length; ci++) {
      var cid = rooms[bestI].cellIds[ci];
      for (var cc = 0; cc < cells.length; cc++) {
        if (cells[cc].id === cid) {
          allCellCentroids.push(centroid(cells[cc].polygon));
          break;
        }
      }
    }
    var cx = 0, cy = 0;
    for (var k = 0; k < allCellCentroids.length; k++) {
      cx += allCellCentroids[k].x;
      cy += allCellCentroids[k].y;
    }
    rooms[bestI].centroid = { x: cx / allCellCentroids.length, y: cy / allCellCentroids.length };

    // Update mapping
    for (var ci = 0; ci < rooms[bestJ].cellIds.length; ci++) {
      cellToRoom[rooms[bestJ].cellIds[ci]] = bestI;
    }

    rooms[bestJ].alive = false;
    aliveCount--;
  }

  // Re-index alive rooms
  var result = [];
  var oldToNew = {};
  for (var i = 0; i < rooms.length; i++) {
    if (!rooms[i].alive) continue;
    oldToNew[i] = result.length;
    result.push({
      id: result.length,
      cellIds: rooms[i].cellIds,
      area: rooms[i].area,
      centroid: rooms[i].centroid
    });
  }

  // Update cellToRoom to use new room IDs
  var newCellToRoom = {};
  for (var cid in cellToRoom) {
    var oldRoomId = cellToRoom[cid];
    newCellToRoom[cid] = oldToNew[oldRoomId] !== undefined ? oldToNew[oldRoomId] : -1;
  }

  return { rooms: result, cellToRoom: newCellToRoom };
}
