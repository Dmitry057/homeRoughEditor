(function (global) {
  var editor = global.editor = global.editor || {};

  editor.roomMaker = function (Rooms) {
    globalArea = 0;
    var oldVertexNumber = [];
    if (Rooms.polygons.length == 0) ROOM = [];
    for (var pp = 0; pp < Rooms.polygons.length; pp++) {
      var foundRoom = false;
      var roomId;
      for (var rr = 0; rr < ROOM.length; rr++) {
        roomId = rr;
        var countCoords = Rooms.polygons[pp].coords.length;
        var diffCoords = qSVG.diffObjIntoArray(Rooms.polygons[pp].coords, ROOM[rr].coords);
        if (Rooms.polygons[pp].way.length == ROOM[rr].way.length) {
          if (qSVG.diffArray(Rooms.polygons[pp].way, ROOM[rr].way).length == 0 || diffCoords == 0) {
            countCoords = 0;
          }
        }
        if (Rooms.polygons[pp].way.length == ROOM[rr].way.length + 1) {
          if (qSVG.diffArray(Rooms.polygons[pp].way, ROOM[rr].way).length == 1 || diffCoords == 2) {
            countCoords = 0;
          }
        }
        if (Rooms.polygons[pp].way.length == ROOM[rr].way.length - 1) {
          if (qSVG.diffArray(Rooms.polygons[pp].way, ROOM[rr].way).length == 1) {
            countCoords = 0;
          }
        }
        if (countCoords == 0) {
          foundRoom = true;
          ROOM[rr].area = Rooms.polygons[pp].area;
          ROOM[rr].inside = Rooms.polygons[pp].inside;
          ROOM[rr].coords = Rooms.polygons[pp].coords;
          ROOM[rr].coordsOutside = Rooms.polygons[pp].coordsOutside;
          ROOM[rr].way = Rooms.polygons[pp].way;
          ROOM[rr].coordsInside = Rooms.polygons[pp].coordsInside;
          break;
        }
      }
      if (!foundRoom) {
        ROOM.push({ coords: Rooms.polygons[pp].coords, coordsOutside: Rooms.polygons[pp].coordsOutside, coordsInside: Rooms.polygons[pp].coordsInside, inside: Rooms.polygons[pp].inside, way: Rooms.polygons[pp].way, area: Rooms.polygons[pp].area, surface: '', name: '', color: 'gradientWhite', showSurface: true, action: 'add' });
      }
    }

    var toSplice = [];
    for (var rr = 0; rr < ROOM.length; rr++) {
      var found = true;
      for (var pp = 0; pp < Rooms.polygons.length; pp++) {
        var countRoom = ROOM[rr].coords.length;
        var diffCoords = qSVG.diffObjIntoArray(Rooms.polygons[pp].coords, ROOM[rr].coords);
        if (Rooms.polygons[pp].way.length == ROOM[rr].way.length) {
          if (qSVG.diffArray(Rooms.polygons[pp].way, ROOM[rr].way).length == 0 || diffCoords == 0) {
            countRoom = 0;
          }
        }
        if (Rooms.polygons[pp].way.length == ROOM[rr].way.length + 1) {
          if (qSVG.diffArray(Rooms.polygons[pp].way, ROOM[rr].way).length == 1 || diffCoords == 2) {
            countRoom = 0;
          }
        }
        if (Rooms.polygons[pp].way.length == ROOM[rr].way.length - 1) {
          if (qSVG.diffArray(Rooms.polygons[pp].way, ROOM[rr].way).length == 1) {
            countRoom = 0;
          }
        }
        if (countRoom == 0) { found = true; break; }
        else found = false;
      }
      if (!found) toSplice.push(rr);
    }

    toSplice.sort(function (a, b) {
      return b - a;
    });
    for (var ss = 0; ss < toSplice.length; ss++) {
      ROOM.splice(toSplice[ss], 1);
    }
    $('#boxRoom').empty();
    $('#boxSurface').empty();
    $('#boxArea').empty();
    for (var rr = 0; rr < ROOM.length; rr++) {

      if (ROOM[rr].action == 'add') globalArea = globalArea + ROOM[rr].area;

      var pathSurface = ROOM[rr].coords;
      var pathCreate = "M" + pathSurface[0].x + "," + pathSurface[0].y;
      for (var p = 1; p < pathSurface.length; p++) {
        pathCreate = pathCreate + " " + "L" + pathSurface[p].x + "," + pathSurface[p].y;
      }
      if (ROOM[rr].inside.length > 0) {
        for (var ins = 0; ins < ROOM[rr].inside.length; ins++) {
          pathCreate = pathCreate + " M" + Rooms.polygons[ROOM[rr].inside[ins]].coords[Rooms.polygons[ROOM[rr].inside[ins]].coords.length - 1].x + "," + Rooms.polygons[ROOM[rr].inside[ins]].coords[Rooms.polygons[ROOM[rr].inside[ins]].coords.length - 1].y;
          for (var free = Rooms.polygons[ROOM[rr].inside[ins]].coords.length - 2; free > -1; free--) {
            pathCreate = pathCreate + " L" + Rooms.polygons[ROOM[rr].inside[ins]].coords[free].x + "," + Rooms.polygons[ROOM[rr].inside[ins]].coords[free].y;
          }
        }
      }
      qSVG.create('boxRoom', 'path', {
        d: pathCreate,
        fill: 'url(#' + ROOM[rr].color + ')',
        'fill-opacity': 1, stroke: 'none', 'fill-rule': 'evenodd', class: 'room'
      });

      qSVG.create('boxSurface', 'path', {
        d: pathCreate,
        fill: '#fff', 'fill-opacity': 1, stroke: 'none', 'fill-rule': 'evenodd', class: 'room'
      });

      if (!ROOM[rr].coords || ROOM[rr].coords.length === 0) continue;
      var centroid = qSVG.polygonVisualCenter(ROOM[rr]);
      if (!centroid || centroid.y === undefined || centroid.x === undefined) continue;

      if (ROOM[rr].name != '') {
        var styled = { color: '#343938' };
        if (ROOM[rr].color == 'gradientBlack' || ROOM[rr].color == 'gradientBlue') styled.color = 'white';
        qSVG.textOnDiv(ROOM[rr].name, centroid, styled, 'boxArea');
      }

      if (ROOM[rr].name != '') centroid.y = centroid.y + 20;
      var area = ((ROOM[rr].area) / (meter * meter)).toFixed(2) + ' m²';
      var styled = { color: '#343938', fontSize: '18px', fontWeight: 'normal' };
      if (ROOM[rr].surface != '') {
        styled.fontWeight = 'bold';
        area = ROOM[rr].surface + ' m²';
      }
      if (ROOM[rr].color == 'gradientBlack' || ROOM[rr].color == 'gradientBlue') styled.color = 'white';
      if (ROOM[rr].showSurface) qSVG.textOnDiv(area, centroid, styled, 'boxArea');
    }
    if (globalArea <= 0) {
      globalArea = 0;
      $('#areaValue').html('');
    }
    else {
      $('#areaValue').html('<i class="fa fa-map-o" aria-hidden="true"></i> ' + (globalArea / 3600).toFixed(1) + ' m²');
    }
  };

  editor.rayCastingRoom = function (point) {
    var x = point.x, y = point.y;
    var roomGroup = [];
    for (var polygon = 0; polygon < ROOM.length; polygon++) {
      var inside = qSVG.rayCasting(point, ROOM[polygon].coords);

      if (inside) {
        roomGroup.push(polygon);
      }
    }
    if (roomGroup.length > 0) {
      var bestArea = ROOM[roomGroup[0]].area;
      var roomTarget;
      for (var siz = 0; siz < roomGroup.length; siz++) {
        if (ROOM[roomGroup[siz]].area <= bestArea) {
          bestArea = ROOM[roomGroup[siz]].area;
          roomTarget = ROOM[roomGroup[siz]];
        }
      }
      return roomTarget;
    }
    else {
      return false;
    }
  };

  editor.showScaleBox = function () {
    if (ROOM.length > 0) {
      var minX, minY, maxX, maxY;
      for (var i = 0; i < WALLS.length; i++) {
        var px = WALLS[i].start.x;
        var py = WALLS[i].start.y;
        if (!i || px < minX) minX = px;
        if (!i || py < minY) minY = py;
        if (!i || px > maxX) maxX = px;
        if (!i || py > maxY) maxY = py;
        var px = WALLS[i].end.x;
        var py = WALLS[i].end.y;
        if (!i || px < minX) minX = px;
        if (!i || py < minY) minY = py;
        if (!i || px > maxX) maxX = px;
        if (!i || py > maxY) maxY = py;
      }
      var width = maxX - minX;
      var height = maxY - minY;

      var labelWidth = ((maxX - minX) / meter).toFixed(2);
      var labelHeight = ((maxY - minY) / meter).toFixed(2);

      var sideRight = 'm' + (maxX + 40) + ',' + minY;
      sideRight = sideRight + ' l60,0 m-40,10 l10,-10 l10,10 m-10,-10';
      sideRight = sideRight + ' l0,' + height;
      sideRight = sideRight + ' m-30,0 l60,0 m-40,-10 l10,10 l10,-10';

      sideRight = sideRight + 'M' + (minX) + ',' + (minY - 40);
      sideRight = sideRight + ' l0,-60 m10,40 l-10,-10 l10,-10 m-10,10';
      sideRight = sideRight + ' l' + width + ',0';
      sideRight = sideRight + ' m0,30 l0,-60 m-10,40 l10,-10 l-10,-10';

      $('#boxScale').empty();

      qSVG.create('boxScale', 'path', {
        d: sideRight,
        stroke: "#555",
        fill: "none",
        "stroke-width": 0.3,
        "stroke-linecap": "butt",
        "stroke-linejoin": "miter",
        "stroke-miterlimit": 4,
        "fill-rule": "nonzero"
      });

      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttributeNS(null, 'x', (maxX + 70));
      text.setAttributeNS(null, 'y', ((maxY + minY) / 2) + 35);
      text.setAttributeNS(null, 'fill', '#555');
      text.setAttributeNS(null, 'text-anchor', 'middle');
      text.textContent = labelHeight + ' m';
      text.setAttribute("transform", "rotate(270 " + (maxX + 70) + "," + (maxY + minY) / 2 + ")");
      $('#boxScale').append(text);

      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttributeNS(null, 'x', (maxX + minX) / 2);
      text.setAttributeNS(null, 'y', (minY - 95));
      text.setAttributeNS(null, 'fill', '#555');
      text.setAttributeNS(null, 'text-anchor', 'middle');
      text.textContent = labelWidth + ' m';
      $('#boxScale').append(text);

    }
  };

})(typeof window !== "undefined" ? window : this);