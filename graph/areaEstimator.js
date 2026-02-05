/**
 * areaEstimator.js
 * Builds padded bounding rectangles per node+neighbors and merges them into
 * a union outline. Returns boundary segments for downstream wall spawning.
 */

function AreaEstimator(config) {
  this.config = config || {};
  this.groupId = 'graph-rects';
  this.unionId = 'graph-rect-union';
}

AreaEstimator.prototype.render = function (nodes, edges) {
  this.clear();
  if (!nodes || !nodes.length) return [];

  qSVG.create(this.config.layerId, 'g', { id: this.groupId });

  var rects = [];

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var neighbors = this._neighborsFor(node.id, nodes, edges);
    var pts = neighbors.slice();
    pts.push(node);
    if (pts.length === 0) continue;

    var minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
    for (var p = 1; p < pts.length; p++) {
      var pt = pts[p];
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    minX -= this.config.rectPadding;
    maxX += this.config.rectPadding;
    minY -= this.config.rectPadding;
    maxY += this.config.rectPadding;

    var rect = { x1: minX, y1: minY, x2: maxX, y2: maxY };
    rects.push(rect);
  }

  for (var r = 0; r < rects.length; r++) {
    var rc = rects[r];
    qSVG.create(this.groupId, 'rect', {
      x: rc.x1,
      y: rc.y1,
      width: rc.x2 - rc.x1,
      height: rc.y2 - rc.y1,
      fill: this.config.rectFill,
      stroke: 'none',
      'pointer-events': 'none'
    });
  }

  return this._renderUnion(rects);
};

AreaEstimator.prototype.clear = function () {
  var existing = $('#' + this.groupId);
  if (existing && existing.length) existing.remove();
  var union = $('#' + this.unionId);
  if (union && union.length) union.remove();
};

AreaEstimator.prototype._renderUnion = function (rects) {
  if (!rects || !rects.length) return [];

  var xs = [], ys = [];
  for (var i = 0; i < rects.length; i++) {
    xs.push(rects[i].x1, rects[i].x2);
    ys.push(rects[i].y1, rects[i].y2);
  }
  xs = Array.from(new Set(xs)).sort(function (a, b) { return a - b; });
  ys = Array.from(new Set(ys)).sort(function (a, b) { return a - b; });

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

  var covered = [];
  for (var yi = 0; yi < ys.length - 1; yi++) {
    covered[yi] = [];
    for (var xi = 0; xi < xs.length - 1; xi++) {
      covered[yi][xi] = cellCovered(xs[xi], xs[xi + 1], ys[yi], ys[yi + 1]);
    }
  }

  var segments = [];
  for (var y = 0; y < ys.length - 1; y++) {
    for (var x = 0; x < xs.length - 1; x++) {
      if (!covered[y][x]) continue;
      var x0 = xs[x], x1 = xs[x + 1];
      var y0 = ys[y], y1 = ys[y + 1];

      if (y === 0 || !covered[y - 1][x]) segments.push({ x1: x0, y1: y0, x2: x1, y2: y0, h: true });
      if (y === ys.length - 2 || !covered[y + 1][x]) segments.push({ x1: x0, y1: y1, x2: x1, y2: y1, h: true });
      if (x === 0 || !covered[y][x - 1]) segments.push({ x1: x0, y1: y0, x2: x0, y2: y1, h: false });
      if (x === xs.length - 2 || !covered[y][x + 1]) segments.push({ x1: x1, y1: y0, x2: x1, y2: y1, h: false });
    }
  }

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
        if (!merged.length) {
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
        if (!mergedV.length) {
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

  qSVG.create(this.config.layerId, 'g', { id: this.unionId });
  for (var s = 0; s < mergedSegments.length; s++) {
    var seg = mergedSegments[s];
    qSVG.create(this.unionId, 'line', {
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

  return mergedSegments;
};

AreaEstimator.prototype._neighborsFor = function (id, nodes, edges) {
  var list = [];
  for (var e = 0; e < edges.length; e++) {
    var edge = edges[e];
    if (edge.from === id) list.push(this._nodeById(edge.to, nodes));
    else if (edge.to === id) list.push(this._nodeById(edge.from, nodes));
  }
  return list;
};

AreaEstimator.prototype._nodeById = function (id, nodes) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return nodes[i];
  }
  return null;
};
