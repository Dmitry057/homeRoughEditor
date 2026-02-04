/**
 * ProceduralGeneratorBehaviour.js
 * Graph-based procedural floor plan generation
 *
 * Approach:
 * 1. Build random room graph with connections
 * 2. Generate walls procedurally with rules:
 *    - Corner (angle change) → 50% chance Arc
 *    - Diagonal wall → 50% chance Bezier (ONLY when both x and y differ)
 *    - Otherwise → Wall
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var ProceduralConfig = {
  // Grid settings
  gridSize: 30,           // Snap grid size in pixels

  // Room generation
  minRooms: 3,
  maxRooms: 8,
  minRoomSize: 3,         // In grid units
  maxRoomSize: 6,         // In grid units

  // Wall type probabilities
  arcCornerChance: 0.5,      // 50% chance for Arc on corners
  bezierDiagonalChance: 0.5, // 50% chance for Bezier on diagonals

  // Wall properties
  wallThickness: 20,

  // Building placement
  centerX: 550,
  centerY: 350,

  // Arc settings for corners
  arcCornerRadius: 30,

  // Bezier settings
  defaultBezierTension: 0.4
};

// ============================================================================
// ROOM NODE - Simple rectangular room
// ============================================================================

function RoomNode(id, x, y, width, height) {
  this.id = id;
  this.gridX = x;
  this.gridY = y;
  this.gridWidth = width;
  this.gridHeight = height;
  this.connections = [];
}

RoomNode.prototype.getPixelBounds = function(config) {
  return {
    x: this.gridX * config.gridSize + config.centerX,
    y: this.gridY * config.gridSize + config.centerY,
    width: this.gridWidth * config.gridSize,
    height: this.gridHeight * config.gridSize
  };
};

RoomNode.prototype.getCorners = function(config) {
  var b = this.getPixelBounds(config);
  return [
    { x: b.x, y: b.y },                       // 0: Top-left
    { x: b.x + b.width, y: b.y },             // 1: Top-right
    { x: b.x + b.width, y: b.y + b.height },  // 2: Bottom-right
    { x: b.x, y: b.y + b.height }             // 3: Bottom-left
  ];
};

RoomNode.prototype.intersects = function(other, config, padding) {
  padding = padding || 0;
  var a = this.getPixelBounds(config);
  var b = other.getPixelBounds(config);
  var p = padding * config.gridSize;

  return !(a.x + a.width + p < b.x ||
           b.x + b.width + p < a.x ||
           a.y + a.height + p < b.y ||
           b.y + b.height + p < a.y);
};

// ============================================================================
// PROCEDURAL GENERATOR BEHAVIOUR
// ============================================================================

function ProceduralGeneratorBehaviour(options) {
  options = options || {};
  this.config = {};

  // Merge config
  for (var key in ProceduralConfig) {
    this.config[key] = options[key] !== undefined ? options[key] : ProceduralConfig[key];
  }

  this.rooms = [];
  this.builtWalls = [];
  this.builtPawns = [];

  this.isGenerating = false;
  this.animationTimer = null;
}

// ============================================================================
// ROOM GRAPH GENERATION
// ============================================================================

ProceduralGeneratorBehaviour.prototype.generateRoomGraph = function(numRooms) {
  this.rooms = [];
  numRooms = numRooms || this._randomInt(this.config.minRooms, this.config.maxRooms);

  // Create first room at origin
  var firstRoom = this._createRandomRoom(0, 0, 0);
  this.rooms.push(firstRoom);

  var attempts = 0;
  var maxAttempts = numRooms * 100;

  while (this.rooms.length < numRooms && attempts < maxAttempts) {
    attempts++;

    // Pick random existing room
    var parentRoom = this.rooms[this._randomInt(0, this.rooms.length - 1)];

    // Try to place adjacent room
    var newRoom = this._tryPlaceAdjacentRoom(parentRoom, this.rooms.length);
    if (newRoom) {
      this.rooms.push(newRoom);
      parentRoom.connections.push(newRoom.id);
      newRoom.connections.push(parentRoom.id);
    }
  }

  console.log('ProceduralGenerator: Created ' + this.rooms.length + ' rooms');
  return this.rooms;
};

ProceduralGeneratorBehaviour.prototype._createRandomRoom = function(id, gridX, gridY) {
  var w = this._randomInt(this.config.minRoomSize, this.config.maxRoomSize);
  var h = this._randomInt(this.config.minRoomSize, this.config.maxRoomSize);
  return new RoomNode(id, gridX, gridY, w, h);
};

ProceduralGeneratorBehaviour.prototype._tryPlaceAdjacentRoom = function(parent, newId) {
  var directions = ['top', 'right', 'bottom', 'left'];
  this._shuffle(directions);

  for (var i = 0; i < directions.length; i++) {
    var newRoom = this._createAdjacentRoom(parent, newId, directions[i]);
    if (newRoom && !this._roomOverlapsAny(newRoom)) {
      return newRoom;
    }
  }
  return null;
};

ProceduralGeneratorBehaviour.prototype._createAdjacentRoom = function(parent, newId, direction) {
  var w = this._randomInt(this.config.minRoomSize, this.config.maxRoomSize);
  var h = this._randomInt(this.config.minRoomSize, this.config.maxRoomSize);
  var offset = this._randomInt(-1, 1);
  var gridX, gridY;

  switch (direction) {
    case 'top':
      gridX = parent.gridX + offset;
      gridY = parent.gridY - h;
      break;
    case 'right':
      gridX = parent.gridX + parent.gridWidth;
      gridY = parent.gridY + offset;
      break;
    case 'bottom':
      gridX = parent.gridX + offset;
      gridY = parent.gridY + parent.gridHeight;
      break;
    case 'left':
      gridX = parent.gridX - w;
      gridY = parent.gridY + offset;
      break;
  }

  return new RoomNode(newId, gridX, gridY, w, h);
};

ProceduralGeneratorBehaviour.prototype._roomOverlapsAny = function(room) {
  for (var i = 0; i < this.rooms.length; i++) {
    if (room.intersects(this.rooms[i], this.config, 0)) {
      return true;
    }
  }
  return false;
};

// ============================================================================
// WALL GENERATION - Build walls around all rooms
// ============================================================================

ProceduralGeneratorBehaviour.prototype.buildWalls = function() {
  this.builtWalls = [];
  this.builtPawns = [];

  // Collect all edges from all rooms
  var allEdges = this._collectAllEdges();

  // Remove internal edges (shared between rooms)
  var externalEdges = this._removeInternalEdges(allEdges);

  // Sort edges into a continuous path (as much as possible)
  var sortedEdges = this._sortEdgesIntoPath(externalEdges);

  // Build walls from sorted edges
  this._buildWallsFromEdges(sortedEdges);

  console.log('ProceduralGenerator: Built ' + this.builtWalls.length + ' walls');
  return this.builtWalls;
};

ProceduralGeneratorBehaviour.prototype._collectAllEdges = function() {
  var edges = [];

  for (var i = 0; i < this.rooms.length; i++) {
    var corners = this.rooms[i].getCorners(this.config);

    // 4 edges: top, right, bottom, left
    edges.push({ start: corners[0], end: corners[1], roomId: i, side: 'top' });
    edges.push({ start: corners[1], end: corners[2], roomId: i, side: 'right' });
    edges.push({ start: corners[2], end: corners[3], roomId: i, side: 'bottom' });
    edges.push({ start: corners[3], end: corners[0], roomId: i, side: 'left' });
  }

  return edges;
};

ProceduralGeneratorBehaviour.prototype._removeInternalEdges = function(edges) {
  var external = [];
  var edgeMap = {};

  // Create keys for each edge (both directions)
  for (var i = 0; i < edges.length; i++) {
    var e = edges[i];
    var key = this._edgeKey(e.start, e.end);
    var reverseKey = this._edgeKey(e.end, e.start);

    if (edgeMap[reverseKey]) {
      // This edge has a reverse - both are internal, mark for removal
      edgeMap[reverseKey].internal = true;
      e.internal = true;
    }
    edgeMap[key] = e;
  }

  // Collect only external edges
  for (var j = 0; j < edges.length; j++) {
    if (!edges[j].internal) {
      external.push(edges[j]);
    }
  }

  return external;
};

ProceduralGeneratorBehaviour.prototype._edgeKey = function(start, end) {
  return Math.round(start.x) + ',' + Math.round(start.y) + '-' +
         Math.round(end.x) + ',' + Math.round(end.y);
};

ProceduralGeneratorBehaviour.prototype._sortEdgesIntoPath = function(edges) {
  if (edges.length === 0) return [];

  var sorted = [edges[0]];
  var remaining = edges.slice(1);
  var tolerance = 2;

  var maxIterations = edges.length * 2;
  var iterations = 0;

  while (remaining.length > 0 && iterations < maxIterations) {
    iterations++;
    var current = sorted[sorted.length - 1];
    var foundNext = false;

    for (var i = 0; i < remaining.length; i++) {
      var edge = remaining[i];

      // Check if edge starts where current ends
      if (this._pointsClose(current.end, edge.start, tolerance)) {
        sorted.push(edge);
        remaining.splice(i, 1);
        foundNext = true;
        break;
      }

      // Check if reversed edge connects
      if (this._pointsClose(current.end, edge.end, tolerance)) {
        sorted.push({ start: edge.end, end: edge.start, roomId: edge.roomId, side: edge.side });
        remaining.splice(i, 1);
        foundNext = true;
        break;
      }
    }

    if (!foundNext && remaining.length > 0) {
      // Gap in path - add next edge anyway
      sorted.push(remaining[0]);
      remaining.splice(0, 1);
    }
  }

  return sorted;
};

ProceduralGeneratorBehaviour.prototype._pointsClose = function(p1, p2, tolerance) {
  return Math.abs(p1.x - p2.x) <= tolerance && Math.abs(p1.y - p2.y) <= tolerance;
};

// ============================================================================
// BUILD WALLS FROM EDGES - Apply type rules
// ============================================================================

ProceduralGeneratorBehaviour.prototype._buildWallsFromEdges = function(edges) {
  for (var i = 0; i < edges.length; i++) {
    var edge = edges[i];
    var prevEdge = i > 0 ? edges[i - 1] : edges[edges.length - 1];

    // Determine if this is a corner (direction change from previous)
    var isCorner = this._isCornerTransition(prevEdge, edge);

    // Check if diagonal (both x and y differ)
    var isDiagonal = this._isDiagonalEdge(edge);

    // Determine wall type based on rules
    var wallType = 'wall';

    if (isDiagonal && Math.random() < this.config.bezierDiagonalChance) {
      // Diagonal: 50% Bezier
      wallType = 'bezier';
    } else if (isCorner && Math.random() < this.config.arcCornerChance) {
      // Corner: 50% Arc - but we'll add arc as separate corner piece
      this._buildArcCorner(prevEdge, edge);
      // Continue with straight wall after arc
    }

    // Build the wall segment
    this._buildWallSegment(edge, wallType);
  }
};

ProceduralGeneratorBehaviour.prototype._isCornerTransition = function(prevEdge, currEdge) {
  if (!prevEdge || !currEdge) return false;

  var prevDx = prevEdge.end.x - prevEdge.start.x;
  var prevDy = prevEdge.end.y - prevEdge.start.y;
  var currDx = currEdge.end.x - currEdge.start.x;
  var currDy = currEdge.end.y - currEdge.start.y;

  // Normalize
  var prevLen = Math.sqrt(prevDx * prevDx + prevDy * prevDy) || 1;
  var currLen = Math.sqrt(currDx * currDx + currDy * currDy) || 1;

  prevDx /= prevLen; prevDy /= prevLen;
  currDx /= currLen; currDy /= currLen;

  // Dot product - if < 0.9, there's a significant angle change
  var dot = prevDx * currDx + prevDy * currDy;
  return dot < 0.9;
};

ProceduralGeneratorBehaviour.prototype._isDiagonalEdge = function(edge) {
  var dx = Math.abs(edge.end.x - edge.start.x);
  var dy = Math.abs(edge.end.y - edge.start.y);
  // True diagonal: BOTH coordinates must differ significantly
  return dx > 5 && dy > 5;
};

ProceduralGeneratorBehaviour.prototype._buildArcCorner = function(prevEdge, currEdge) {
  // Build a small arc at the corner between two edges
  if (!this._pointsClose(prevEdge.end, currEdge.start, 5)) return;

  var cornerPoint = prevEdge.end;

  // Calculate directions
  var prevDx = prevEdge.end.x - prevEdge.start.x;
  var prevDy = prevEdge.end.y - prevEdge.start.y;
  var prevLen = Math.sqrt(prevDx * prevDx + prevDy * prevDy) || 1;
  var prevDir = { x: prevDx / prevLen, y: prevDy / prevLen };

  var currDx = currEdge.end.x - currEdge.start.x;
  var currDy = currEdge.end.y - currEdge.start.y;
  var currLen = Math.sqrt(currDx * currDx + currDy * currDy) || 1;
  var currDir = { x: currDx / currLen, y: currDy / currLen };

  // Create arc from just before corner to just after
  var r = this.config.arcCornerRadius;
  var arcStart = {
    x: cornerPoint.x - prevDir.x * r,
    y: cornerPoint.y - prevDir.y * r
  };
  var arcEnd = {
    x: cornerPoint.x + currDir.x * r,
    y: cornerPoint.y + currDir.y * r
  };

  // Build arc using Pawn
  var pawn = new Pawn(arcStart, prevDir, this.config.wallThickness);
  pawn.buildArcTo(arcEnd, currDir);

  if (pawn.wallData) {
    pawn.addToEditor();
    this.builtWalls.push(pawn.wallData);
    this.builtPawns.push(pawn);
  }
};

ProceduralGeneratorBehaviour.prototype._buildWallSegment = function(edge, wallType) {
  var dx = edge.end.x - edge.start.x;
  var dy = edge.end.y - edge.start.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return; // Skip very short segments

  var dir = { x: dx / len, y: dy / len };

  var pawn = new Pawn(edge.start, dir, this.config.wallThickness);

  if (wallType === 'bezier' && this._isDiagonalEdge(edge)) {
    // Bezier for diagonal
    var endDir = dir; // Keep same direction
    pawn.buildBezier(edge.end, endDir, this.config.defaultBezierTension);
  } else {
    // Regular wall
    pawn.buildWallTo(edge.end);
  }

  if (pawn.wallData) {
    pawn.addToEditor();
    this.builtWalls.push(pawn.wallData);
    this.builtPawns.push(pawn);
  }
};

// ============================================================================
// ANIMATED GENERATION
// ============================================================================

ProceduralGeneratorBehaviour.prototype.generateAnimated = function(numRooms, delay, onComplete, onStep) {
  var self = this;
  delay = delay || 50;

  this.isGenerating = true;

  // Generate room graph first
  this.generateRoomGraph(numRooms);

  // Collect and prepare edges
  var allEdges = this._collectAllEdges();
  var externalEdges = this._removeInternalEdges(allEdges);
  var sortedEdges = this._sortEdgesIntoPath(externalEdges);

  var edgeIndex = 0;

  function buildNext() {
    if (!self.isGenerating || edgeIndex >= sortedEdges.length) {
      self.isGenerating = false;
      console.log('ProceduralGenerator: Animation complete. Built ' + self.builtWalls.length + ' walls');
      if (onComplete) onComplete(self);
      return;
    }

    var edge = sortedEdges[edgeIndex];
    var prevEdge = edgeIndex > 0 ? sortedEdges[edgeIndex - 1] : null;

    // Check for corner arc
    var isCorner = prevEdge && self._isCornerTransition(prevEdge, edge);
    if (isCorner && Math.random() < self.config.arcCornerChance) {
      self._buildArcCorner(prevEdge, edge);
    }

    // Determine wall type
    var isDiagonal = self._isDiagonalEdge(edge);
    var wallType = 'wall';
    if (isDiagonal && Math.random() < self.config.bezierDiagonalChance) {
      wallType = 'bezier';
    }

    // Build wall
    self._buildWallSegment(edge, wallType);

    if (onStep) {
      onStep(edgeIndex, self.builtWalls[self.builtWalls.length - 1]);
    }

    edgeIndex++;
    self.animationTimer = setTimeout(buildNext, delay);
  }

  setTimeout(buildNext, delay);
  return this;
};

ProceduralGeneratorBehaviour.prototype.stopAnimation = function() {
  this.isGenerating = false;
  if (this.animationTimer) {
    clearTimeout(this.animationTimer);
    this.animationTimer = null;
  }
  return this;
};

ProceduralGeneratorBehaviour.prototype.generate = function(numRooms) {
  this.generateRoomGraph(numRooms);
  this.buildWalls();
  return this;
};

// ============================================================================
// CLEAR
// ============================================================================

ProceduralGeneratorBehaviour.prototype.clear = function() {
  this.stopAnimation();

  // Remove walls from editor and global arrays
  for (var i = 0; i < this.builtWalls.length; i++) {
    var wall = this.builtWalls[i];

    if (wall && wall.graph) {
      wall.graph.remove();
    }

    var wallIndex = WALLS.indexOf(wall);
    if (wallIndex > -1) {
      WALLS.splice(wallIndex, 1);
    }

    var curvedIndex = CURVED_WALLS.indexOf(wall);
    if (curvedIndex > -1) {
      CURVED_WALLS.splice(curvedIndex, 1);
    }
  }

  // Re-render
  editor.architect(WALLS);
  if (typeof renderAllCurvedWalls === 'function') {
    renderAllCurvedWalls();
  }

  this.rooms = [];
  this.builtWalls = [];
  this.builtPawns = [];

  save();
  return this;
};

// ============================================================================
// UTILITY
// ============================================================================

ProceduralGeneratorBehaviour.prototype._randomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

ProceduralGeneratorBehaviour.prototype._shuffle = function(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

var proceduralGenerator = null;
