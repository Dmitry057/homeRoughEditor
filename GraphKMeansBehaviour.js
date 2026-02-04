/**
 * GraphKMeansBehaviour.js
 * Builds a simple star-shaped graph from the requested node count.
 * Parameters:
 *  - numNodes: total nodes in graph (>=2)
 *  - kMeans: placeholder for upcoming clustering steps
 */

function GraphKMeansBehaviour(options) {
  options = options || {};
  var spawnOffsetX = options.spawnOffsetX !== undefined ? options.spawnOffsetX : 220;
  var spawnOffsetY = options.spawnOffsetY !== undefined ? options.spawnOffsetY : 0;

  this.config = {
    centerX: options.centerX || (originX_viewbox + width_viewbox / 2 + spawnOffsetX),
    centerY: options.centerY || (originY_viewbox + height_viewbox / 2 + spawnOffsetY),
    minRadius: options.minRadius || 120,
    maxRadius: options.maxRadius || 260,
    jitterAngle: options.jitterAngle || 0.6, // random direction noise
    radialNoise: options.radialNoise || 0.35, // extra radius jitter percentage
    nodeRadius: options.nodeRadius || 8,
    noiseAmount: options.noiseAmount || 1000,
    noiseSize: options.noiseSize || 0.25,
    noiseNabla: options.noiseNabla || 0.03,
    layerId: options.layerId || 'boxDebug',
    spawnOffsetX: spawnOffsetX,
    spawnOffsetY: spawnOffsetY,
    rectPadding: options.rectPadding || 10,
    rectStroke: options.rectStroke || '#ff7a00',
    rectStrokeWidth: options.rectStrokeWidth || 2,
    rectFill: options.rectFill || 'rgba(255,122,0,0.08)',
    rectMinOverlap: options.rectMinOverlap || 1 // min stacked rects to include in union
  };

  this.kMeans = options.kMeans || 3;
  this.nodes = [];
  this.edges = [];
  this.builtWalls = [];
  this.builtPawns = [];
  this.wallThickness = options.wallThickness || 20;
  this.graph = new Graph({
    layerId: this.config.layerId,
    nodeRadius: this.config.nodeRadius
  });
}

/**
 * Generate a random star graph and render it.
 * @param {number} numNodes - how many nodes to create (>=2)
 * @param {number} kMeans   - stored for later steps (not used yet)
 */
GraphKMeansBehaviour.prototype.generate = function (numNodes, kMeans) {
  numNodes = Math.max(2, parseInt(numNodes, 10) || 5);
  this.kMeans = kMeans !== undefined ? kMeans : this.kMeans;

  this.clear();

  // 1) Spawn noisy points around the center (no distinguished first room)
  for (var i = 0; i < numNodes; i++) {
    // Base angle uniformly spread, then jittered with noise
    var baseAngle = (Math.PI * 2 * i) / numNodes;
    var angleNoise = (this._noise(i, 0) - 0.5) * this.config.jitterAngle * 2;
    var angle = baseAngle + angleNoise;

    // Radius with extra noise
    var baseRadius = this.config.minRadius + (this._noise(i, 50) * (this.config.maxRadius - this.config.minRadius));
    var radialMul = 1 + (this._noise(i, 100) - 0.5) * this.config.radialNoise * 2;
    var radius = baseRadius * radialMul;

    // Small positional warp from noise amount
    var warpX = (this._noise(i, 150) - 0.5) * this.config.noiseAmount * 0.01;
    var warpY = (this._noise(i, 200) - 0.5) * this.config.noiseAmount * 0.01;

    this.nodes.push({
      id: i,
      x: this.config.centerX + Math.cos(angle) * radius + warpX,
      y: this.config.centerY + Math.sin(angle) * radius + warpY,
      label: 'N' + i
    });
  }

  // 2) Connect k nearest neighbors for each node (undirected, no duplicates)
  var k = Math.min(Math.max(1, parseInt(this.kMeans, 10) || 1), numNodes - 1);
  var edgeMap = {};

  for (var n = 0; n < this.nodes.length; n++) {
    var node = this.nodes[n];
    // Compute distances to others
    var distances = [];
    for (var m = 0; m < this.nodes.length; m++) {
      if (m === n) continue;
      var other = this.nodes[m];
      var dx = node.x - other.x;
      var dy = node.y - other.y;
      distances.push({ id: other.id, dist2: dx * dx + dy * dy });
    }
    distances.sort(function (a, b) { return a.dist2 - b.dist2; });

    for (var j = 0; j < k && j < distances.length; j++) {
      var toId = distances[j].id;
      var a = Math.min(node.id, toId);
      var b = Math.max(node.id, toId);
      var key = a + '-' + b;
      if (!edgeMap[key]) {
        edgeMap[key] = true;
        this.edges.push({ from: a, to: b });
      }
    }
  }

  this.graph.render(this.nodes, this.edges);
  this._renderRectangles();

  return {
    nodes: this.nodes,
    edges: this.edges,
    kMeans: this.kMeans
  };
};

GraphKMeansBehaviour.prototype.clear = function () {
  // remove generated walls
  for (var i = 0; i < this.builtWalls.length; i++) {
    var wall = this.builtWalls[i];
    if (wall && wall.graph) wall.graph.remove();
    var idx = WALLS.indexOf(wall);
    if (idx > -1) WALLS.splice(idx, 1);
    var cidx = CURVED_WALLS.indexOf(wall);
    if (cidx > -1) CURVED_WALLS.splice(cidx, 1);
  }
  this.nodes = [];
  this.edges = [];
  this.builtWalls = [];
  this.builtPawns = [];
  if (this.graph) {
    this.graph.clear();
  }
  this._clearRectangles();
  this._clearUnion();
};

GraphKMeansBehaviour.prototype.destroy = function () {
  this.clear();
  if (this.graph) {
    this.graph.destroy();
  }
};

// ======================================================================
// Rectangles that enclose k-neighbors with node at center
// ======================================================================

GraphKMeansBehaviour.prototype._renderRectangles = function () {
  this._clearRectangles();
  this._clearUnion();
  var groupId = 'graph-rects';
  qSVG.create(this.config.layerId, 'g', { id: groupId });

  var rects = [];

  for (var i = 0; i < this.nodes.length; i++) {
    var node = this.nodes[i];
    var neighbors = this._neighborsFor(node.id);
    // include the node itself
    var pts = neighbors.slice();
    pts.push(node);

    if (pts.length === 0) continue;

    var minX = pts[0].x;
    var maxX = pts[0].x;
    var minY = pts[0].y;
    var maxY = pts[0].y;

    for (var n = 1; n < pts.length; n++) {
      var p = pts[n];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    // Apply padding
    minX -= this.config.rectPadding;
    maxX += this.config.rectPadding;
    minY -= this.config.rectPadding;
    maxY += this.config.rectPadding;

    var rect = {
      x1: minX,
      y1: minY,
      x2: maxX,
      y2: maxY
    };
    rects.push(rect);
  }

  // Optionally draw individual rects (soft fill for debugging)
  for (var r = 0; r < rects.length; r++) {
    var rc = rects[r];
    qSVG.create(groupId, 'rect', {
      x: rc.x1,
      y: rc.y1,
      width: rc.x2 - rc.x1,
      height: rc.y2 - rc.y1,
      fill: this.config.rectFill,
      stroke: 'none',
      'pointer-events': 'none'
    });
  }

  this._renderUnion(rects);
};

GraphKMeansBehaviour.prototype._clearRectangles = function () {
  var existing = $('#graph-rects');
  if (existing && existing.length) {
    existing.remove();
  }
};

GraphKMeansBehaviour.prototype._clearUnion = function () {
  var existing = $('#graph-rect-union');
  if (existing && existing.length) {
    existing.remove();
  }
};

// Merge overlapping/adjacent rectangles to boundary-only outline (axis-aligned)
GraphKMeansBehaviour.prototype._renderUnion = function (rects) {
  if (!rects || rects.length === 0) return;

  // Collect unique grid lines
  var xs = [];
  var ys = [];
  for (var i = 0; i < rects.length; i++) {
    xs.push(rects[i].x1, rects[i].x2);
    ys.push(rects[i].y1, rects[i].y2);
  }
  xs = Array.from(new Set(xs)).sort(function (a, b) { return a - b; });
  ys = Array.from(new Set(ys)).sort(function (a, b) { return a - b; });

  // Helper to test coverage of cell (axis-aligned perfect grid)
  var cellCovered = function (x0, x1, y0, y1) {
    var count = 0;
    for (var r = 0; r < rects.length; r++) {
      var rc = rects[r];
      if (rc.x1 <= x0 && rc.x2 >= x1 && rc.y1 <= y0 && rc.y2 >= y1) {
        count++;
        if (count >= this.config.rectMinOverlap) return true;
      }
    }
    return false;
  }.bind(this);

  // Build coverage grid
  var covered = [];
  for (var yi = 0; yi < ys.length - 1; yi++) {
    covered[yi] = [];
    for (var xi = 0; xi < xs.length - 1; xi++) {
      covered[yi][xi] = cellCovered(xs[xi], xs[xi + 1], ys[yi], ys[yi + 1]);
    }
  }

  // Collect boundary segments (axis-aligned)
  var segments = [];
  for (var yi = 0; yi < ys.length - 1; yi++) {
    for (var xi = 0; xi < xs.length - 1; xi++) {
      if (!covered[yi][xi]) continue;
      var x0 = xs[xi], x1 = xs[xi + 1];
      var y0 = ys[yi], y1 = ys[yi + 1];

      // Top
      if (yi === 0 || !covered[yi - 1][xi]) segments.push({ x1: x0, y1: y0, x2: x1, y2: y0, h: true });
      // Bottom
      if (yi === ys.length - 2 || !covered[yi + 1][xi]) segments.push({ x1: x0, y1: y1, x2: x1, y2: y1, h: true });
      // Left
      if (xi === 0 || !covered[yi][xi - 1]) segments.push({ x1: x0, y1: y0, x2: x0, y2: y1, h: false });
      // Right
      if (xi === xs.length - 2 || !covered[yi][xi + 1]) segments.push({ x1: x1, y1: y0, x2: x1, y2: y1, h: false });
    }
  }

  // Merge collinear contiguous segments
  function mergeSegments(segList, horizontal) {
    var filtered = segList.filter(function (s) { return s.h === horizontal; });
    if (horizontal) {
      filtered.sort(function (a, b) {
        if (a.y1 !== b.y1) return a.y1 - b.y1;
        if (a.x1 !== b.x1) return a.x1 - b.x1;
        return a.x2 - b.x2;
      });
      var merged = [];
      for (var i = 0; i < filtered.length; i++) {
        var s = filtered[i];
        if (merged.length === 0) {
          merged.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, h: true });
        } else {
          var last = merged[merged.length - 1];
          if (Math.abs(last.y1 - s.y1) < 1e-6 && Math.abs(last.x2 - s.x1) < 1e-6) {
            last.x2 = s.x2;
          } else {
            merged.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, h: true });
          }
        }
      }
      return merged;
    } else {
      filtered.sort(function (a, b) {
        if (a.x1 !== b.x1) return a.x1 - b.x1;
        if (a.y1 !== b.y1) return a.y1 - b.y1;
        return a.y2 - b.y2;
      });
      var mergedV = [];
      for (var j = 0; j < filtered.length; j++) {
        var v = filtered[j];
        if (mergedV.length === 0) {
          mergedV.push({ x1: v.x1, y1: v.y1, x2: v.x2, y2: v.y2, h: false });
        } else {
          var lv = mergedV[mergedV.length - 1];
          if (Math.abs(lv.x1 - v.x1) < 1e-6 && Math.abs(lv.y2 - v.y1) < 1e-6) {
            lv.y2 = v.y2;
          } else {
            mergedV.push({ x1: v.x1, y1: v.y1, x2: v.x2, y2: v.y2, h: false });
          }
        }
      }
      return mergedV;
    }
  }

  var mergedSegments = mergeSegments(segments, true).concat(mergeSegments(segments, false));

  // Draw boundary
  qSVG.create(this.config.layerId, 'g', { id: 'graph-rect-union' });
  for (var s = 0; s < mergedSegments.length; s++) {
    var seg = mergedSegments[s];
    qSVG.create('graph-rect-union', 'line', {
      x1: seg.x1,
      y1: seg.y1,
      x2: seg.x2,
      y2: seg.y2,
      stroke: this.config.rectStroke,
      'stroke-width': this.config.rectStrokeWidth,
      fill: 'none',
      'pointer-events': 'none'
    });
  }

  // Build walls along merged boundary
  this._buildWallsFromSegments(mergedSegments);
};

GraphKMeansBehaviour.prototype._neighborsFor = function (id) {
  var list = [];
  for (var e = 0; e < this.edges.length; e++) {
    var edge = this.edges[e];
    if (edge.from === id) {
      list.push(this._nodeById(edge.to));
    } else if (edge.to === id) {
      list.push(this._nodeById(edge.from));
    }
  }
  return list;
};

GraphKMeansBehaviour.prototype._nodeById = function (id) {
  for (var i = 0; i < this.nodes.length; i++) {
    if (this.nodes[i].id === id) return this.nodes[i];
  }
  return null;
};

// Wrapper around user-provided noise; falls back to Math.random if unavailable
GraphKMeansBehaviour.prototype._noise = function (x, y) {
  if (typeof orgBlenderNoise === 'function') {
    // Use configured size/nabla as frequency/offset
    return orgBlenderNoise(
      x * this.config.noiseSize,
      y * this.config.noiseSize,
      this.config.noiseNabla
    );
  }
  return Math.random();
};

// ======================================================================
// Wall building from merged boundary segments
// ======================================================================

GraphKMeansBehaviour.prototype._buildWallsFromSegments = function (segments) {
  if (!segments || segments.length === 0) return;

  var loops = this._buildLoops(segments);
  for (var l = 0; l < loops.length; l++) {
    var edges = loops[l];
    if (edges.length < 2) continue;

    var lastEnd = null;
    var firstStart = null;

    var i = 0;
    while (i < edges.length) {
      // Pattern: parallel (same direction), turn, parallel (same direction) -> Bezier (50%)
      if (i <= edges.length - 3) {
        var d1 = this._dir(edges[i]);
        var d2 = this._dir(edges[i + 1]);
        var d3 = this._dir(edges[i + 2]);
        var len1 = this._len(edges[i]);
        var len2 = this._len(edges[i + 1]);
        var len3 = this._len(edges[i + 2]);
        var sameDir13 = this._dot(d1, d3) > 0.95;            // same orientation, not opposite
        var turn12 = Math.abs(this._dot(d1, d2)) < 0.2;       // roughly perpendicular
        var longerSides = len1 > len2 && len3 > len2;        // first and third longer than middle
        if (sameDir13 && turn12 && longerSides) {
          if (Math.random() < 0.5) {
            var bezStart = lastEnd || { x: edges[i].x1, y: edges[i].y1 };
            if (!firstStart) firstStart = bezStart;
            var bezEnd = { x: edges[i + 2].x2, y: edges[i + 2].y2 };
            this._buildBezier(bezStart, bezEnd, d1, d3);
            lastEnd = bezEnd;
            i += 3;
            continue;
          }
        }
      }

      // Pattern: simple corner -> Arc (30%)
      if (i <= edges.length - 2 &&
          this._orient(edges[i]) !== this._orient(edges[i + 1])) {
        var lenA = this._len(edges[i]);
        var lenB = this._len(edges[i + 1]);
        if (Math.abs(lenA - lenB) <= Math.max(lenA, lenB) * 0.1) { // lengths within 10%
          if (Math.random() < 0.3) {
            var arcStart = lastEnd || { x: edges[i].x1, y: edges[i].y1 };
            if (!firstStart) firstStart = arcStart;
            var arcEnd = { x: edges[i + 1].x2, y: edges[i + 1].y2 };
            var arcStartDir = this._dir(edges[i]);
            var arcEndDir = this._dir(edges[i + 1]);
            // ensure arc bends toward the corner (use segment order)
            this._buildArc(arcStart, arcEnd, arcStartDir, arcEndDir);
            lastEnd = arcEnd;
            i += 2;
            continue;
          }
        }
      }

      // Default: straight wall for current edge
      var segStart = lastEnd || { x: edges[i].x1, y: edges[i].y1 };
      if (!firstStart) firstStart = segStart;
      this._buildWall(edges[i], segStart);
      lastEnd = { x: edges[i].x2, y: edges[i].y2 };
      i += 1;
    }
  }

  // Refresh displays
  editor.architect(WALLS);
  if (typeof renderAllCurvedWalls === 'function') {
    renderAllCurvedWalls();
  }
};

GraphKMeansBehaviour.prototype._buildLoops = function (segments) {
  var loops = [];
  var unused = segments.slice();

  function samePoint(a, b) {
    return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
  }

  while (unused.length) {
    var seg = unused.shift();
    var loop = [seg];
    var start = { x: seg.x1, y: seg.y1 };
    var currentEnd = { x: seg.x2, y: seg.y2 };

    var closed = false;
    while (!closed && unused.length) {
      var foundIdx = -1;
      for (var i = 0; i < unused.length; i++) {
        var s = unused[i];
        if (samePoint({ x: s.x1, y: s.y1 }, currentEnd)) {
          foundIdx = i;
          break;
        }
        if (samePoint({ x: s.x2, y: s.y2 }, currentEnd)) {
          // flip orientation
          unused[i] = { x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1, h: s.h };
          foundIdx = i;
          break;
        }
      }
      if (foundIdx === -1) break;
      var nextSeg = unused.splice(foundIdx, 1)[0];
      loop.push(nextSeg);
      currentEnd = { x: nextSeg.x2, y: nextSeg.y2 };
      if (samePoint(currentEnd, start)) {
        closed = true;
      }
    }
    loops.push(loop);
  }

  return loops;
};

GraphKMeansBehaviour.prototype._orient = function (seg) {
  return Math.abs(seg.x2 - seg.x1) >= Math.abs(seg.y2 - seg.y1) ? 'h' : 'v';
};

GraphKMeansBehaviour.prototype._dir = function (seg) {
  var dx = seg.x2 - seg.x1;
  var dy = seg.y2 - seg.y1;
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / len, y: dy / len };
};

GraphKMeansBehaviour.prototype._len = function (seg) {
  var dx = seg.x2 - seg.x1;
  var dy = seg.y2 - seg.y1;
  return Math.sqrt(dx * dx + dy * dy);
};

GraphKMeansBehaviour.prototype._dot = function (a, b) {
  return a.x * b.x + a.y * b.y;
};

GraphKMeansBehaviour.prototype._buildBezier = function (start, end, startDir, endDir) {
  var pawn = new Pawn(start, startDir, this.wallThickness);
  pawn.buildBezier(end, endDir, 0.4);
  var wall = pawn.addToEditor();
  if (wall) {
    this.builtWalls.push(wall);
    this.builtPawns.push(pawn);
  }
};

GraphKMeansBehaviour.prototype._buildArc = function (start, end, startDir, endDir) {
  var pawn = new Pawn(start, startDir, this.wallThickness);
  pawn.buildArcTo(end, endDir);
  // Preserve directions for correct sweep in curvedWalls
  if (pawn.wallData) {
    pawn.wallData.startDirection = startDir;
    pawn.wallData.endDirection = endDir;
  }
  var wall = pawn.addToEditor();
  if (wall) {
    this.builtWalls.push(wall);
    this.builtPawns.push(pawn);
  }
};

GraphKMeansBehaviour.prototype._buildWall = function (seg, startOverride) {
  var dir = this._dir(seg);
  var start = startOverride || { x: seg.x1, y: seg.y1 };
  var end = { x: seg.x2, y: seg.y2 };
  var pawn = new Pawn(start, dir, this.wallThickness);
  pawn.buildWallTo(end);
  var wall = pawn.addToEditor();
  if (wall) {
    this.builtWalls.push(wall);
    this.builtPawns.push(pawn);
  }
};
