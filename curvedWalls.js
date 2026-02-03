// ============================================================================
// CURVED WALLS - Arc and Bezier Wall Implementation
// ============================================================================
// Adds support for curved walls: Arc/Sector and Bezier curves
// Author: Generated for Home Rough Editor
// ============================================================================

var curvedWalls = {

  // ============================================================================
  // ARC GEOMETRY HELPERS
  // ============================================================================

  /**
   * Calculate arc center from three points
   * @param {Object} p1 - First point {x, y}
   * @param {Object} p2 - Second point {x, y} (point on arc)
   * @param {Object} p3 - Third point {x, y}
   * @returns {Object} Center {x, y} and radius
   */
  arcCenterFromThreePoints: function(p1, p2, p3) {
    var ax = p1.x, ay = p1.y;
    var bx = p2.x, by = p2.y;
    var cx = p3.x, cy = p3.y;

    var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 0.0001) {
      return null; // Points are collinear
    }

    var ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    var uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

    var radius = Math.sqrt(Math.pow(ax - ux, 2) + Math.pow(ay - uy, 2));

    return { x: ux, y: uy, radius: radius };
  },

  /**
   * Calculate arc center from start, end and radius
   * @param {Object} start - Start point {x, y}
   * @param {Object} end - End point {x, y}
   * @param {number} radius - Arc radius
   * @param {boolean} clockwise - Direction of arc
   * @returns {Object} Center {x, y}
   */
  arcCenterFromRadius: function(start, end, radius, clockwise) {
    var midX = (start.x + end.x) / 2;
    var midY = (start.y + end.y) / 2;
    var dx = end.x - start.x;
    var dy = end.y - start.y;
    var chordLength = Math.sqrt(dx * dx + dy * dy);

    if (chordLength > 2 * radius) {
      radius = chordLength / 2 + 1; // Adjust radius if too small
    }

    var h = Math.sqrt(radius * radius - (chordLength / 2) * (chordLength / 2));

    // Perpendicular direction
    var px = -dy / chordLength;
    var py = dx / chordLength;

    // Choose center based on clockwise direction
    if (clockwise) {
      return { x: midX + h * px, y: midY + h * py, radius: radius };
    } else {
      return { x: midX - h * px, y: midY - h * py, radius: radius };
    }
  },

  /**
   * Get angle from center to point
   */
  angleFromCenter: function(center, point) {
    return Math.atan2(point.y - center.y, point.x - center.x);
  },

  /**
   * Get point on arc at given angle
   */
  pointOnArc: function(center, radius, angle) {
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    };
  },

  /**
   * Generate SVG arc path
   * @param {Object} start - Start point
   * @param {Object} end - End point
   * @param {number} radius - Arc radius
   * @param {boolean} largeArc - Large arc flag (0 or 1)
   * @param {boolean} sweep - Sweep direction (0=CCW, 1=CW)
   * @returns {string} SVG path command
   */
  svgArcPath: function(start, end, radius, largeArc, sweep) {
    return "A " + radius + " " + radius + " 0 " + (largeArc ? 1 : 0) + " " + (sweep ? 1 : 0) + " " + end.x + " " + end.y;
  },

  /**
   * Calculate points along arc for rendering
   */
  arcPoints: function(center, radius, startAngle, endAngle, segments) {
    segments = segments || 32;
    var points = [];
    var deltaAngle = endAngle - startAngle;

    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var angle = startAngle + t * deltaAngle;
      points.push(this.pointOnArc(center, radius, angle));
    }
    return points;
  },

  /**
   * Find nearest point on arc from a given point
   */
  nearPointOnArc: function(center, radius, startAngle, endAngle, point) {
    var angleToPoint = this.angleFromCenter(center, point);

    // Normalize angles
    while (startAngle > Math.PI) startAngle -= 2 * Math.PI;
    while (startAngle < -Math.PI) startAngle += 2 * Math.PI;
    while (endAngle > Math.PI) endAngle -= 2 * Math.PI;
    while (endAngle < -Math.PI) endAngle += 2 * Math.PI;

    // Check if angle is within arc range
    var inRange = false;
    if (startAngle <= endAngle) {
      inRange = angleToPoint >= startAngle && angleToPoint <= endAngle;
    } else {
      inRange = angleToPoint >= startAngle || angleToPoint <= endAngle;
    }

    var nearestAngle;
    if (inRange) {
      nearestAngle = angleToPoint;
    } else {
      // Find closest endpoint
      var distToStart = Math.abs(angleToPoint - startAngle);
      var distToEnd = Math.abs(angleToPoint - endAngle);
      if (distToStart > Math.PI) distToStart = 2 * Math.PI - distToStart;
      if (distToEnd > Math.PI) distToEnd = 2 * Math.PI - distToEnd;
      nearestAngle = distToStart < distToEnd ? startAngle : endAngle;
    }

    var nearestPoint = this.pointOnArc(center, radius, nearestAngle);
    var distance = Math.sqrt(Math.pow(point.x - nearestPoint.x, 2) + Math.pow(point.y - nearestPoint.y, 2));

    return {
      x: nearestPoint.x,
      y: nearestPoint.y,
      angle: nearestAngle,
      distance: distance,
      t: (nearestAngle - startAngle) / (endAngle - startAngle)
    };
  },

  // ============================================================================
  // BEZIER GEOMETRY HELPERS
  // ============================================================================

  /**
   * Calculate cubic Bezier point at parameter t
   * @param {Object} p0 - Start point
   * @param {Object} p1 - First control point
   * @param {Object} p2 - Second control point
   * @param {Object} p3 - End point
   * @param {number} t - Parameter [0, 1]
   * @returns {Object} Point on curve
   */
  bezierPoint: function(p0, p1, p2, p3, t) {
    var mt = 1 - t;
    var mt2 = mt * mt;
    var mt3 = mt2 * mt;
    var t2 = t * t;
    var t3 = t2 * t;

    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
    };
  },

  /**
   * Calculate Bezier tangent (derivative) at parameter t
   */
  bezierTangent: function(p0, p1, p2, p3, t) {
    var mt = 1 - t;
    var mt2 = mt * mt;
    var t2 = t * t;

    return {
      x: 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x),
      y: 3 * mt2 * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y)
    };
  },

  /**
   * Calculate normal (perpendicular to tangent) at parameter t
   */
  bezierNormal: function(p0, p1, p2, p3, t) {
    var tangent = this.bezierTangent(p0, p1, p2, p3, t);
    var len = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
    if (len < 0.0001) len = 0.0001;
    return {
      x: -tangent.y / len,
      y: tangent.x / len
    };
  },

  /**
   * Calculate control points from start/end positions and directions
   * @param {Object} start - Start position {x, y}
   * @param {Object} end - End position {x, y}
   * @param {number} startAngle - Start direction angle in radians
   * @param {number} endAngle - End direction angle in radians
   * @param {number} tension - Control point distance factor (default 0.3)
   * @returns {Object} Control points {cp1, cp2}
   */
  controlPointsFromDirections: function(start, end, startAngle, endAngle, tension) {
    tension = tension || 0.3;
    var distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    var handleLength = distance * tension;

    return {
      cp1: {
        x: start.x + handleLength * Math.cos(startAngle),
        y: start.y + handleLength * Math.sin(startAngle)
      },
      cp2: {
        x: end.x - handleLength * Math.cos(endAngle),
        y: end.y - handleLength * Math.sin(endAngle)
      }
    };
  },

  /**
   * Generate points along Bezier curve for rendering
   */
  bezierPoints: function(p0, p1, p2, p3, segments) {
    segments = segments || 32;
    var points = [];
    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      points.push(this.bezierPoint(p0, p1, p2, p3, t));
    }
    return points;
  },

  /**
   * Find nearest point on Bezier curve from a given point
   * Uses iterative refinement for accuracy
   */
  nearPointOnBezier: function(p0, p1, p2, p3, point) {
    var segments = 50;
    var bestT = 0;
    var bestDist = Infinity;

    // Coarse search
    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var p = this.bezierPoint(p0, p1, p2, p3, t);
      var dist = Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }

    // Refine with binary search
    var step = 1 / segments / 2;
    for (var i = 0; i < 10; i++) {
      var tLeft = Math.max(0, bestT - step);
      var tRight = Math.min(1, bestT + step);

      var pLeft = this.bezierPoint(p0, p1, p2, p3, tLeft);
      var pRight = this.bezierPoint(p0, p1, p2, p3, tRight);

      var distLeft = Math.pow(pLeft.x - point.x, 2) + Math.pow(pLeft.y - point.y, 2);
      var distRight = Math.pow(pRight.x - point.x, 2) + Math.pow(pRight.y - point.y, 2);

      if (distLeft < bestDist) {
        bestDist = distLeft;
        bestT = tLeft;
      }
      if (distRight < bestDist) {
        bestDist = distRight;
        bestT = tRight;
      }
      step /= 2;
    }

    var nearestPoint = this.bezierPoint(p0, p1, p2, p3, bestT);
    return {
      x: nearestPoint.x,
      y: nearestPoint.y,
      t: bestT,
      distance: Math.sqrt(bestDist)
    };
  },

  /**
   * Generate SVG cubic Bezier path
   */
  svgBezierPath: function(p0, p1, p2, p3) {
    return "M" + p0.x + "," + p0.y + " C" + p1.x + "," + p1.y + " " + p2.x + "," + p2.y + " " + p3.x + "," + p3.y;
  },

  // ============================================================================
  // OFFSET CURVES (for wall thickness)
  // ============================================================================

  /**
   * Generate offset arc (inner or outer)
   */
  offsetArc: function(center, radius, startAngle, endAngle, offset) {
    return {
      center: center,
      radius: radius + offset,
      startAngle: startAngle,
      endAngle: endAngle
    };
  },

  /**
   * Generate offset Bezier curve (approximation using normals)
   */
  offsetBezierPoints: function(p0, p1, p2, p3, offset, segments) {
    segments = segments || 32;
    var points = [];
    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var p = this.bezierPoint(p0, p1, p2, p3, t);
      var n = this.bezierNormal(p0, p1, p2, p3, t);
      points.push({
        x: p.x + n.x * offset,
        y: p.y + n.y * offset
      });
    }
    return points;
  },

  // ============================================================================
  // ARC WALL CLASS
  // ============================================================================

  /**
   * Arc Wall constructor
   * @param {Object} start - Start point {x, y}
   * @param {Object} end - End point {x, y}
   * @param {number} radius - Arc radius
   * @param {boolean} clockwise - Arc direction
   * @param {string} type - Wall type
   * @param {number} thick - Wall thickness
   */
  arcWall: function(start, end, radius, clockwise, type, thick) {
    this.wallType = 'arc';
    this.start = start;
    this.end = end;
    this.radius = radius;
    this.clockwise = clockwise;
    this.type = type || 'normal';
    this.thick = thick || 20;
    this.parent = null;
    this.child = null;
    this.coords = [];
    this.backUp = false;

    // Calculate center
    var centerData = curvedWalls.arcCenterFromRadius(start, end, radius, clockwise);
    this.center = { x: centerData.x, y: centerData.y };
    this.radius = centerData.radius;

    // Calculate angles
    this.startAngle = curvedWalls.angleFromCenter(this.center, start);
    this.endAngle = curvedWalls.angleFromCenter(this.center, end);

    // Calculate arc properties
    this.updateGeometry();
  },

  // ============================================================================
  // BEZIER WALL CLASS
  // ============================================================================

  /**
   * Bezier Wall constructor
   * @param {Object} start - Start point {x, y}
   * @param {Object} end - End point {x, y}
   * @param {number} startAngle - Start tangent direction (radians)
   * @param {number} endAngle - End tangent direction (radians)
   * @param {number} tension - Control point tension (0-1)
   * @param {string} type - Wall type
   * @param {number} thick - Wall thickness
   */
  bezierWall: function(start, end, startAngle, endAngle, tension, type, thick) {
    this.wallType = 'bezier';
    this.start = start;
    this.end = end;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
    this.tension = tension || 0.4;
    this.type = type || 'normal';
    this.thick = thick || 20;
    this.parent = null;
    this.child = null;
    this.coords = [];
    this.backUp = false;

    // Calculate control points
    this.updateControlPoints();
    this.updateGeometry();
  },

  // ============================================================================
  // WALL COMPUTING AND RENDERING
  // ============================================================================

  /**
   * Compute curved walls and add to scene
   */
  computeCurvedWalls: function(walls) {
    for (var i = 0; i < walls.length; i++) {
      var wall = walls[i];
      if (wall.wallType === 'arc') {
        this.computeArcWall(wall);
      } else if (wall.wallType === 'bezier') {
        this.computeBezierWall(wall);
      }
    }
  },

  /**
   * Compute arc wall geometry and create SVG
   */
  computeArcWall: function(wall) {
    var segments = 32;
    var innerRadius = wall.radius - wall.thick / 2;
    var outerRadius = wall.radius + wall.thick / 2;

    // Normalize to always draw the smaller arc between start and end
    var startAngle = wall.startAngle;
    var endAngle = wall.endAngle;
    var delta = endAngle - startAngle;
    // wrap to [-PI, PI]
    while (delta > Math.PI) {
      endAngle -= Math.PI * 2;
      delta = endAngle - startAngle;
    }
    while (delta < -Math.PI) {
      endAngle += Math.PI * 2;
      delta = endAngle - startAngle;
    }

    // Inner arc points
    var innerPoints = this.arcPoints(wall.center, innerRadius, startAngle, endAngle, segments);
    // Outer arc points (reversed for proper path)
    var outerPoints = this.arcPoints(wall.center, outerRadius, endAngle, startAngle, segments);

    // Build path using sampled points to enforce concentricity
    var path = "M" + innerPoints[0].x + "," + innerPoints[0].y;
    for (var i = 1; i < innerPoints.length; i++) {
      path += " L" + innerPoints[i].x + "," + innerPoints[i].y;
    }
    // connect to outer
    path += " L" + outerPoints[0].x + "," + outerPoints[0].y;
    for (var j = 1; j < outerPoints.length; j++) {
      path += " L" + outerPoints[j].x + "," + outerPoints[j].y;
    }
    path += " Z";

    // Store coords for hit testing
    wall.coords = innerPoints.concat(outerPoints);
    wall.pathData = path;

    wall.graph = this.makeWall(path);
    $('#boxwall').append(wall.graph);
  },

  /**
   * Compute bezier wall geometry and create SVG
   */
  computeBezierWall: function(wall) {
    var segments = 32;
    var halfThick = wall.thick / 2;

    // Extend start/end to reduce gaps (fallback if directions missing)
    var startDir = wall.startDirection ? Vector2.normalize(wall.startDirection)
      : Vector2.normalize(Vector2.sub(wall.cp1, wall.start));
    var endDir = wall.endDirection ? Vector2.normalize(wall.endDirection)
      : Vector2.normalize(Vector2.sub(wall.end, wall.cp2));

    var start = wall.start && startDir ? Vector2.sub(wall.start, Vector2.scale(startDir, halfThick)) : wall.start;
    var end = wall.end && endDir ? Vector2.add(wall.end, Vector2.scale(endDir, halfThick)) : wall.end;
    var cp1 = wall.cp1 && startDir ? Vector2.sub(wall.cp1, Vector2.scale(startDir, halfThick)) : wall.cp1;
    var cp2 = wall.cp2 && endDir ? Vector2.add(wall.cp2, Vector2.scale(endDir, halfThick)) : wall.cp2;

    // Get offset curves
    var innerPoints = this.offsetBezierPoints(start, cp1, cp2, end, -halfThick, segments);
    var outerPoints = this.offsetBezierPoints(start, cp1, cp2, end, halfThick, segments);

    // Build path - inner curve forward
    var path = "M" + innerPoints[0].x + "," + innerPoints[0].y;
    for (var i = 1; i < innerPoints.length; i++) {
      path += " L" + innerPoints[i].x + "," + innerPoints[i].y;
    }

    // Connect to outer curve end
    path += " L" + outerPoints[outerPoints.length - 1].x + "," + outerPoints[outerPoints.length - 1].y;

    // Outer curve backward
    for (var i = outerPoints.length - 2; i >= 0; i--) {
      path += " L" + outerPoints[i].x + "," + outerPoints[i].y;
    }

    path += " Z";

    // Store coords for hit testing
    wall.coords = innerPoints.concat(outerPoints.reverse());
    wall.pathData = path;

    wall.graph = this.makeWall(path);
    $('#boxwall').append(wall.graph);
  },

  /**
   * Create SVG path element for wall
   */
  makeWall: function(pathData) {
    return qSVG.create('none', 'path', {
      d: pathData,
      stroke: "none",
      fill: colorWall,
      "stroke-width": 1,
      "stroke-linecap": "butt",
      "stroke-linejoin": "miter",
      "stroke-miterlimit": 4,
      "fill-rule": "nonzero"
    });
  },

  // ============================================================================
  // INTERACTION HELPERS
  // ============================================================================

  /**
   * Find nearest curved wall to a point
   */
  nearCurvedWall: function(snap, walls, range) {
    range = range || Infinity;
    var bestWall = null;
    var bestDist = Infinity;
    var bestPoint = null;

    for (var i = 0; i < walls.length; i++) {
      var wall = walls[i];
      var result = null;

      if (wall.wallType === 'arc') {
        result = this.nearPointOnArc(wall.center, wall.radius, wall.startAngle, wall.endAngle, snap);
      } else if (wall.wallType === 'bezier') {
        result = this.nearPointOnBezier(wall.start, wall.cp1, wall.cp2, wall.end, snap);
      }

      if (result && result.distance < bestDist && result.distance <= range) {
        bestDist = result.distance;
        bestWall = wall;
        bestPoint = result;
      }
    }

    if (bestWall) {
      return {
        wall: bestWall,
        x: bestPoint.x,
        y: bestPoint.y,
        t: bestPoint.t,
        distance: bestDist
      };
    }
    return false;
  },

  /**
   * Check if point is inside curved wall polygon
   */
  rayCastingCurvedWall: function(snap, walls) {
    for (var i = 0; i < walls.length; i++) {
      var wall = walls[i];
      if ((wall.wallType === 'arc' || wall.wallType === 'bezier') && wall.coords.length > 0) {
        if (qSVG.rayCasting(snap, wall.coords)) {
          return wall;
        }
      }
    }
    return false;
  }
};

// ============================================================================
// PROTOTYPE METHODS FOR WALL CLASSES
// ============================================================================

curvedWalls.arcWall.prototype.updateGeometry = function() {
  // Recalculate derived properties
  var arcLength = Math.abs(this.endAngle - this.startAngle) * this.radius;
  this.length = arcLength;

  // Angle at midpoint (for UI purposes)
  var midAngle = (this.startAngle + this.endAngle) / 2;
  this.angle = midAngle;
};

curvedWalls.bezierWall.prototype.updateControlPoints = function() {
  var cps = curvedWalls.controlPointsFromDirections(
    this.start, this.end,
    this.startAngle, this.endAngle,
    this.tension
  );
  this.cp1 = cps.cp1;
  this.cp2 = cps.cp2;
};

curvedWalls.bezierWall.prototype.updateGeometry = function() {
  this.updateControlPoints();

  // Approximate length
  var points = curvedWalls.bezierPoints(this.start, this.cp1, this.cp2, this.end, 50);
  var length = 0;
  for (var i = 1; i < points.length; i++) {
    length += Math.sqrt(
      Math.pow(points[i].x - points[i - 1].x, 2) +
      Math.pow(points[i].y - points[i - 1].y, 2)
    );
  }
  this.length = length;

  // Angle at midpoint
  var tangent = curvedWalls.bezierTangent(this.start, this.cp1, this.cp2, this.end, 0.5);
  this.angle = Math.atan2(tangent.y, tangent.x);
};

// ============================================================================
// GLOBAL CURVED WALLS ARRAY
// ============================================================================
var CURVED_WALLS = [];
