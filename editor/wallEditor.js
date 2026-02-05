(function (global) {
  var editor = global.editor = global.editor || {};

  editor.wall = function (start, end, type, thick) {
    this.thick = thick;
    this.start = start;
    this.end = end;
    this.type = type;
    this.parent = null;
    this.child = null;
    this.angle = 0;
    this.equations = {};
    this.coords = [];
    this.backUp = false;
  };

  editor.getWallNode = function (coords, except = false) {
    var nodes = [];
    for (var k in WALLS) {
      if (!isObjectsEquals(WALLS[k], except)) {
        if (isObjectsEquals(WALLS[k].start, coords)) {
          nodes.push({ wall: WALLS[k], type: "start" });
        }
        if (isObjectsEquals(WALLS[k].end, coords)) {
          nodes.push({ wall: WALLS[k], type: "end" });
        }
      }
    }
    if (nodes.length == 0) return false;
    else return nodes;
  };

  editor.wallsComputing = function (WALLS, action = false) {
    // IF ACTION == MOVE -> equation2 exist !!!!!
    $('#boxwall').empty();
    $('#boxArea').empty();

    for (var vertice = 0; vertice < WALLS.length; vertice++) {
      var wall = WALLS[vertice];
      if (wall.parent != null) {
        if (!isObjectsEquals(wall.parent.start, wall.start) && !isObjectsEquals(wall.parent.end, wall.start)) {
          wall.parent = null;
        }
      }
      if (wall.child != null) {
        if (!isObjectsEquals(wall.child.start, wall.end) && !isObjectsEquals(wall.child.end, wall.end)) {
          wall.child = null;
        }
      }
    }

    for (var vertice = 0; vertice < WALLS.length; vertice++) {
      var wall = WALLS[vertice];
      if (wall.parent != null) {
        if (isObjectsEquals(wall.parent.start, wall.start)) {
          var previousWall = wall.parent;
          var previousWallStart = previousWall.end;
          var previousWallEnd = previousWall.start;
        }
        if (isObjectsEquals(wall.parent.end, wall.start)) {
          var previousWall = wall.parent;
          var previousWallStart = previousWall.start;
          var previousWallEnd = previousWall.end;
        }
      }
      else {
        var S = editor.getWallNode(wall.start, wall);
        // if (wallInhibation && isObjectsEquals(wall, wallInhibation)) S = false;
        for (var k in S) {
          var eqInter = editor.createEquationFromWall(S[k].wall);
          var angleInter = 90; // TO PASS TEST
          if (action == "move") {
            angleInter = qSVG.angleBetweenEquations(eqInter.A, equation2.A);
          }
          if (S[k].type == 'start' && S[k].wall.parent == null && angleInter > 20 && angleInter < 160) {
            wall.parent = S[k].wall;
            S[k].wall.parent = wall;
            var previousWall = wall.parent;
            var previousWallStart = previousWall.end;
            var previousWallEnd = previousWall.start;
          }
          if (S[k].type == 'end' && S[k].wall.child == null && angleInter > 20 && angleInter < 160) {
            wall.parent = S[k].wall;
            S[k].wall.child = wall;
            var previousWall = wall.parent;
            var previousWallStart = previousWall.start;
            var previousWallEnd = previousWall.end;
          }
        }
      }

      if (wall.child != null) {
        if (isObjectsEquals(wall.child.end, wall.end)) {
          var nextWall = wall.child;
          var nextWallStart = nextWall.end;
          var nextWallEnd = nextWall.start;
        }
        else {
          var nextWall = wall.child;
          var nextWallStart = nextWall.start;
          var nextWallEnd = nextWall.end;
        }
      }
      else {
        var E = editor.getWallNode(wall.end, wall);
        // if (wallInhibation && isObjectsEquals(wall, wallInhibation)) E = false;
        for (var k in E) {
          var eqInter = editor.createEquationFromWall(E[k].wall);
          var angleInter = 90; // TO PASS TEST
          if (action == "move") {
            angleInter = qSVG.angleBetweenEquations(eqInter.A, equation2.A);
          }
          if (E[k].type == 'end' && E[k].wall.child == null && angleInter > 20 && angleInter < 160) {
            wall.child = E[k].wall;
            E[k].wall.child = wall;
            var nextWall = wall.child;
            var nextWallStart = nextWall.end;
            var nextWallEnd = nextWall.start;
          }
          if (E[k].type == 'start' && E[k].wall.parent == null && angleInter > 20 && angleInter < 160) {
            wall.child = E[k].wall;
            E[k].wall.parent = wall;
            var nextWall = wall.child;
            var nextWallStart = nextWall.start;
            var nextWallEnd = nextWall.end;
          }
        }
      }

      var angleWall = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
      wall.angle = angleWall;
      var wallThickX = (wall.thick / 2) * Math.sin(angleWall);
      var wallThickY = (wall.thick / 2) * Math.cos(angleWall);
      var eqWallUp = qSVG.createEquation(wall.start.x + wallThickX, wall.start.y - wallThickY, wall.end.x + wallThickX, wall.end.y - wallThickY);
      var eqWallDw = qSVG.createEquation(wall.start.x - wallThickX, wall.start.y + wallThickY, wall.end.x - wallThickX, wall.end.y + wallThickY);
      var eqWallBase = qSVG.createEquation(wall.start.x, wall.start.y, wall.end.x, wall.end.y);
      wall.equations = { up: eqWallUp, down: eqWallDw, base: eqWallBase };
      var dWay;

      // WALL STARTED
      if (wall.parent == null) {
        var eqP = qSVG.perpendicularEquation(eqWallUp, wall.start.x, wall.start.y);
        var interUp = qSVG.intersectionOfEquations(eqWallUp, eqP, "object");
        var interDw = qSVG.intersectionOfEquations(eqWallDw, eqP, "object");
        wall.coords = [interUp, interDw];
        dWay = "M" + interUp.x + "," + interUp.y + " L" + interDw.x + "," + interDw.y + " ";
      }
      else {
        var eqP = qSVG.perpendicularEquation(eqWallUp, wall.start.x, wall.start.y);
        var previousWall = wall.parent;
        var previousWallStart = previousWall.start;
        var previousWallEnd = previousWall.end;
        var anglePreviousWall = Math.atan2(previousWallEnd.y - previousWallStart.y, previousWallEnd.x - previousWallStart.x);
        var previousWallThickX = (previousWall.thick / 2) * Math.sin(anglePreviousWall);
        var previousWallThickY = (previousWall.thick / 2) * Math.cos(anglePreviousWall);
        var eqPreviousWallUp = qSVG.createEquation(previousWallStart.x + previousWallThickX, previousWallStart.y - previousWallThickY, previousWallEnd.x + previousWallThickX, previousWallEnd.y - previousWallThickY);
        var eqPreviousWallDw = qSVG.createEquation(previousWallStart.x - previousWallThickX, previousWallStart.y + previousWallThickY, previousWallEnd.x - previousWallThickX, previousWallEnd.y + previousWallThickY);
        if (Math.abs(anglePreviousWall - angleWall) > 0.09) {
          var interUp = qSVG.intersectionOfEquations(eqWallUp, eqPreviousWallUp, "object");
          var interDw = qSVG.intersectionOfEquations(eqWallDw, eqPreviousWallDw, "object");

          if (eqWallUp.A == eqPreviousWallUp.A) {
            interUp = { x: wall.start.x + wallThickX, y: wall.start.y - wallThickY };
            interDw = { x: wall.start.x - wallThickX, y: wall.start.y + wallThickY };
          }

          var miter = qSVG.gap(interUp, { x: previousWallEnd.x, y: previousWallEnd.y });
          if (miter > 1000) {
            var interUp = qSVG.intersectionOfEquations(eqP, eqWallUp, "object");
            var interDw = qSVG.intersectionOfEquations(eqP, eqWallDw, "object");
          }
        }
        if (Math.abs(anglePreviousWall - angleWall) <= 0.09) {
          var interUp = qSVG.intersectionOfEquations(eqP, eqWallUp, "object");
          var interDw = qSVG.intersectionOfEquations(eqP, eqWallDw, "object");
        }
        wall.coords = [interUp, interDw];
        dWay = "M" + interUp.x + "," + interUp.y + " L" + interDw.x + "," + interDw.y + " ";
      }

      // WALL FINISHED
      if (wall.child == null) {
        var eqP = qSVG.perpendicularEquation(eqWallUp, wall.end.x, wall.end.y);
        var interUp = qSVG.intersectionOfEquations(eqWallUp, eqP, "object");
        var interDw = qSVG.intersectionOfEquations(eqWallDw, eqP, "object");
        wall.coords.push(interDw, interUp);
        dWay = dWay + "L" + interDw.x + "," + interDw.y + " L" + interUp.x + "," + interUp.y + " Z";
      }
      else {
        var eqP = qSVG.perpendicularEquation(eqWallUp, wall.end.x, wall.end.y);
        // var nextWall = wall.child;
        //   var nextWallStart = nextWall.start;
        //   var nextWallEnd = nextWall.end;
        var angleNextWall = Math.atan2(nextWallEnd.y - nextWallStart.y, nextWallEnd.x - nextWallStart.x);
        var nextWallThickX = (nextWall.thick / 2) * Math.sin(angleNextWall);
        var nextWallThickY = (nextWall.thick / 2) * Math.cos(angleNextWall);
        var eqNextWallUp = qSVG.createEquation(nextWallStart.x + nextWallThickX, nextWallStart.y - nextWallThickY, nextWallEnd.x + nextWallThickX, nextWallEnd.y - nextWallThickY);
        var eqNextWallDw = qSVG.createEquation(nextWallStart.x - nextWallThickX, nextWallStart.y + nextWallThickY, nextWallEnd.x - nextWallThickX, nextWallEnd.y + nextWallThickY);
        if (Math.abs(angleNextWall - angleWall) > 0.09) {
          var interUp = qSVG.intersectionOfEquations(eqWallUp, eqNextWallUp, "object");
          var interDw = qSVG.intersectionOfEquations(eqWallDw, eqNextWallDw, "object");

          if (eqWallUp.A == eqNextWallUp.A) {
            interUp = { x: wall.end.x + wallThickX, y: wall.end.y - wallThickY };
            interDw = { x: wall.end.x - wallThickX, y: wall.end.y + wallThickY };
          }

          var miter = qSVG.gap(interUp, { x: nextWallStart.x, y: nextWallStart.y });
          if (miter > 1000) {
            var interUp = qSVG.intersectionOfEquations(eqWallUp, eqP, "object");
            var interDw = qSVG.intersectionOfEquations(eqWallDw, eqP, "object");
          }
        }
        if (Math.abs(angleNextWall - angleWall) <= 0.09) {
          var interUp = qSVG.intersectionOfEquations(eqWallUp, eqP, "object");
          var interDw = qSVG.intersectionOfEquations(eqWallDw, eqP, "object");
        }

        wall.coords.push(interDw, interUp);
        dWay = dWay + "L" + interDw.x + "," + interDw.y + " L" + interUp.x + "," + interUp.y + " Z";
      }

      wall.graph = editor.makeWall(dWay);
      $('#boxwall').append(wall.graph);
    }

    // Re-render curved walls that were cleared when #boxwall was emptied
    if (typeof renderAllCurvedWalls === 'function') {
      renderAllCurvedWalls();
    }
  };

  editor.makeWall = function (way) {
    var wallScreen = qSVG.create('none', 'path', {
      d: way,
      stroke: "none",
      fill: colorWall,
      "stroke-width": 1,
      "stroke-linecap": "butt",
      "stroke-linejoin": "miter",
      "stroke-miterlimit": 4,
      "fill-rule": "nonzero"
    });
    return wallScreen;
  };

  editor.invisibleWall = function (wallToInvisble = false) {
    if (!wallToInvisble) wallToInvisble = binder.wall;
    var objWall = editor.objFromWall(wallBind);
    if (objWall.length == 0) {
      wallToInvisble.type = "separate";
      wallToInvisble.backUp = wallToInvisble.thick;
      wallToInvisble.thick = 0.07;
      editor.architect(WALLS);
      mode = "select_mode";
      $('#panel').show(200);
      save();
      return true;
    }
    else {
      $('#boxinfo').html('Les murs contenant des portes ou des fenêtres ne peuvent être une séparation !');
      return false;
    }
  };

  editor.visibleWall = function (wallToInvisble = false) {
    if (!wallToInvisble) wallToInvisble = binder.wall;
    wallToInvisble.type = "normal";
    wallToInvisble.thick = wallToInvisble.backUp;
    wallToInvisble.backUp = false;
    editor.architect(WALLS);
    mode = "select_mode";
    $('#panel').show(200);
    save();
    return true;
  };

  editor.architect = function (WALLS) {
    editor.wallsComputing(WALLS);

    // Build combined segment list with linearized curved walls for room detection
    var combined = WALLS.slice();
    if (typeof CURVED_WALLS !== 'undefined') {
      for (var c = 0; c < CURVED_WALLS.length; c++) {
        var w = CURVED_WALLS[c];
        var pts = [];
        var segmentsArc = 48;
        var segmentsBezier = 24;
        function snap(pt) {
          return { x: Math.round(pt.x * 100) / 100, y: Math.round(pt.y * 100) / 100 };
        }
        if (w.wallType === 'arc') {
          // normalize to smaller arc for polygonization
          var sa = w.startAngle;
          var ea = w.endAngle;
          var delta = ea - sa;
          while (delta > Math.PI) { ea -= Math.PI * 2; delta = ea - sa; }
          while (delta < -Math.PI) { ea += Math.PI * 2; delta = ea - sa; }
          pts = curvedWalls.arcPoints(w.center, w.radius, sa, ea, segmentsArc);
          if (pts.length) {
            pts[0] = { x: w.start.x, y: w.start.y };
            pts[pts.length - 1] = { x: w.end.x, y: w.end.y };
          }
        } else if (w.wallType === 'bezier') {
          pts = curvedWalls.offsetBezierPoints(w.start, w.cp1, w.cp2, w.end, 0, segmentsBezier);
          for (var bp = 0; bp < pts.length; bp++) {
            pts[bp] = snap(pts[bp]);
          }
        }
        for (var p = 0; p < pts.length - 1; p++) {
          combined.push(new editor.wall(pts[p], pts[p + 1], "normal", w.thick));
        }
      }
    }

    // Build snapped copy for polygonize to avoid floating-point gaps
    function snapPt(pt) {
      return {
        x: Math.round(pt.x * 100) / 100,
        y: Math.round(pt.y * 100) / 100
      };
    }
    var snappedCombined = [];
    for (var cbi = 0; cbi < combined.length; cbi++) {
      var wtmp = combined[cbi];
      var s = snapPt(wtmp.start);
      var e = snapPt(wtmp.end);
      snappedCombined.push(new editor.wall(s, e, "normal", wtmp.thick));
    }

    // Temporarily swap WALLS for polygonize to use snapped list (thickness lookups rely on WALLS)
    var realWALLS = WALLS;
    WALLS = snappedCombined;
    Rooms = qSVG.polygonize(WALLS);
    WALLS = realWALLS;

    // Keep all closed polygons (including inner courts/holes) as rooms
    var polys = Rooms.polygons || [];
    // Ensure inside indexes don't break drawing; we fill everything
    for (var i = 0; i < polys.length; i++) {
      polys[i].inside = [];
      // Recompute area without subtracting inner holes
      polys[i].area = qSVG.area(polys[i].coords || []);
    }
    ROOM = polys;
    $('#boxRoom').empty();
    $('#boxSurface').empty();
    var RoomsObj = { polygons: polys };
    editor.roomMaker(RoomsObj);
    if (typeof renderAllCurvedWalls === 'function') {
      renderAllCurvedWalls();
    }
    return true;
  };

  editor.splitWall = function (wallToSplit = false) {
    if (!wallToSplit) wallToSplit = binder.wall;
    var eqWall = editor.createEquationFromWall(wallToSplit);
    var wallToSplitLength = qSVG.gap(wallToSplit.start, wallToSplit.end);
    var newWalls = [];
    for (var k in WALLS) {
      var eq = editor.createEquationFromWall(WALLS[k]);
      var inter = qSVG.intersectionOfEquations(eqWall, eq, 'obj');
      if (qSVG.btwn(inter.x, binder.wall.start.x, binder.wall.end.x, 'round') && qSVG.btwn(inter.y, binder.wall.start.y, binder.wall.end.y, 'round') && qSVG.btwn(inter.x, WALLS[k].start.x, WALLS[k].end.x, 'round') && qSVG.btwn(inter.y, WALLS[k].start.y, WALLS[k].end.y, 'round')) {
        var distance = qSVG.gap(wallToSplit.start, inter);
        if (distance > 5 && distance < wallToSplitLength) newWalls.push({ distance: distance, coords: inter });
      }
    }
    newWalls.sort(function (a, b) {
      return (a.distance - b.distance).toFixed(2);
    });
    var initCoords = wallToSplit.start;
    var initThick = wallToSplit.thick;
    // CLEAR THE WALL BEFORE PIECES RE-BUILDER
    for (var k in WALLS) {
      if (isObjectsEquals(WALLS[k].child, wallToSplit)) WALLS[k].child = null;
      if (isObjectsEquals(WALLS[k].parent, wallToSplit)) { WALLS[k].parent = null; }
    }
    WALLS.splice(WALLS.indexOf(wallToSplit), 1);
    var wall;
    for (var k in newWalls) {
      wall = new editor.wall(initCoords, newWalls[k].coords, "normal", initThick);
      WALLS.push(wall);
      wall.child = WALLS[WALLS.length];
      initCoords = newWalls[k].coords;
    }
    // LAST WALL ->
    wall = new editor.wall(initCoords, wallToSplit.end, "normal", initThick);
    WALLS.push(wall);
    editor.architect(WALLS);
    mode = "select_mode";
    $('#panel').show(200);
    save();
    return true;
  };

  editor.nearWallNode = function (snap, range = Infinity, except = ['']) {
    var best;
    var bestWall;
    var scan;
    var i = 0;
    var scanDistance;
    var bestDistance = Infinity;
    for (var k = 0; k < WALLS.length; k++) {
      if (except.indexOf(WALLS[k]) == -1) {
        scanStart = WALLS[k].start;
        scanEnd = WALLS[k].end;
        scanDistance = qSVG.measure(scanStart, snap);
        if (scanDistance < bestDistance) {
          best = scanStart;
          bestDistance = scanDistance;
          bestWall = k;
        }
        scanDistance = qSVG.measure(scanEnd, snap);
        if (scanDistance < bestDistance) {
          best = scanEnd;
          bestDistance = scanDistance;
          bestWall = k;
        }
      }
    }
    if (bestDistance <= range) {
      return ({
        x: best.x,
        y: best.y,
        bestWall: bestWall
      });
    } else {
      return false;
    }
  };

  editor.rayCastingWall = function (snap) {
    var wallList = [];
    for (var i = 0; i < WALLS.length; i++) {
      var polygon = [];
      for (var pp = 0; pp < 4; pp++) {
        polygon.push({ x: WALLS[i].coords[pp].x, y: WALLS[i].coords[pp].y }); // FOR Z
      }
      if (qSVG.rayCasting(snap, polygon)) {
        wallList.push(WALLS[i]); // Return EDGES Index
      }
    }
    if (wallList.length == 0) return false;
    else {
      if (wallList.length == 1) return wallList[0];
      else return wallList;
    }
  };

  editor.stickOnWall = function (snap) {
    if (WALLS.length == 0) return false;
    var wallDistance = Infinity;
    var wallSelected = {};
    var result;
    var allWalls = WALLS.concat(CURVED_WALLS || []);
    if (allWalls.length == 0) return false;
    for (var e = 0; e < allWalls.length; e++) {
      var w = allWalls[e];
      // For curved walls, approximate with centerline segments from coords pairs
      if (w.wallType === 'arc' || w.wallType === 'bezier') {
        for (var p = 0; p < w.coords.length; p++) {
          var p1 = w.coords[p];
          var p2 = w.coords[(p + 1) % w.coords.length];
          var eqc = qSVG.createEquation(p1.x, p1.y, p2.x, p2.y);
          var res = qSVG.nearPointOnEquation(eqc, snap);
          if (res.distance < wallDistance && qSVG.btwn(res.x, p1.x, p2.x) && qSVG.btwn(res.y, p1.y, p2.y)) {
            wallDistance = res.distance;
            wallSelected = { wall: w, x: res.x, y: res.y, distance: res.distance };
          }
        }
      } else {
        var eq1 = qSVG.createEquation(w.coords[0].x, w.coords[0].y, w.coords[3].x, w.coords[3].y);
        result1 = qSVG.nearPointOnEquation(eq1, snap);
        var eq2 = qSVG.createEquation(w.coords[1].x, w.coords[1].y, w.coords[2].x, w.coords[2].y);
        result2 = qSVG.nearPointOnEquation(eq2, snap);
        if (result1.distance < wallDistance && qSVG.btwn(result1.x, w.coords[0].x, w.coords[3].x) && qSVG.btwn(result1.y, w.coords[0].y, w.coords[3].y)) {
          wallDistance = result1.distance;
          wallSelected = { wall: w, x: result1.x, y: result1.y, distance: result1.distance };
        }
        if (result2.distance < wallDistance && qSVG.btwn(result2.x, w.coords[1].x, w.coords[2].x) && qSVG.btwn(result2.y, w.coords[1].y, w.coords[2].y)) {
          wallDistance = result2.distance;
          wallSelected = { wall: w, x: result2.x, y: result2.y, distance: result2.distance };
        }
      }
    }
    var vv = editor.nearVertice(snap);
    if (vv.distance < wallDistance) {
      var eq1 = qSVG.createEquation(vv.number.coords[0].x, vv.number.coords[0].y, vv.number.coords[3].x, vv.number.coords[3].y);
      result1 = qSVG.nearPointOnEquation(eq1, vv);
      var eq2 = qSVG.createEquation(vv.number.coords[1].x, vv.number.coords[1].y, vv.number.coords[2].x, vv.number.coords[2].y);
      result2 = qSVG.nearPointOnEquation(eq2, vv);
      if (result1.distance < wallDistance && qSVG.btwn(result1.x, vv.number.coords[0].x, vv.number.coords[3].x) && qSVG.btwn(result1.y, vv.number.coords[0].y, vv.number.coords[3].y)) {
        wallDistance = result1.distance;
        wallSelected = { wall: vv.number, x: result1.x, y: result1.y, distance: result1.distance };
      }
      if (result2.distance < wallDistance && qSVG.btwn(result2.x, vv.number.coords[1].x, vv.number.coords[2].x) && qSVG.btwn(result2.y, vv.number.coords[1].y, vv.number.coords[2].y)) {
        wallDistance = result2.distance;
        wallSelected = { wall: vv.number, x: result2.x, y: result2.y, distance: result2.distance };
      }
    }
    return wallSelected;
  };

  editor.createEquationFromWall = function (wall) {
    return qSVG.createEquation(wall.start.x, wall.start.y, wall.end.x, wall.end.y);
  };

  editor.rayCastingWalls = function (snap) {
    var wallList = [];
    var allWalls = WALLS.concat(CURVED_WALLS || []);
    for (var i = 0; i < allWalls.length; i++) {
      var w = allWalls[i];
      if (!w.coords || w.coords.length === 0) continue;
      var polygon = [];
      for (var pp = 0; pp < w.coords.length; pp++) {
        polygon.push({ x: w.coords[pp].x, y: w.coords[pp].y });
      }
      if (qSVG.rayCasting(snap, polygon)) {
        wallList.push(w);
      }
    }
    if (wallList.length == 0) return false;
    else {
      if (wallList.length == 1) return wallList[0];
      else return wallList;
    }
  };

  editor.nearVertice = function (snap, range = 10000) {
    var bestDistance = Infinity;
    var bestVertice;
    var allWalls = WALLS.concat(CURVED_WALLS || []);
    for (var i = 0; i < allWalls.length; i++) {
      var distance1 = qSVG.gap(snap, { x: allWalls[i].start.x, y: allWalls[i].start.y });
      var distance2 = qSVG.gap(snap, { x: allWalls[i].end.x, y: allWalls[i].end.y });
      if (distance1 < distance2 && distance1 < bestDistance) {
        bestDistance = distance1;
        bestVertice = { number: allWalls[i], x: allWalls[i].start.x, y: allWalls[i].start.y, distance: Math.sqrt(bestDistance) };
      }
      if (distance2 < distance1 && distance2 < bestDistance) {
        bestDistance = distance2;
        bestVertice = { number: allWalls[i], x: allWalls[i].end.x, y: allWalls[i].end.y, distance: Math.sqrt(bestDistance) };
      }
    }
    if (bestDistance < range * range) return bestVertice;
    else return false;
  };

  editor.nearWall = function (snap, range = Infinity) {
    var wallDistance = Infinity;
    var wallSelected = {};
    var result;
    var allWalls = WALLS.concat(CURVED_WALLS || []);
    if (allWalls.length == 0) return false;
    for (var e = 0; e < allWalls.length; e++) {
      var w = allWalls[e];
      if (w.wallType === 'arc' || w.wallType === 'bezier') {
        // sample along coords segments
        for (var p = 0; p < w.coords.length; p++) {
          var p1 = w.coords[p];
          var p2 = w.coords[(p + 1) % w.coords.length];
          var eqc = qSVG.createEquation(p1.x, p1.y, p2.x, p2.y);
          var res = qSVG.nearPointOnEquation(eqc, snap);
          if (res.distance < wallDistance && qSVG.btwn(res.x, p1.x, p2.x) && qSVG.btwn(res.y, p1.y, p2.y)) {
            wallDistance = res.distance;
            wallSelected = { wall: w, x: res.x, y: res.y, distance: res.distance };
          }
        }
      } else {
        var eq = qSVG.createEquation(w.start.x, w.start.y, w.end.x, w.end.y);
        result = qSVG.nearPointOnEquation(eq, snap);
        if (result.distance < wallDistance && qSVG.btwn(result.x, w.start.x, w.end.x) && qSVG.btwn(result.y, w.start.y, w.end.y)) {
          wallDistance = result.distance;
          wallSelected = { wall: w, x: result.x, y: result.y, distance: result.distance };
        }
      }
    }
    var vv = editor.nearVertice(snap);
    if (vv && vv.distance < wallDistance) {
      wallDistance = vv.distance;
      wallSelected = { wall: vv.number, x: vv.x, y: vv.y, distance: vv.distance };
    }
    if (wallDistance <= range) return wallSelected;
    else return false;
  };

})(typeof window !== "undefined" ? window : this);