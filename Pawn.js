// ============================================================================
// PAWN CLASS - Unified wall builder with direction-based construction
// ============================================================================
// Creates walls (straight, arc, bezier) using start/end positions and directions
// Similar to turtle graphics approach for sequential wall building
// ============================================================================

/**
 * Vector2 helper class for 2D vector operations
 */
var Vector2 = {
  /**
   * Create a new vector
   */
  create: function(x, y) {
    return { x: x || 0, y: y || 0 };
  },

  /**
   * Add two vectors
   */
  add: function(v1, v2) {
    return { x: v1.x + v2.x, y: v1.y + v2.y };
  },

  /**
   * Subtract v2 from v1
   */
  sub: function(v1, v2) {
    return { x: v1.x - v2.x, y: v1.y - v2.y };
  },

  /**
   * Multiply vector by scalar
   */
  scale: function(v, s) {
    return { x: v.x * s, y: v.y * s };
  },

  /**
   * Get vector length
   */
  length: function(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  },

  /**
   * Normalize vector (make unit length)
   */
  normalize: function(v) {
    var len = this.length(v);
    if (len < 0.0001) return { x: 1, y: 0 };
    return { x: v.x / len, y: v.y / len };
  },

  /**
   * Get perpendicular vector (90 degrees CCW)
   */
  perpendicular: function(v) {
    return { x: -v.y, y: v.x };
  },

  /**
   * Dot product
   */
  dot: function(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
  },

  /**
   * Cross product (2D returns scalar)
   */
  cross: function(v1, v2) {
    return v1.x * v2.y - v1.y * v2.x;
  },

  /**
   * Get angle of vector in radians
   */
  angle: function(v) {
    return Math.atan2(v.y, v.x);
  },

  /**
   * Create vector from angle (radians)
   */
  fromAngle: function(angle) {
    return { x: Math.cos(angle), y: Math.sin(angle) };
  },

  /**
   * Rotate vector by angle (radians)
   */
  rotate: function(v, angle) {
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos
    };
  },

  /**
   * Linear interpolation between two vectors
   */
  lerp: function(v1, v2, t) {
    return {
      x: v1.x + (v2.x - v1.x) * t,
      y: v1.y + (v2.y - v1.y) * t
    };
  },

  /**
   * Distance between two points
   */
  distance: function(v1, v2) {
    return this.length(this.sub(v2, v1));
  },

  /**
   * Check if two vectors are equal (with epsilon)
   */
  equals: function(v1, v2, epsilon) {
    epsilon = epsilon || 0.0001;
    return Math.abs(v1.x - v2.x) < epsilon && Math.abs(v1.y - v2.y) < epsilon;
  },

  /**
   * Clone a vector
   */
  clone: function(v) {
    return { x: v.x, y: v.y };
  }
};


// ============================================================================
// PAWN CLASS
// ============================================================================

/**
 * Pawn - A builder class for creating walls with direction-based construction
 *
 * @param {Object} startPosition - Starting point {x, y}
 * @param {Object} startDirection - Starting direction (will be normalized) {x, y}
 * @param {number} thickness - Wall thickness (default: 20)
 */
function Pawn(startPosition, startDirection, thickness) {
  // Validate inputs
  if (!startPosition || typeof startPosition.x !== 'number' || typeof startPosition.y !== 'number') {
    throw new Error('Pawn: startPosition must be a valid vector {x, y}');
  }
  if (!startDirection || typeof startDirection.x !== 'number' || typeof startDirection.y !== 'number') {
    throw new Error('Pawn: startDirection must be a valid vector {x, y}');
  }

  // Current state
  this.startPosition = Vector2.clone(startPosition);
  this.startDirection = Vector2.normalize(startDirection);
  this.thickness = thickness || 20;

  // Result properties (set after building)
  this.type = null;           // 'wall' | 'arc' | 'bezier'
  this.endPosition = null;    // End point vector
  this.endDirection = null;   // End direction (normalized)

  // Wall-specific data (populated based on type)
  this.wallData = null;
}

// ============================================================================
// PAWN METHODS - Wall Builders
// ============================================================================

/**
 * Build a straight wall
 *
 * @param {number} length - Length of the wall
 * @returns {Pawn} this (for chaining)
 */
Pawn.prototype.buildWall = function(length) {
  this.type = 'wall';

  // Calculate end position
  this.endPosition = Vector2.add(
    this.startPosition,
    Vector2.scale(this.startDirection, length)
  );

  // End direction is same as start for straight walls
  this.endDirection = Vector2.clone(this.startDirection);

  // Store wall data
  this.wallData = {
    start: Vector2.clone(this.startPosition),
    end: Vector2.clone(this.endPosition),
    thick: this.thickness,
    length: length
  };

  return this;
};

/**
 * Build a straight wall to a specific end point
 *
 * @param {Object} endPosition - Target end point {x, y}
 * @returns {Pawn} this (for chaining)
 */
Pawn.prototype.buildWallTo = function(endPosition) {
  this.type = 'wall';
  this.endPosition = Vector2.clone(endPosition);

  // Calculate direction from start to end
  var direction = Vector2.sub(endPosition, this.startPosition);
  this.endDirection = Vector2.normalize(direction);

  // Also update start direction to match the actual wall direction
  this.startDirection = Vector2.clone(this.endDirection);

  var length = Vector2.length(direction);

  this.wallData = {
    start: Vector2.clone(this.startPosition),
    end: Vector2.clone(this.endPosition),
    thick: this.thickness,
    length: length
  };

  return this;
};

/**
 * Build an arc wall
 *
 * @param {number} radius - Arc radius
 * @param {number} angle - Arc angle in radians (positive = CCW, negative = CW)
 * @returns {Pawn} this (for chaining)
 */
Pawn.prototype.buildArc = function(radius, angle) {
  this.type = 'arc';

  // Determine arc direction
  var clockwise = angle < 0;
  var absAngle = Math.abs(angle);

  // Find center of arc (perpendicular to start direction)
  // For CCW: center is to the left of direction
  // For CW: center is to the right of direction
  var perpDir = Vector2.perpendicular(this.startDirection);
  if (clockwise) {
    perpDir = Vector2.scale(perpDir, -1);
  }

  var center = Vector2.add(this.startPosition, Vector2.scale(perpDir, radius));

  // Calculate end position
  var startAngle = Vector2.angle(Vector2.sub(this.startPosition, center));
  var endAngle = clockwise ? startAngle - absAngle : startAngle + absAngle;

  this.endPosition = Vector2.add(center, Vector2.scale(Vector2.fromAngle(endAngle), radius));

  // Calculate end direction (tangent at end point)
  var tangent = Vector2.perpendicular(Vector2.sub(this.endPosition, center));
  if (clockwise) {
    tangent = Vector2.scale(tangent, -1);
  }
  this.endDirection = Vector2.normalize(tangent);

  // Store arc data
  this.wallData = {
    start: Vector2.clone(this.startPosition),
    end: Vector2.clone(this.endPosition),
    center: center,
    radius: radius,
    startAngle: startAngle,
    endAngle: endAngle,
    clockwise: clockwise,
    thick: this.thickness,
    arcLength: absAngle * radius
  };

  return this;
};

/**
 * Build an arc wall to a specific end point with given end direction
 *
 * @param {Object} endPosition - Target end point {x, y}
 * @param {Object} endDirection - End direction vector (will be normalized)
 * @returns {Pawn} this (for chaining)
 */
Pawn.prototype.buildArcTo = function(endPosition, endDirection) {
  this.type = 'arc';
  this.endPosition = Vector2.clone(endPosition);
  this.endDirection = Vector2.normalize(endDirection);

  // Calculate arc parameters from start/end positions and directions
  // Using the formula for finding circle through two points with given tangents
  var startPerp = Vector2.perpendicular(this.startDirection);
  var endPerp = Vector2.perpendicular(this.endDirection);

  // Find intersection of perpendiculars (this is the center)
  var center = this._lineIntersection(
    this.startPosition, startPerp,
    this.endPosition, endPerp
  );

  if (!center) {
    // Lines are parallel, fall back to straight wall
    return this.buildWallTo(endPosition);
  }

  var radius = Vector2.distance(center, this.startPosition);
  var startAngle = Vector2.angle(Vector2.sub(this.startPosition, center));
  var endAngle = Vector2.angle(Vector2.sub(this.endPosition, center));

  // Determine clockwise/counterclockwise
  var cross = Vector2.cross(this.startDirection, Vector2.sub(center, this.startPosition));
  var clockwise = cross > 0;

  this.wallData = {
    start: Vector2.clone(this.startPosition),
    end: Vector2.clone(this.endPosition),
    center: center,
    radius: radius,
    startAngle: startAngle,
    endAngle: endAngle,
    clockwise: clockwise,
    thick: this.thickness,
    arcLength: Math.abs(endAngle - startAngle) * radius
  };

  return this;
};

/**
 * Build a bezier wall
 *
 * @param {Object} endPosition - End point {x, y}
 * @param {Object} endDirection - End direction (will be normalized)
 * @param {number} tension - Curve tension (0-1, default: 0.4)
 * @returns {Pawn} this (for chaining)
 */
Pawn.prototype.buildBezier = function(endPosition, endDirection, tension) {
  this.type = 'bezier';
  tension = tension || 0.4;

  this.endPosition = Vector2.clone(endPosition);
  this.endDirection = Vector2.normalize(endDirection);

  // Calculate control points based on directions and tension
  var distance = Vector2.distance(this.startPosition, this.endPosition);
  var handleLength = distance * tension;

  var cp1 = Vector2.add(
    this.startPosition,
    Vector2.scale(this.startDirection, handleLength)
  );

  // End control point: we use the incoming direction (opposite of endDirection)
  var cp2 = Vector2.sub(
    this.endPosition,
    Vector2.scale(this.endDirection, handleLength)
  );

  // Approximate bezier length
  var length = this._approximateBezierLength(
    this.startPosition, cp1, cp2, this.endPosition, 50
  );

  this.wallData = {
    start: Vector2.clone(this.startPosition),
    end: Vector2.clone(this.endPosition),
    cp1: cp1,
    cp2: cp2,
    startDirection: Vector2.clone(this.startDirection),
    endDirection: Vector2.clone(this.endDirection),
    tension: tension,
    thick: this.thickness,
    length: length
  };

  return this;
};

/**
 * Build a bezier wall with explicit control points
 *
 * @param {Object} cp1 - First control point {x, y}
 * @param {Object} cp2 - Second control point {x, y}
 * @param {Object} endPosition - End point {x, y}
 * @returns {Pawn} this (for chaining)
 */
Pawn.prototype.buildBezierWithControlPoints = function(cp1, cp2, endPosition) {
  this.type = 'bezier';

  this.endPosition = Vector2.clone(endPosition);

  // Calculate end direction from last segment of bezier
  this.endDirection = Vector2.normalize(Vector2.sub(endPosition, cp2));

  var length = this._approximateBezierLength(
    this.startPosition, cp1, cp2, endPosition, 50
  );

  this.wallData = {
    start: Vector2.clone(this.startPosition),
    end: Vector2.clone(this.endPosition),
    cp1: Vector2.clone(cp1),
    cp2: Vector2.clone(cp2),
    startDirection: Vector2.clone(this.startDirection),
    endDirection: Vector2.clone(this.endDirection),
    tension: null, // Not applicable for explicit control points
    thick: this.thickness,
    length: length
  };

  return this;
};

// ============================================================================
// PAWN METHODS - Utility
// ============================================================================

/**
 * Create the actual wall object for the editor
 * @returns {Object} Wall object compatible with the editor
 */
Pawn.prototype.createWall = function() {
  if (!this.type || !this.wallData) {
    throw new Error('Pawn: No wall has been built yet. Call buildWall, buildArc, or buildBezier first.');
  }

  var wall = null;

  switch (this.type) {
    case 'wall':
      // Create standard straight wall
      wall = new editor.wall(
        this.wallData.start,
        this.wallData.end,
        'normal',
        this.wallData.thick
      );
      wall.wallType = 'wall';
      break;

    case 'arc':
      // Create arc wall
      wall = new curvedWalls.arcWall(
        this.wallData.start,
        this.wallData.end,
        this.wallData.radius,
        this.wallData.clockwise,
        'normal',
        this.wallData.thick
      );
      break;

    case 'bezier':
      // Create bezier wall
      var startAngle = Vector2.angle(this.wallData.startDirection);
      var endAngle = Vector2.angle(this.wallData.endDirection);

      wall = new curvedWalls.bezierWall(
        this.wallData.start,
        this.wallData.end,
        startAngle,
        endAngle,
        this.wallData.tension || 0.4,
        'normal',
        this.wallData.thick
      );

      // Override control points if explicitly set
      if (this.wallData.cp1) wall.cp1 = this.wallData.cp1;
      if (this.wallData.cp2) wall.cp2 = this.wallData.cp2;
      break;
  }

  return wall;
};

/**
 * Add the wall to the editor and render it
 * @param {Object} options - Optional settings
 * @param {boolean} options.skipArchitect - Skip architect call (for batch operations)
 * @param {boolean} options.skipSave - Skip save call (for batch operations)
 * @returns {Object} The created wall object
 */
Pawn.prototype.addToEditor = function(options) {
  options = options || {};
  var wall = this.createWall();

  if (this.type === 'wall') {
    WALLS.push(wall);
    if (!options.skipArchitect) {
      editor.architect(WALLS);
    }
  } else {
    CURVED_WALLS.push(wall);
    if (this.type === 'arc') {
      curvedWalls.computeArcWall(wall);
    } else if (this.type === 'bezier') {
      curvedWalls.computeBezierWall(wall);
    }
  }

  if (!options.skipSave) {
    save();
  }
  return wall;
};

/**
 * Create a new Pawn continuing from the end of this one
 * @returns {Pawn} New Pawn starting from this one's end
 */
Pawn.prototype.continue = function() {
  if (!this.endPosition || !this.endDirection) {
    throw new Error('Pawn: Cannot continue - no wall has been built yet.');
  }
  return new Pawn(this.endPosition, this.endDirection, this.thickness);
};

/**
 * Set wall thickness
 * @param {number} thickness - New thickness
 * @returns {Pawn} this (for chaining)
 */
Pawn.prototype.setThickness = function(thickness) {
  this.thickness = thickness;
  if (this.wallData) {
    this.wallData.thick = thickness;
  }
  return this;
};

/**
 * Get wall data summary
 * @returns {Object} Summary of the built wall
 */
Pawn.prototype.getSummary = function() {
  return {
    type: this.type,
    startPosition: this.startPosition,
    startDirection: this.startDirection,
    endPosition: this.endPosition,
    endDirection: this.endDirection,
    thickness: this.thickness,
    wallData: this.wallData
  };
};

// ============================================================================
// PAWN METHODS - Private Helpers
// ============================================================================

/**
 * Find intersection of two lines defined by point and direction
 * @private
 */
Pawn.prototype._lineIntersection = function(p1, d1, p2, d2) {
  var cross = Vector2.cross(d1, d2);
  if (Math.abs(cross) < 0.0001) {
    return null; // Lines are parallel
  }

  var diff = Vector2.sub(p2, p1);
  var t = Vector2.cross(diff, d2) / cross;

  return Vector2.add(p1, Vector2.scale(d1, t));
};

/**
 * Approximate bezier curve length by sampling
 * @private
 */
Pawn.prototype._approximateBezierLength = function(p0, p1, p2, p3, segments) {
  var length = 0;
  var prev = p0;

  for (var i = 1; i <= segments; i++) {
    var t = i / segments;
    var mt = 1 - t;
    var mt2 = mt * mt;
    var mt3 = mt2 * mt;
    var t2 = t * t;
    var t3 = t2 * t;

    var point = {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
    };

    length += Vector2.distance(prev, point);
    prev = point;
  }

  return length;
};

// ============================================================================
// STATIC FACTORY METHODS
// ============================================================================

/**
 * Create a Pawn from position and angle
 * @param {Object} position - Start position {x, y}
 * @param {number} angle - Direction angle in radians
 * @param {number} thickness - Wall thickness
 * @returns {Pawn}
 */
Pawn.fromAngle = function(position, angle, thickness) {
  return new Pawn(position, Vector2.fromAngle(angle), thickness);
};

/**
 * Create a Pawn from two points (direction is from p1 to p2)
 * @param {Object} p1 - Start position
 * @param {Object} p2 - Point defining direction
 * @param {number} thickness - Wall thickness
 * @returns {Pawn}
 */
Pawn.fromPoints = function(p1, p2, thickness) {
  var direction = Vector2.sub(p2, p1);
  return new Pawn(p1, direction, thickness);
};

// ============================================================================
// USAGE EXAMPLES (commented out)
// ============================================================================
/*
// Example 1: Create a simple straight wall
var pawn1 = new Pawn({x: 100, y: 100}, {x: 1, y: 0}, 20);
pawn1.buildWall(200);
pawn1.addToEditor();

// Example 2: Create an arc wall (90 degree turn)
var pawn2 = new Pawn({x: 100, y: 100}, {x: 1, y: 0}, 20);
pawn2.buildArc(50, Math.PI / 2); // 50px radius, 90 degrees CCW
pawn2.addToEditor();

// Example 3: Create a bezier curve
var pawn3 = new Pawn({x: 100, y: 100}, {x: 1, y: 0}, 20);
pawn3.buildBezier({x: 300, y: 200}, {x: 0, y: 1}, 0.4);
pawn3.addToEditor();

// Example 4: Chain multiple walls
var start = new Pawn({x: 100, y: 100}, {x: 1, y: 0}, 20);
start.buildWall(100).addToEditor();

var corner = start.continue();
corner.buildArc(30, -Math.PI / 2).addToEditor(); // Turn right 90 degrees

var next = corner.continue();
next.buildWall(100).addToEditor();

// Example 5: Using factory methods
var pawn5 = Pawn.fromAngle({x: 200, y: 200}, Math.PI / 4, 20); // 45 degree direction
pawn5.buildWall(150).addToEditor();
*/
