// ============================================================================
// GENERATOR CLASS - Automatic floor plan generation
// ============================================================================
// Generates building layouts on a discrete grid using Pawn-based construction
// with probabilistic turns toward center of mass for closed shapes
// ============================================================================

/**
 * Generator configuration constants
 */
var GeneratorConfig = {
  // Turn angles for each wall type (degrees added to current direction)
  turns: {
    wall:   [-90, -45, 0, 45, 90],
    arc:    [-90, -45, 45, 90],
    bezier: [-90, -45, 45, 90]
  },

  // Probability of turning toward center of mass (0-1)
  centerBias: 0.6,

  // Default wall parameters
  defaultThickness: 20,
  defaultWallLength: 120,  // ~2 meters at 60px/m
  defaultArcRadius: 60,
  defaultArcAngle: Math.PI / 4, // 45 degrees

  // Grid settings
  defaultGridSize: 30,     // Grid cell size in pixels

  // Building size parameters
  minBuildingRadius: 180,  // Minimum distance from center to first wall
  maxBuildingRadius: 360,  // Maximum distance from center to first wall

  // Generation limits
  maxWalls: 50,            // Maximum walls per generation
  maxAttempts: 100,        // Max attempts to close the building

  // Closure detection
  closureDistance: 40,     // Distance to consider "closed" to start point

  // Wall type probabilities (must sum to 1)
  wallTypeProbabilities: {
    wall: 0.6,
    arc: 0.25,
    bezier: 0.15
  }
};


// ============================================================================
// GENERATOR CLASS
// ============================================================================

/**
 * Generator - Automatic floor plan builder
 *
 * @param {Object} options - Configuration options
 * @param {number} options.gridSize - Size of discrete grid cells
 * @param {Object} options.centerOfMass - Center point {x, y}
 * @param {number} options.buildingRadius - Approximate building radius
 * @param {number} options.wallThickness - Wall thickness
 */
function Generator(options) {
  options = options || {};

  // Grid settings
  this.gridSize = options.gridSize || GeneratorConfig.defaultGridSize;

  // Center of mass (will be set on init or provided)
  this.centerOfMass = options.centerOfMass || null;

  // Building parameters
  this.buildingRadius = options.buildingRadius ||
    (GeneratorConfig.minBuildingRadius + GeneratorConfig.maxBuildingRadius) / 2;

  this.wallThickness = options.wallThickness || GeneratorConfig.defaultThickness;

  // Generation state
  this.pawns = [];           // All created pawns
  this.walls = [];           // All created walls
  this.startPoint = null;    // First wall start point
  this.currentPawn = null;   // Current pawn for continuation
  this.isClosed = false;     // Whether building is closed

  // Statistics
  this.stats = {
    wallCount: 0,
    arcCount: 0,
    bezierCount: 0,
    totalLength: 0,
    turnsTowardCenter: 0,
    turnsAwayFromCenter: 0
  };
}

// ============================================================================
// GENERATOR - Initialization
// ============================================================================

/**
 * Initialize generator with center of mass
 * @param {Object} center - Center point {x, y} (optional, will use viewport center if not provided)
 */
Generator.prototype.init = function(center) {
  // Set center of mass
  if (center) {
    this.centerOfMass = this.snapToGrid(center);
  } else {
    // Use viewport center as default
    this.centerOfMass = this.snapToGrid({
      x: originX_viewbox + width_viewbox / 2,
      y: originY_viewbox + height_viewbox / 2
    });
  }

  // Reset state
  this.pawns = [];
  this.walls = [];
  this.startPoint = null;
  this.currentPawn = null;
  this.isClosed = false;

  // Reset stats
  this.stats = {
    wallCount: 0,
    arcCount: 0,
    bezierCount: 0,
    totalLength: 0,
    turnsTowardCenter: 0,
    turnsAwayFromCenter: 0
  };

  return this;
};

/**
 * Create the first wall at a random position around center of mass
 */
Generator.prototype.createFirstWall = function() {
  // Random angle for first wall position
  var positionAngle = Math.random() * Math.PI * 2;

  // Random distance (approximately half of building radius)
  var distance = this.buildingRadius * (0.4 + Math.random() * 0.2);

  // Calculate start position
  var startPos = {
    x: this.centerOfMass.x + Math.cos(positionAngle) * distance,
    y: this.centerOfMass.y + Math.sin(positionAngle) * distance
  };
  startPos = this.snapToGrid(startPos);

  // Direction: tangent to circle around center (perpendicular to radius)
  // This makes the wall "wrap around" the center
  var startDirection = {
    x: -Math.sin(positionAngle),
    y: Math.cos(positionAngle)
  };

  // Store start point for closure detection
  this.startPoint = Vector2.clone(startPos);

  // Create first pawn
  this.currentPawn = new Pawn(startPos, startDirection, this.wallThickness);

  // Build first wall segment
  var wallLength = this.getRandomWallLength();
  this.currentPawn.buildWall(wallLength);

  // Store and add to editor
  this.pawns.push(this.currentPawn);
  var wall = this.currentPawn.addToEditor();
  this.walls.push(wall);

  // Update stats
  this.stats.wallCount++;
  this.stats.totalLength += wallLength;

  return this;
};

// ============================================================================
// GENERATOR - Wall Creation
// ============================================================================

/**
 * Generate the next wall segment
 * @returns {boolean} true if wall was created, false if building is closed or limit reached
 */
Generator.prototype.nextWall = function() {
  if (this.isClosed || this.walls.length >= GeneratorConfig.maxWalls) {
    return false;
  }

  if (!this.currentPawn || !this.currentPawn.endPosition) {
    console.error('Generator: No current pawn to continue from');
    return false;
  }

  // Check for closure
  if (this.checkClosure()) {
    this.isClosed = true;
    return false;
  }

  // Continue from current pawn
  var nextPawn = this.currentPawn.continue();

  // Choose wall type
  var wallType = this.chooseWallType();

  // Choose turn angle (biased toward center)
  var turnAngle = this.chooseTurnAngle(wallType, nextPawn.startPosition, nextPawn.startDirection);

  // Apply turn and build wall
  var newDirection = Vector2.rotate(nextPawn.startDirection, turnAngle);
  nextPawn.startDirection = newDirection;

  // Build based on type
  switch (wallType) {
    case 'wall':
      var length = this.getRandomWallLength();
      nextPawn.buildWall(length);
      this.stats.wallCount++;
      this.stats.totalLength += length;
      break;

    case 'arc':
      var radius = this.getRandomArcRadius();
      var arcAngle = this.getRandomArcAngle();
      // Determine arc direction based on turn toward center
      var towardCenter = this.isDirectionTowardCenter(nextPawn.startPosition, newDirection);
      if (!towardCenter) arcAngle = -arcAngle;
      nextPawn.buildArc(radius, arcAngle);
      this.stats.arcCount++;
      this.stats.totalLength += Math.abs(arcAngle) * radius;
      break;

    case 'bezier':
      var endPos = this.calculateBezierEndpoint(nextPawn.startPosition, newDirection);
      var endDir = this.calculateBezierEndDirection(nextPawn.startPosition, endPos);
      nextPawn.buildBezier(endPos, endDir, 0.4);
      this.stats.bezierCount++;
      this.stats.totalLength += nextPawn.wallData.length;
      break;
  }

  // Snap end position to grid
  nextPawn.endPosition = this.snapToGrid(nextPawn.endPosition);

  // Store and add to editor
  this.pawns.push(nextPawn);
  var wall = nextPawn.addToEditor();
  this.walls.push(wall);

  this.currentPawn = nextPawn;

  return true;
};

/**
 * Generate complete building
 * @param {number} targetWalls - Approximate number of walls (optional)
 * @returns {Generator} this
 */
Generator.prototype.generate = function(targetWalls) {
  targetWalls = targetWalls || 12;

  // Initialize if not already done
  if (!this.centerOfMass) {
    this.init();
  }

  // Create first wall if not exists
  if (this.pawns.length === 0) {
    this.createFirstWall();
  }

  // Generate walls until closed or limit reached
  var attempts = 0;
  while (!this.isClosed && this.walls.length < targetWalls && attempts < GeneratorConfig.maxAttempts) {
    this.nextWall();
    attempts++;
  }

  // Try to close the building if not closed yet
  if (!this.isClosed && this.walls.length > 3) {
    this.attemptClosure();
  }

  console.log('Generator: Created ' + this.walls.length + ' walls, closed: ' + this.isClosed);
  console.log('Stats:', this.stats);

  return this;
};

// ============================================================================
// GENERATOR - Decision Making
// ============================================================================

/**
 * Choose wall type based on probabilities
 * @returns {string} 'wall', 'arc', or 'bezier'
 */
Generator.prototype.chooseWallType = function() {
  var rand = Math.random();
  var probs = GeneratorConfig.wallTypeProbabilities;

  if (rand < probs.wall) return 'wall';
  if (rand < probs.wall + probs.arc) return 'arc';
  return 'bezier';
};

/**
 * Choose turn angle with bias toward center of mass
 * @param {string} wallType - Type of wall
 * @param {Object} position - Current position
 * @param {Object} direction - Current direction
 * @returns {number} Turn angle in radians
 */
Generator.prototype.chooseTurnAngle = function(wallType, position, direction) {
  var turns = GeneratorConfig.turns[wallType];
  var turnsRad = turns.map(function(deg) { return deg * Math.PI / 180; });

  // Determine which turns go toward center
  var towardCenterTurns = [];
  var awayCenterTurns = [];

  for (var i = 0; i < turnsRad.length; i++) {
    var testDir = Vector2.rotate(direction, turnsRad[i]);
    if (this.isDirectionTowardCenter(position, testDir)) {
      towardCenterTurns.push(turnsRad[i]);
    } else {
      awayCenterTurns.push(turnsRad[i]);
    }
  }

  // Choose with center bias
  var useTowardCenter = Math.random() < GeneratorConfig.centerBias;

  if (useTowardCenter && towardCenterTurns.length > 0) {
    this.stats.turnsTowardCenter++;
    return towardCenterTurns[Math.floor(Math.random() * towardCenterTurns.length)];
  } else if (awayCenterTurns.length > 0) {
    this.stats.turnsAwayFromCenter++;
    return awayCenterTurns[Math.floor(Math.random() * awayCenterTurns.length)];
  } else {
    // Fallback: random from all turns
    return turnsRad[Math.floor(Math.random() * turnsRad.length)];
  }
};

/**
 * Check if direction points toward center of mass
 * @param {Object} position - Current position
 * @param {Object} direction - Direction to check
 * @returns {boolean}
 */
Generator.prototype.isDirectionTowardCenter = function(position, direction) {
  var toCenter = Vector2.normalize(Vector2.sub(this.centerOfMass, position));
  var dot = Vector2.dot(direction, toCenter);
  return dot > 0;
};

// ============================================================================
// GENERATOR - Geometry Helpers
// ============================================================================

/**
 * Snap position to grid
 * @param {Object} pos - Position to snap
 * @returns {Object} Snapped position
 */
Generator.prototype.snapToGrid = function(pos) {
  return {
    x: Math.round(pos.x / this.gridSize) * this.gridSize,
    y: Math.round(pos.y / this.gridSize) * this.gridSize
  };
};

/**
 * Get random wall length (snapped to grid)
 */
Generator.prototype.getRandomWallLength = function() {
  var baseLength = GeneratorConfig.defaultWallLength;
  var variation = baseLength * 0.5;
  var length = baseLength + (Math.random() - 0.5) * variation;
  return Math.round(length / this.gridSize) * this.gridSize;
};

/**
 * Get random arc radius (snapped to grid)
 */
Generator.prototype.getRandomArcRadius = function() {
  var baseRadius = GeneratorConfig.defaultArcRadius;
  var variation = baseRadius * 0.3;
  var radius = baseRadius + (Math.random() - 0.5) * variation;
  return Math.round(radius / this.gridSize) * this.gridSize;
};

/**
 * Get random arc angle
 */
Generator.prototype.getRandomArcAngle = function() {
  var angles = [Math.PI / 4, Math.PI / 3, Math.PI / 2]; // 45, 60, 90 degrees
  return angles[Math.floor(Math.random() * angles.length)];
};

/**
 * Calculate bezier endpoint
 */
Generator.prototype.calculateBezierEndpoint = function(startPos, direction) {
  var length = this.getRandomWallLength();
  // Add some curve by offsetting perpendicular
  var perpOffset = (Math.random() - 0.5) * this.gridSize * 2;
  var perp = Vector2.perpendicular(direction);

  var endPos = Vector2.add(
    startPos,
    Vector2.add(
      Vector2.scale(direction, length),
      Vector2.scale(perp, perpOffset)
    )
  );

  return this.snapToGrid(endPos);
};

/**
 * Calculate bezier end direction (toward center bias)
 */
Generator.prototype.calculateBezierEndDirection = function(startPos, endPos) {
  var toCenter = Vector2.normalize(Vector2.sub(this.centerOfMass, endPos));
  var forward = Vector2.normalize(Vector2.sub(endPos, startPos));

  // Blend forward direction with toward-center direction
  var blend = 0.3 + Math.random() * 0.4;
  var blended = Vector2.normalize(Vector2.lerp(forward, toCenter, blend));

  return blended;
};

// ============================================================================
// GENERATOR - Closure
// ============================================================================

/**
 * Check if current position is close enough to start to close
 */
Generator.prototype.checkClosure = function() {
  if (!this.currentPawn || !this.startPoint || this.walls.length < 4) {
    return false;
  }

  var distance = Vector2.distance(this.currentPawn.endPosition, this.startPoint);
  return distance < GeneratorConfig.closureDistance;
};

/**
 * Attempt to close the building by connecting to start
 */
Generator.prototype.attemptClosure = function() {
  if (!this.currentPawn || !this.startPoint) return false;

  var distance = Vector2.distance(this.currentPawn.endPosition, this.startPoint);

  // If close enough, create closing wall
  if (distance < this.buildingRadius * 0.5) {
    var closingPawn = this.currentPawn.continue();
    closingPawn.buildWallTo(this.startPoint);

    this.pawns.push(closingPawn);
    var wall = closingPawn.addToEditor();
    this.walls.push(wall);

    this.stats.wallCount++;
    this.stats.totalLength += closingPawn.wallData.length;

    this.isClosed = true;
    console.log('Generator: Building closed with final wall');
    return true;
  }

  return false;
};

// ============================================================================
// GENERATOR - Utility
// ============================================================================

/**
 * Clear all generated walls
 */
Generator.prototype.clear = function() {
  // Remove walls from editor
  for (var i = 0; i < this.walls.length; i++) {
    if (this.walls[i].graph) {
      this.walls[i].graph.remove();
    }

    // Remove from WALLS or CURVED_WALLS array
    var wallIndex = WALLS.indexOf(this.walls[i]);
    if (wallIndex > -1) {
      WALLS.splice(wallIndex, 1);
    }

    var curvedIndex = CURVED_WALLS.indexOf(this.walls[i]);
    if (curvedIndex > -1) {
      CURVED_WALLS.splice(curvedIndex, 1);
    }
  }

  // Re-render
  editor.architect(WALLS);
  renderAllCurvedWalls();

  // Reset state
  this.pawns = [];
  this.walls = [];
  this.currentPawn = null;
  this.isClosed = false;

  save();
  return this;
};

/**
 * Get generation summary
 */
Generator.prototype.getSummary = function() {
  return {
    wallCount: this.walls.length,
    isClosed: this.isClosed,
    centerOfMass: this.centerOfMass,
    buildingRadius: this.buildingRadius,
    stats: this.stats
  };
};

// ============================================================================
// GENERATOR - Animated Generation
// ============================================================================

/**
 * Generate with animation (walls appear one by one)
 * @param {number} targetWalls - Target number of walls
 * @param {number} delay - Delay between walls in ms (default: 50)
 * @param {function} onComplete - Callback when generation is complete
 * @param {function} onStep - Callback after each wall (receives wall index)
 * @returns {Generator} this
 */
Generator.prototype.generateAnimated = function(targetWalls, delay, onComplete, onStep) {
  var self = this;
  targetWalls = targetWalls || 12;
  delay = delay || 50;

  // Initialize if not already done
  if (!this.centerOfMass) {
    this.init();
  }

  // Create first wall if not exists
  if (this.pawns.length === 0) {
    this.createFirstWall();
    if (onStep) onStep(0, this.walls[0]);
  }

  var wallIndex = this.walls.length;

  // Animated loop using setTimeout
  function nextStep() {
    if (self.isClosed || self.walls.length >= targetWalls) {
      // Try to close if not closed
      if (!self.isClosed && self.walls.length > 3) {
        self.attemptClosure();
      }

      console.log('Generator: Animation complete. Created ' + self.walls.length + ' walls, closed: ' + self.isClosed);

      if (onComplete) {
        onComplete(self);
      }
      return;
    }

    var success = self.nextWall();
    if (success) {
      wallIndex++;
      if (onStep) {
        onStep(wallIndex - 1, self.walls[self.walls.length - 1]);
      }
    }

    // Schedule next step
    if (!self.isClosed && self.walls.length < targetWalls) {
      setTimeout(nextStep, delay);
    } else {
      // Final closure attempt
      if (!self.isClosed && self.walls.length > 3) {
        self.attemptClosure();
      }

      console.log('Generator: Animation complete. Created ' + self.walls.length + ' walls, closed: ' + self.isClosed);

      if (onComplete) {
        onComplete(self);
      }
    }
  }

  // Start animation
  setTimeout(nextStep, delay);

  return this;
};

/**
 * Stop ongoing animation
 */
Generator.prototype.stopAnimation = function() {
  this._stopAnimation = true;
  return this;
};

// ============================================================================
// GENERATOR - Static Factory
// ============================================================================

/**
 * Quick generate a building
 * @param {Object} options - Generator options
 * @returns {Generator}
 */
Generator.quick = function(options) {
  var gen = new Generator(options);
  gen.init();
  gen.generate();
  return gen;
};

/**
 * Generate with specific wall count
 * @param {number} wallCount - Target number of walls
 * @param {Object} options - Generator options
 * @returns {Generator}
 */
Generator.withWalls = function(wallCount, options) {
  var gen = new Generator(options);
  gen.init();
  gen.generate(wallCount);
  return gen;
};

// ============================================================================
// USAGE EXAMPLES (commented out)
// ============================================================================
/*
// Example 1: Quick generation with defaults
var gen = Generator.quick();

// Example 2: Generate with specific center and radius
var gen = new Generator({
  centerOfMass: {x: 500, y: 400},
  buildingRadius: 200,
  gridSize: 30
});
gen.init();
gen.generate(15);

// Example 3: Step by step generation
var gen = new Generator();
gen.init({x: 600, y: 400});
gen.createFirstWall();
gen.nextWall();
gen.nextWall();
gen.nextWall();
// ... continue until closed

// Example 4: Regenerate
gen.clear();
gen.init();
gen.generate(10);

// Example 5: Custom configuration
GeneratorConfig.centerBias = 0.8; // More tendency to close
GeneratorConfig.wallTypeProbabilities = {
  wall: 0.8,
  arc: 0.15,
  bezier: 0.05
};
var gen = Generator.quick();
*/
