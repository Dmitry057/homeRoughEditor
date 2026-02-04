// ============================================================================
// CURVED WALLS UI - Mouse Interaction and UI Handlers
// ============================================================================
// Handles mouse events for creating Arc and Bezier walls
// ============================================================================

var curvedWallsUI = {

  // State variables for arc creation
  arcState: {
    step: 0,           // 0: waiting for center, 1: waiting for start, 2: waiting for end
    center: null,
    startPoint: null,
    radius: 0,
    startAngle: 0,
    clockwise: true,
    previewElement: null
  },

  // State variables for bezier creation
  bezierState: {
    step: 0,           // 0: waiting for start, 1: dragging start direction, 2: waiting for end, 3: dragging end direction
    startPoint: null,
    endPoint: null,
    startAngle: 0,
    endAngle: 0,
    previewElement: null,
    directionLine: null
  },

  // Default wall thickness for curved walls
  curvedWallThickness: 20,

  // ============================================================================
  // ARC MODE HANDLERS
  // ============================================================================

  /**
   * Initialize arc mode
   */
  initArcMode: function() {
    this.resetArcState();
    $('#boxinfo').html('Arc Wall: Click to set center point');
  },

  /**
   * Reset arc state
   */
  resetArcState: function() {
    this.arcState = {
      step: 0,
      center: null,
      startPoint: null,
      radius: 0,
      startAngle: 0,
      clockwise: true,
      previewElement: null
    };
    this.clearPreview();
  },

  /**
   * Handle mouse move in arc mode
   */
  arcMouseMove: function(snap) {
    var state = this.arcState;

    if (state.step === 0) {
      // Show crosshair at potential center
      this.updateCrosshair(snap);
    }
    else if (state.step === 1) {
      // Drawing radius line from center
      state.radius = qSVG.measure(state.center, snap);
      state.startAngle = curvedWalls.angleFromCenter(state.center, snap);
      state.startPoint = snap;

      // Preview: circle showing radius
      this.updateArcRadiusPreview(state.center, state.radius);
      $('#boxinfo').html('Arc Wall: Click to set start point (Radius: ' + (state.radius / meter).toFixed(2) + 'm)');
    }
    else if (state.step === 2) {
      // Drawing arc from start to current position
      var currentAngle = curvedWalls.angleFromCenter(state.center, snap);

      // Determine clockwise/counterclockwise based on mouse movement
      var angleDiff = currentAngle - state.startAngle;
      if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      state.clockwise = angleDiff > 0;

      // Calculate end point on arc
      var endPoint = curvedWalls.pointOnArc(state.center, state.radius, currentAngle);

      // Preview arc
      this.updateArcPreview(state.center, state.radius, state.startAngle, currentAngle, state.clockwise);

      var arcLength = Math.abs(angleDiff) * state.radius;
      $('#boxinfo').html('Arc Wall: Click to finish (Length: ' + (arcLength / meter).toFixed(2) + 'm)');
    }
  },

  /**
   * Handle mouse down in arc mode
   */
  arcMouseDown: function(snap) {
    var state = this.arcState;

    if (state.step === 0) {
      // Set center
      state.center = { x: snap.x, y: snap.y };
      state.step = 1;
      $('#boxinfo').html('Arc Wall: Drag to set radius and start point');
    }
  },

  /**
   * Handle mouse up in arc mode
   */
  arcMouseUp: function(snap) {
    var state = this.arcState;

    if (state.step === 1) {
      // Finalize start point
      if (state.radius > 10) {
        state.startPoint = {
          x: state.center.x + state.radius * Math.cos(state.startAngle),
          y: state.center.y + state.radius * Math.sin(state.startAngle)
        };
        state.step = 2;
        $('#boxinfo').html('Arc Wall: Click to set end point');
      } else {
        // Radius too small, reset
        this.resetArcState();
        $('#boxinfo').html('Arc Wall: Radius too small. Click to set center point');
      }
    }
    else if (state.step === 2) {
      // Finalize arc wall
      var currentAngle = curvedWalls.angleFromCenter(state.center, snap);
      var endPoint = curvedWalls.pointOnArc(state.center, state.radius, currentAngle);

      // Create arc wall
      var arcWall = new curvedWalls.arcWall(
        state.startPoint,
        endPoint,
        state.radius,
        state.clockwise,
        'normal',
        this.curvedWallThickness
      );

      CURVED_WALLS.push(arcWall);
      curvedWalls.computeArcWall(arcWall);

      this.clearPreview();
      this.resetArcState();
      save();
      $('#boxinfo').html('Arc Wall added! Click to set new center point');
    }
  },

  // ============================================================================
  // BEZIER MODE HANDLERS
  // ============================================================================

  /**
   * Initialize bezier mode
   */
  initBezierMode: function() {
    this.resetBezierState();
    $('#boxinfo').html('Bezier Wall: Click and drag to set start point and direction');
  },

  /**
   * Reset bezier state
   */
  resetBezierState: function() {
    this.bezierState = {
      step: 0,
      startPoint: null,
      endPoint: null,
      startAngle: 0,
      endAngle: 0,
      previewElement: null,
      directionLine: null
    };
    this.clearPreview();
  },

  /**
   * Handle mouse move in bezier mode
   */
  bezierMouseMove: function(snap) {
    var state = this.bezierState;

    if (state.step === 0) {
      // Show crosshair at potential start
      this.updateCrosshair(snap);
    }
    else if (state.step === 1) {
      // Dragging to set start direction
      state.startAngle = Math.atan2(snap.y - state.startPoint.y, snap.x - state.startPoint.x);
      this.updateDirectionLine(state.startPoint, snap, '#4CAF50');
      $('#boxinfo').html('Bezier Wall: Release to set start direction');
    }
    else if (state.step === 2) {
      // Moving to end point
      this.updateCrosshair(snap);
      // Preview bezier with current position as end
      var cps = curvedWalls.controlPointsFromDirections(
        state.startPoint, snap,
        state.startAngle, state.startAngle + Math.PI, // Default end direction opposite to movement
        0.4
      );
      this.updateBezierPreview(state.startPoint, cps.cp1, cps.cp2, snap);
      $('#boxinfo').html('Bezier Wall: Click and drag to set end point and direction');
    }
    else if (state.step === 3) {
      // Dragging to set end direction
      state.endAngle = Math.atan2(snap.y - state.endPoint.y, snap.x - state.endPoint.x);
      // Reverse the angle because we want the incoming direction
      state.endAngle = state.endAngle + Math.PI;

      this.updateDirectionLine(state.endPoint, snap, '#FF5722');

      // Update bezier preview
      var cps = curvedWalls.controlPointsFromDirections(
        state.startPoint, state.endPoint,
        state.startAngle, state.endAngle,
        0.4
      );
      this.updateBezierPreview(state.startPoint, cps.cp1, cps.cp2, state.endPoint);
      $('#boxinfo').html('Bezier Wall: Release to finish');
    }
  },

  /**
   * Handle mouse down in bezier mode
   */
  bezierMouseDown: function(snap) {
    var state = this.bezierState;

    if (state.step === 0) {
      // Set start point
      state.startPoint = { x: snap.x, y: snap.y };
      state.step = 1;
    }
    else if (state.step === 2) {
      // Set end point
      state.endPoint = { x: snap.x, y: snap.y };
      state.step = 3;
    }
  },

  /**
   * Handle mouse up in bezier mode
   */
  bezierMouseUp: function(snap) {
    var state = this.bezierState;

    if (state.step === 1) {
      // Finalize start direction
      var dist = qSVG.measure(state.startPoint, snap);
      if (dist > 10) {
        state.startAngle = Math.atan2(snap.y - state.startPoint.y, snap.x - state.startPoint.x);
      } else {
        // Default direction: right
        state.startAngle = 0;
      }
      this.clearDirectionLine();
      state.step = 2;
      $('#boxinfo').html('Bezier Wall: Click and drag to set end point and direction');
    }
    else if (state.step === 3) {
      // Finalize bezier wall
      var dist = qSVG.measure(state.endPoint, snap);
      if (dist > 10) {
        state.endAngle = Math.atan2(snap.y - state.endPoint.y, snap.x - state.endPoint.x) + Math.PI;
      } else {
        // Default: continue in same direction
        state.endAngle = state.startAngle;
      }

      // Create bezier wall
      var bezierWall = new curvedWalls.bezierWall(
        state.startPoint,
        state.endPoint,
        state.startAngle,
        state.endAngle,
        0.4,
        'normal',
        this.curvedWallThickness
      );

      CURVED_WALLS.push(bezierWall);
      curvedWalls.computeBezierWall(bezierWall);

      this.clearPreview();
      this.clearDirectionLine();
      this.resetBezierState();
      save();
      $('#boxinfo').html('Bezier Wall added! Click and drag to set new start point');
    }
  },

  // ============================================================================
  // PREVIEW HELPERS
  // ============================================================================

  /**
   * Update crosshair cursor indicator
   */
  updateCrosshair: function(pos) {
    if (!this.crosshairElement) {
      this.crosshairElement = qSVG.create('boxbind', 'g', {});
      var hLine = qSVG.create('none', 'line', {
        x1: -15, y1: 0, x2: 15, y2: 0,
        stroke: '#e2b653', 'stroke-width': 0.5
      });
      var vLine = qSVG.create('none', 'line', {
        x1: 0, y1: -15, x2: 0, y2: 15,
        stroke: '#e2b653', 'stroke-width': 0.5
      });
      this.crosshairElement.append(hLine);
      this.crosshairElement.append(vLine);
    }
    this.crosshairElement.attr('transform', 'translate(' + pos.x + ',' + pos.y + ')');
  },

  /**
   * Update arc radius preview (circle)
   */
  updateArcRadiusPreview: function(center, radius) {
    this.clearPreview();

    // Draw full circle as guide
    var circlePath = qSVG.circlePath(center.x, center.y, radius);
    this.previewElement = qSVG.create('boxbind', 'path', {
      d: circlePath,
      stroke: '#4CAF50',
      'stroke-width': 1,
      'stroke-dasharray': '5,5',
      fill: 'none',
      opacity: 0.5
    });

    // Draw radius line
    this.radiusLine = qSVG.create('boxbind', 'line', {
      x1: center.x, y1: center.y,
      x2: center.x + radius, y2: center.y,
      stroke: '#4CAF50',
      'stroke-width': 1
    });
  },

  /**
   * Update arc preview
   */
  updateArcPreview: function(center, radius, startAngle, endAngle, clockwise) {
    this.clearPreview();

    var startPoint = curvedWalls.pointOnArc(center, radius, startAngle);
    var endPoint = curvedWalls.pointOnArc(center, radius, endAngle);

    var angleDiff = Math.abs(endAngle - startAngle);
    var largeArc = angleDiff > Math.PI ? 1 : 0;
    var sweep = clockwise ? 1 : 0;

    var path = "M" + startPoint.x + "," + startPoint.y;
    path += " A" + radius + "," + radius + " 0 " + largeArc + "," + sweep + " " + endPoint.x + "," + endPoint.y;

    // Arc centerline preview
    this.previewElement = qSVG.create('boxbind', 'path', {
      d: path,
      stroke: '#4CAF50',
      'stroke-width': this.curvedWallThickness,
      'stroke-opacity': 0.4,
      fill: 'none',
      'stroke-linecap': 'butt'
    });

    // Thin line on top
    this.previewLine = qSVG.create('boxbind', 'path', {
      d: path,
      stroke: '#4CAF50',
      'stroke-width': 2,
      fill: 'none'
    });

    // Center point marker
    this.centerMarker = qSVG.create('boxbind', 'circle', {
      cx: center.x, cy: center.y, r: 4,
      fill: '#4CAF50', stroke: 'white', 'stroke-width': 1
    });
  },

  /**
   * Update bezier preview
   */
  updateBezierPreview: function(p0, p1, p2, p3) {
    this.clearPreview();

    var path = curvedWalls.svgBezierPath(p0, p1, p2, p3);

    // Wall thickness preview
    this.previewElement = qSVG.create('boxbind', 'path', {
      d: path,
      stroke: '#2196F3',
      'stroke-width': this.curvedWallThickness,
      'stroke-opacity': 0.4,
      fill: 'none',
      'stroke-linecap': 'butt'
    });

    // Centerline
    this.previewLine = qSVG.create('boxbind', 'path', {
      d: path,
      stroke: '#2196F3',
      'stroke-width': 2,
      fill: 'none'
    });

    // Control point handles
    this.cp1Handle = qSVG.create('boxbind', 'line', {
      x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y,
      stroke: '#4CAF50', 'stroke-width': 1, 'stroke-dasharray': '3,3'
    });
    this.cp2Handle = qSVG.create('boxbind', 'line', {
      x1: p3.x, y1: p3.y, x2: p2.x, y2: p2.y,
      stroke: '#FF5722', 'stroke-width': 1, 'stroke-dasharray': '3,3'
    });

    // Control points
    this.cp1Marker = qSVG.create('boxbind', 'circle', {
      cx: p1.x, cy: p1.y, r: 4,
      fill: '#4CAF50', stroke: 'white', 'stroke-width': 1
    });
    this.cp2Marker = qSVG.create('boxbind', 'circle', {
      cx: p2.x, cy: p2.y, r: 4,
      fill: '#FF5722', stroke: 'white', 'stroke-width': 1
    });
  },

  /**
   * Update direction line for bezier
   */
  updateDirectionLine: function(from, to, color) {
    this.clearDirectionLine();
    this.directionLineElement = qSVG.create('boxbind', 'line', {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      stroke: color,
      'stroke-width': 2,
      'stroke-dasharray': '5,5'
    });

    // Arrow head
    var angle = Math.atan2(to.y - from.y, to.x - from.x);
    var arrowSize = 10;
    var ax1 = to.x - arrowSize * Math.cos(angle - 0.4);
    var ay1 = to.y - arrowSize * Math.sin(angle - 0.4);
    var ax2 = to.x - arrowSize * Math.cos(angle + 0.4);
    var ay2 = to.y - arrowSize * Math.sin(angle + 0.4);

    this.arrowHead = qSVG.create('boxbind', 'path', {
      d: 'M' + to.x + ',' + to.y + ' L' + ax1 + ',' + ay1 + ' L' + ax2 + ',' + ay2 + ' Z',
      fill: color
    });
  },

  /**
   * Clear direction line
   */
  clearDirectionLine: function() {
    if (this.directionLineElement) {
      this.directionLineElement.remove();
      this.directionLineElement = null;
    }
    if (this.arrowHead) {
      this.arrowHead.remove();
      this.arrowHead = null;
    }
  },

  /**
   * Clear all preview elements
   */
  clearPreview: function() {
    var elements = [
      'previewElement', 'previewLine', 'radiusLine',
      'centerMarker', 'cp1Handle', 'cp2Handle',
      'cp1Marker', 'cp2Marker', 'crosshairElement'
    ];

    for (var i = 0; i < elements.length; i++) {
      if (this[elements[i]]) {
        this[elements[i]].remove();
        this[elements[i]] = null;
      }
    }
  },

  // ============================================================================
  // MODE CLEANUP
  // ============================================================================

  /**
   * Exit curved wall modes
   */
  exitCurvedMode: function() {
    this.clearPreview();
    this.clearDirectionLine();
    this.resetArcState();
    this.resetBezierState();
  }
};

// ============================================================================
// INTEGRATION WITH MAIN ENGINE
// ============================================================================

/**
 * Extend the main mouse event handlers
 * Call these from the main engine.js event handlers
 */

function handleCurvedWallMouseMove(event) {
  if (mode === 'arc_mode') {
    var snap = calcul_snap(event, grid_snap);
    curvedWallsUI.arcMouseMove(snap);
    cursor('crosshair');
  }
  else if (mode === 'bezier_mode') {
    var snap = calcul_snap(event, grid_snap);
    curvedWallsUI.bezierMouseMove(snap);
    cursor('crosshair');
  }
}

function handleCurvedWallMouseDown(event) {
  if (mode === 'arc_mode') {
    var snap = calcul_snap(event, grid_snap);
    curvedWallsUI.arcMouseDown(snap);
  }
  else if (mode === 'bezier_mode') {
    var snap = calcul_snap(event, grid_snap);
    curvedWallsUI.bezierMouseDown(snap);
  }
}

function handleCurvedWallMouseUp(event) {
  if (mode === 'arc_mode') {
    var snap = calcul_snap(event, grid_snap);
    curvedWallsUI.arcMouseUp(snap);
  }
  else if (mode === 'bezier_mode') {
    var snap = calcul_snap(event, grid_snap);
    curvedWallsUI.bezierMouseUp(snap);
  }
}

// ============================================================================
// UI BUTTON HANDLERS - Add these to func.js or call from index.html
// ============================================================================

function initCurvedWallButtons() {
  // Arc Wall button
  $('#arc_wall_mode').click(function() {
    $('#lin').css('cursor', 'crosshair');
    fonc_button('arc_mode');
    curvedWallsUI.initArcMode();
  });

  // Bezier Wall button
  $('#bezier_wall_mode').click(function() {
    $('#lin').css('cursor', 'crosshair');
    fonc_button('bezier_mode');
    curvedWallsUI.initBezierMode();
  });

  // Arc wall thickness slider
  $('#arcWallThickness').on('input', function() {
    curvedWallsUI.curvedWallThickness = parseInt(this.value);
    $('#arcWallThicknessVal').text(this.value);
  });
}

// ============================================================================
// SAVE/LOAD INTEGRATION
// ============================================================================

/**
 * Serialize curved walls for saving
 */
function serializeCurvedWalls() {
  var data = [];
  for (var i = 0; i < CURVED_WALLS.length; i++) {
    var wall = CURVED_WALLS[i];
    var wallData = {
      wallType: wall.wallType,
      start: wall.start,
      end: wall.end,
      type: wall.type,
      thick: wall.thick
    };

    if (wall.wallType === 'arc') {
      wallData.radius = wall.radius;
      wallData.clockwise = wall.clockwise;
      wallData.center = wall.center;
      wallData.startAngle = wall.startAngle;
      wallData.endAngle = wall.endAngle;
    }
    else if (wall.wallType === 'bezier') {
      wallData.startAngle = wall.startAngle;
      wallData.endAngle = wall.endAngle;
      wallData.tension = wall.tension;
      wallData.cp1 = wall.cp1;
      wallData.cp2 = wall.cp2;
    }

    data.push(wallData);
  }
  return data;
}

/**
 * Deserialize and recreate curved walls from saved data
 */
function deserializeCurvedWalls(data) {
  CURVED_WALLS = [];

  if (!data || !Array.isArray(data)) return;

  for (var i = 0; i < data.length; i++) {
    var wallData = data[i];
    var wall;

    if (wallData.wallType === 'arc') {
      wall = new curvedWalls.arcWall(
        wallData.start,
        wallData.end,
        wallData.radius,
        wallData.clockwise,
        wallData.type,
        wallData.thick
      );
      // Restore saved center and angles if available
      if (wallData.center) wall.center = wallData.center;
      if (wallData.startAngle !== undefined) wall.startAngle = wallData.startAngle;
      if (wallData.endAngle !== undefined) wall.endAngle = wallData.endAngle;
    }
    else if (wallData.wallType === 'bezier') {
      wall = new curvedWalls.bezierWall(
        wallData.start,
        wallData.end,
        wallData.startAngle,
        wallData.endAngle,
        wallData.tension,
        wallData.type,
        wallData.thick
      );
      // Restore control points if available
      if (wallData.cp1) wall.cp1 = wallData.cp1;
      if (wallData.cp2) wall.cp2 = wallData.cp2;
    }

    if (wall) {
      CURVED_WALLS.push(wall);
    }
  }

  // Render all curved walls
  renderAllCurvedWalls();
}

/**
 * Render all curved walls
 */
function renderAllCurvedWalls() {
  // Remove existing curved wall graphics
  for (var i = 0; i < CURVED_WALLS.length; i++) {
    if (CURVED_WALLS[i].graph) {
      CURVED_WALLS[i].graph.remove();
    }
  }

  // Re-render
  for (var i = 0; i < CURVED_WALLS.length; i++) {
    var wall = CURVED_WALLS[i];
    if (wall.wallType === 'arc') {
      curvedWalls.computeArcWall(wall);
    } else if (wall.wallType === 'bezier') {
      curvedWalls.computeBezierWall(wall);
    }
  }
}

// Initialize buttons when document is ready
$(document).ready(function() {
  initCurvedWallButtons();
});
