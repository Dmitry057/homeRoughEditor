/**
 * GraphKMeansBehaviour.js
 * Builds a simple star-shaped graph from the requested node count.
 * Parameters:
 *  - numNodes: total nodes in graph (>=2)
 *  - kMeans: placeholder for upcoming clustering steps
 */

function GraphKMeansBehaviour(options) {
  options = options || {};

  this.config = {
    centerX: options.centerX || (originX_viewbox + width_viewbox / 2),
    centerY: options.centerY || (originY_viewbox + height_viewbox / 2),
    minRadius: options.minRadius || 120,
    maxRadius: options.maxRadius || 260,
    jitterAngle: options.jitterAngle || 0.6, // random direction noise
    radialNoise: options.radialNoise || 0.35, // extra radius jitter percentage
    nodeRadius: options.nodeRadius || 8,
    noiseAmount: options.noiseAmount || 1000,
    noiseSize: options.noiseSize || 0.25,
    noiseNabla: options.noiseNabla || 0.03,
    layerId: options.layerId || 'boxDebug',
    rectPadding: options.rectPadding || 10,
    rectStroke: options.rectStroke || '#ff7a00',
    rectStrokeWidth: options.rectStrokeWidth || 2,
    rectFill: options.rectFill || 'rgba(255,122,0,0.08)',
    rectMinOverlap: options.rectMinOverlap || 1 // min stacked rects to include in union
  };

  this.kMeans = options.kMeans || 3;
  this.nodes = [];
  this.edges = [];
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
  this.nodes = [];
  this.edges = [];
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
