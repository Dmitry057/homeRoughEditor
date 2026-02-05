/**
 * wallSpawner.js
 * Converts merged boundary segments into walls (straight / arc / bezier) using Pawn.
 */

function WallSpawner(options) {
  options = options || {};
  this.wallThickness = options.wallThickness || 20;
}

WallSpawner.prototype.buildFromSegments = function (segments) {
  var builtWalls = [];
  var builtPawns = [];
  if (!segments || !segments.length) {
    return { walls: builtWalls, pawns: builtPawns };
  }

  var loops = this._buildLoops(segments);
  for (var l = 0; l < loops.length; l++) {
    var edges = loops[l];
    if (edges.length < 2) continue;

    var lastEnd = null;
    var firstStart = null;
    var i = 0;
    while (i < edges.length) {
      // Pattern: parallel, turn, parallel -> Bezier (50%)
      if (i <= edges.length - 3) {
        var d1 = this._dir(edges[i]);
        var d2 = this._dir(edges[i + 1]);
        var d3 = this._dir(edges[i + 2]);
        var len1 = this._len(edges[i]);
        var len2 = this._len(edges[i + 1]);
        var len3 = this._len(edges[i + 2]);
        var sameDir13 = this._dot(d1, d3) > 0.95;
        var turn12 = Math.abs(this._dot(d1, d2)) < 0.2;
        var longerSides = len1 > len2 && len3 > len2;
        if (sameDir13 && turn12 && longerSides) {
          if (Math.random() < 0.5) {
            var bezStart = lastEnd || { x: edges[i].x1, y: edges[i].y1 };
            if (!firstStart) firstStart = bezStart;
            var bezEnd = { x: edges[i + 2].x2, y: edges[i + 2].y2 };
            var bez = this._buildBezier(bezStart, bezEnd, d1, d3);
            if (bez.wall) builtWalls.push(bez.wall);
            if (bez.pawn) builtPawns.push(bez.pawn);
            lastEnd = bezEnd;
            i += 3;
            continue;
          }
        }
      }

      // Pattern: simple corner -> Arc (30%)
      if (i <= edges.length - 2 && this._orient(edges[i]) !== this._orient(edges[i + 1])) {
        var lenA = this._len(edges[i]);
        var lenB = this._len(edges[i + 1]);
        if (Math.abs(lenA - lenB) <= Math.max(lenA, lenB) * 0.1) {
          if (Math.random() < 0.3) {
            var arcStart = lastEnd || { x: edges[i].x1, y: edges[i].y1 };
            if (!firstStart) firstStart = arcStart;
            var arcEnd = { x: edges[i + 1].x2, y: edges[i + 1].y2 };
            var arc = this._buildArc(arcStart, arcEnd, this._dir(edges[i]), this._dir(edges[i + 1]));
            if (arc.wall) builtWalls.push(arc.wall);
            if (arc.pawn) builtPawns.push(arc.pawn);
            lastEnd = arcEnd;
            i += 2;
            continue;
          }
        }
      }

      // Default: straight wall for current edge
      var segStart = lastEnd || { x: edges[i].x1, y: edges[i].y1 };
      if (!firstStart) firstStart = segStart;
      var straight = this._buildWall(edges[i], segStart);
      if (straight.wall) builtWalls.push(straight.wall);
      if (straight.pawn) builtPawns.push(straight.pawn);
      lastEnd = { x: edges[i].x2, y: edges[i].y2 };
      i += 1;
    }
  }

  editor.architect(WALLS);
  if (typeof renderAllCurvedWalls === 'function') {
    renderAllCurvedWalls();
  }

  return { walls: builtWalls, pawns: builtPawns };
};

WallSpawner.prototype.clearWalls = function (walls) {
  if (!walls) return;
  for (var i = 0; i < walls.length; i++) {
    var wall = walls[i];
    if (wall && wall.graph) wall.graph.remove();
    var idx = WALLS.indexOf(wall);
    if (idx > -1) WALLS.splice(idx, 1);
    if (typeof CURVED_WALLS !== 'undefined') {
      var cidx = CURVED_WALLS.indexOf(wall);
      if (cidx > -1) CURVED_WALLS.splice(cidx, 1);
    }
  }
};

WallSpawner.prototype._buildLoops = function (segments) {
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
        if (samePoint({ x: s.x1, y: s.y1 }, currentEnd)) { foundIdx = i; break; }
        if (samePoint({ x: s.x2, y: s.y2 }, currentEnd)) {
          unused[i] = { x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1, h: s.h };
          foundIdx = i;
          break;
        }
      }
      if (foundIdx === -1) break;
      var nextSeg = unused.splice(foundIdx, 1)[0];
      loop.push(nextSeg);
      currentEnd = { x: nextSeg.x2, y: nextSeg.y2 };
      if (samePoint(currentEnd, start)) closed = true;
    }
    loops.push(loop);
  }

  return loops;
};

WallSpawner.prototype._orient = function (seg) {
  return Math.abs(seg.x2 - seg.x1) >= Math.abs(seg.y2 - seg.y1) ? 'h' : 'v';
};

WallSpawner.prototype._dir = function (seg) {
  var dx = seg.x2 - seg.x1;
  var dy = seg.y2 - seg.y1;
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / len, y: dy / len };
};

WallSpawner.prototype._len = function (seg) {
  var dx = seg.x2 - seg.x1;
  var dy = seg.y2 - seg.y1;
  return Math.sqrt(dx * dx + dy * dy);
};

WallSpawner.prototype._dot = function (a, b) {
  return a.x * b.x + a.y * b.y;
};

WallSpawner.prototype._buildBezier = function (start, end, startDir, endDir) {
  var pawn = new Pawn(start, startDir, this.wallThickness);
  pawn.buildBezier(end, endDir, 0.4);
  var wall = pawn.addToEditor();
  return { wall: wall, pawn: pawn };
};

WallSpawner.prototype._buildArc = function (start, end, startDir, endDir) {
  var pawn = new Pawn(start, startDir, this.wallThickness);
  pawn.buildArcTo(end, endDir);
  if (pawn.wallData) {
    pawn.wallData.startDirection = startDir;
    pawn.wallData.endDirection = endDir;
  }
  var wall = pawn.addToEditor();
  return { wall: wall, pawn: pawn };
};

WallSpawner.prototype._buildWall = function (seg, startOverride) {
  var dir = this._dir(seg);
  var start = startOverride || { x: seg.x1, y: seg.y1 };
  var end = { x: seg.x2, y: seg.y2 };
  var pawn = new Pawn(start, dir, this.wallThickness);
  pawn.buildWallTo(end);
  var wall = pawn.addToEditor();
  return { wall: wall, pawn: pawn };
};
