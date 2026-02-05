(function (global) {
  var editor = global.editor = global.editor || {};

  editor.objFromWall = function (wall, typeObj = false) {
    var objList = [];
    for (var scan = 0; scan < OBJDATA.length; scan++) {
      var search;
      if (OBJDATA[scan].family == 'inWall') {
        var eq = qSVG.createEquation(wall.start.x, wall.start.y, wall.end.x, wall.end.y);
        search = qSVG.nearPointOnEquation(eq, OBJDATA[scan]);
        if (search.distance < 0.01 && qSVG.btwn(OBJDATA[scan].x, wall.start.x, wall.end.x) && qSVG.btwn(OBJDATA[scan].y, wall.start.y, wall.end.y)) objList.push(OBJDATA[scan]);
        // WARNING 0.01 TO NO COUNT OBJECT ON LIMITS OF THE EDGE !!!!!!!!!!!! UGLY CODE( MOUSE PRECISION)
        // TRY WITH ANGLE MAYBE ???
      }
    }
    return objList;
  };

  editor.inWallRib2 = function (wall, option = false) {
    if (!option) $('#boxRib').empty();
    ribMaster = [];
    var emptyArray = [];
    ribMaster.push(emptyArray);
    ribMaster.push(emptyArray);
    var inter;
    var distance;
    var cross;
    var angleTextValue = wall.angle * (180 / Math.PI);
    var objWall = editor.objFromWall(wall); // LIST OBJ ON EDGE
    ribMaster[0].push({ wall: wall, crossObj: false, side: 'up', coords: wall.coords[0], distance: 0 });
    ribMaster[1].push({ wall: wall, crossObj: false, side: 'down', coords: wall.coords[1], distance: 0 });
    for (var ob in objWall) {
      var objTarget = objWall[ob];
      objTarget.up = [
        qSVG.nearPointOnEquation(wall.equations.up, objTarget.limit[0]),
        qSVG.nearPointOnEquation(wall.equations.up, objTarget.limit[1])
      ];
      objTarget.down = [
        qSVG.nearPointOnEquation(wall.equations.down, objTarget.limit[0]),
        qSVG.nearPointOnEquation(wall.equations.down, objTarget.limit[1])
      ];

      distance = qSVG.measure(wall.coords[0], objTarget.up[0]) / meter;
      ribMaster[0].push({ wall: wall, crossObj: ob, side: 'up', coords: objTarget.up[0], distance: distance.toFixed(2) });
      distance = qSVG.measure(wall.coords[0], objTarget.up[1]) / meter;
      ribMaster[0].push({ wall: wall, crossObj: ob, side: 'up', coords: objTarget.up[1], distance: distance.toFixed(2) });
      distance = qSVG.measure(wall.coords[1], objTarget.down[0]) / meter;
      ribMaster[1].push({ wall: wall, crossObj: ob, side: 'down', coords: objTarget.down[0], distance: distance.toFixed(2) });
      distance = qSVG.measure(wall.coords[1], objTarget.down[1]) / meter;
      ribMaster[1].push({ wall: wall, crossObj: ob, side: 'down', coords: objTarget.down[1], distance: distance.toFixed(2) });
    }
    distance = qSVG.measure(wall.coords[0], wall.coords[3]) / meter;
    ribMaster[0].push({ wall: wall, crossObj: false, side: 'up', coords: wall.coords[3], distance: distance });
    distance = qSVG.measure(wall.coords[1], wall.coords[2]) / meter;
    ribMaster[1].push({ wall: wall, crossObj: false, side: 'down', coords: wall.coords[2], distance: distance });
    ribMaster[0].sort(function (a, b) {
      return (a.distance - b.distance).toFixed(2);
    });
    ribMaster[1].sort(function (a, b) {
      return (a.distance - b.distance).toFixed(2);
    });
    for (var t in ribMaster) {
      for (var n = 1; n < ribMaster[t].length; n++) {
        var found = true;
        var shift = -5;
        var valueText = Math.abs(ribMaster[t][n - 1].distance - ribMaster[t][n].distance);
        var angleText = angleTextValue;
        if (found) {
          if (ribMaster[t][n - 1].side == 'down') { shift = -shift + 10; }
          if (angleText > 89 || angleText < -89) {
            angleText -= 180;
            if (ribMaster[t][n - 1].side == 'down') { shift = -5; }
            else shift = -shift + 10;
          }



          sizeText[n] = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          var startText = qSVG.middle(ribMaster[t][n - 1].coords.x, ribMaster[t][n - 1].coords.y, ribMaster[t][n].coords.x, ribMaster[t][n].coords.y);
          sizeText[n].setAttributeNS(null, 'x', startText.x);
          sizeText[n].setAttributeNS(null, 'y', (startText.y) + shift);
          sizeText[n].setAttributeNS(null, 'text-anchor', 'middle');
          sizeText[n].setAttributeNS(null, 'font-family', 'roboto');
          sizeText[n].setAttributeNS(null, 'stroke', '#ffffff');
          sizeText[n].textContent = valueText.toFixed(2);
          if (sizeText[n].textContent < 1) {
            sizeText[n].setAttributeNS(null, 'font-size', '0.8em');
            sizeText[n].textContent = sizeText[n].textContent.substring(1, sizeText[n].textContent.length);
          }
          else sizeText[n].setAttributeNS(null, 'font-size', '1em');
          sizeText[n].setAttributeNS(null, 'stroke-width', '0.4px');
          sizeText[n].setAttributeNS(null, 'fill', '#666666');
          sizeText[n].setAttribute("transform", "rotate(" + angleText + " " + startText.x + "," + (startText.y) + ")");

          $('#boxRib').append(sizeText[n]);
        }
      }
    }
  };

  editor.obj2D = function (family, classe, type, pos, angle, angleSign, size, hinge = 'normal', thick, value) {
    this.family = family   // inWall, stick, collision, free
    this.class = classe;  // door, window, energy, stair, measure, text ?
    this.type = type; // simple, double, simpleSlide, aperture, doubleSlide, fixed, switch, lamp....
    this.x = pos.x;
    this.y = pos.y;
    this.angle = angle;
    this.angleSign = angleSign;
    this.limit = [];
    this.hinge = hinge; // normal, reverse
    this.graph = qSVG.create('none', 'g');
    this.scale = { x: 1, y: 1 };
    this.value = value;
    this.size = size;
    this.thick = thick;
    this.width = (this.size / meter).toFixed(2);
    this.height = (this.thick / meter).toFixed(2);

    var cc = carpentryCalc(classe, type, size, thick, value);
    var blank;

    for (var tt = 0; tt < cc.length; tt++) {
      if (cc[tt].path) {
        blank = qSVG.create('none', 'path', {
          d: cc[tt].path,
          "stroke-width": 1,
          fill: cc[tt].fill,
          stroke: cc[tt].stroke,
          'stroke-dasharray': cc[tt].strokeDashArray,
          opacity: cc[tt].opacity
        });
      }
      if (cc[tt].text) {
        blank = qSVG.create("none", "text", {
          x: cc[tt].x,
          y: cc[tt].y,
          'font-size': cc[tt].fontSize,
          stroke: cc[tt].stroke,
          "stroke-width": cc[tt].strokeWidth,
          'font-family': 'roboto',
          'text-anchor': 'middle',
          fill: cc[tt].fill
        });
        blank[0].textContent = cc[tt].text;
      }
      this.graph.append(blank);

    } // ENDFOR
    var bbox = this.graph.get(0).getBoundingClientRect();
    bbox.x = (bbox.x * factor) - (offset.left * factor) + originX_viewbox;
    bbox.y = (bbox.y * factor) - (offset.top * factor) + originY_viewbox;
    bbox.origin = { x: this.x, y: this.y };
    this.bbox = bbox;
    this.realBbox = [{ x: -this.size / 2, y: -this.thick / 2 }, { x: this.size / 2, y: -this.thick / 2 }, { x: this.size / 2, y: this.thick / 2 }, { x: -this.size / 2, y: this.thick / 2 }];
    if (family == "byObject") this.family = cc.family;
    this.params = cc.params; // (bindBox, move, resize, rotate)
    cc.params.width ? this.size = cc.params.width : this.size = size;
    cc.params.height ? this.thick = cc.params.height : this.thick = thick;


    this.update = function () {
      this.width = (this.size / meter).toFixed(2);
      this.height = (this.thick / meter).toFixed(2);
      cc = carpentryCalc(this.class, this.type, this.size, this.thick, this.value);
      for (var tt = 0; tt < cc.length; tt++) {
        if (cc[tt].path) {
          this.graph.find('path')[tt].setAttribute("d", cc[tt].path);
        }
        else {
          // this.graph.find('text').context.textContent = cc[tt].text;
        }
      }
      var hingeStatus = this.hinge; // normal - reverse
      var hingeUpdate;
      if (hingeStatus == 'normal') hingeUpdate = 1;
      else hingeUpdate = -1;
      this.graph.attr({ "transform": "translate(" + (this.x) + "," + (this.y) + ") rotate(" + this.angle + ",0,0) scale(" + hingeUpdate + ", 1)" });
      var bbox = this.graph.get(0).getBoundingClientRect();
      bbox.x = (bbox.x * factor) - (offset.left * factor) + originX_viewbox;
      bbox.y = (bbox.y * factor) - (offset.top * factor) + originY_viewbox;
      bbox.origin = { x: this.x, y: this.y };
      this.bbox = bbox;

      if (this.class == "text" && this.angle == 0) {
        this.realBbox = [
          { x: this.bbox.x, y: this.bbox.y }, { x: this.bbox.x + this.bbox.width, y: this.bbox.y }, { x: this.bbox.x + this.bbox.width, y: this.bbox.y + this.bbox.height }, { x: this.bbox.x, y: this.bbox.y + this.bbox.height }];
        this.size = this.bbox.width;
        this.thick = this.bbox.height;
      }

      var angleRadian = -(this.angle) * (Math.PI / 180);
      this.realBbox = [{ x: -this.size / 2, y: -this.thick / 2 }, { x: this.size / 2, y: -this.thick / 2 }, { x: this.size / 2, y: this.thick / 2 }, { x: -this.size / 2, y: this.thick / 2 }];
      var newRealBbox = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
      newRealBbox[0].x = (this.realBbox[0].y * Math.sin(angleRadian) + this.realBbox[0].x * Math.cos(angleRadian)) + this.x;
      newRealBbox[1].x = (this.realBbox[1].y * Math.sin(angleRadian) + this.realBbox[1].x * Math.cos(angleRadian)) + this.x;
      newRealBbox[2].x = (this.realBbox[2].y * Math.sin(angleRadian) + this.realBbox[2].x * Math.cos(angleRadian)) + this.x;
      newRealBbox[3].x = (this.realBbox[3].y * Math.sin(angleRadian) + this.realBbox[3].x * Math.cos(angleRadian)) + this.x;
      newRealBbox[0].y = (this.realBbox[0].y * Math.cos(angleRadian) - this.realBbox[0].x * Math.sin(angleRadian)) + this.y;
      newRealBbox[1].y = (this.realBbox[1].y * Math.cos(angleRadian) - this.realBbox[1].x * Math.sin(angleRadian)) + this.y;
      newRealBbox[2].y = (this.realBbox[2].y * Math.cos(angleRadian) - this.realBbox[2].x * Math.sin(angleRadian)) + this.y;
      newRealBbox[3].y = (this.realBbox[3].y * Math.cos(angleRadian) - this.realBbox[3].x * Math.sin(angleRadian)) + this.y;
      this.realBbox = newRealBbox;
      return true;
    }
  };

})(typeof window !== "undefined" ? window : this);