// **************************************************************************
// *****************   LOAD / SAVE LOCALSTORAGE      ************************
// **************************************************************************

function initHistory(boot = false) {
    HISTORY.index = 0;
    if (!boot && localStorage.getItem('history')) localStorage.removeItem('history');
    if (localStorage.getItem('history') && boot === "recovery") {
        let historyTemp = JSON.parse(localStorage.getItem('history'));
        load(historyTemp.length - 1, "boot");
        save("boot");
    }
    if (boot === "newSquare") {
        if (localStorage.getItem('history')) localStorage.removeItem('history');
        HISTORY.push({
            "objData": [],
            "wallData": [{
                "thick": 20,
                "start": { "x": 540, "y": 194 },
                "end": { "x": 540, "y": 734 },
                "type": "normal",
                "parent": 3,
                "child": 1,
                "angle": 1.5707963267948966,
                "equations": { "up": { "A": "v", "B": 550 }, "down": { "A": "v", "B": 530 }, "base": { "A": "v", "B": 540 } },
                "coords": [{ "x": 550, "y": 204 }, { "x": 530, "y": 184 }, { "x": 530, "y": 744 }, { "x": 550, "y": 724 }],
                "graph": { "0": {}, "context": {}, "length": 1 }
            }, {
                "thick": 20,
                "start": { "x": 540, "y": 734 },
                "end": { "x": 1080, "y": 734 },
                "type": "normal",
                "parent": 0,
                "child": 2,
                "angle": 0,
                "equations": { "up": { "A": "h", "B": 724 }, "down": { "A": "h", "B": 744 }, "base": { "A": "h", "B": 734 } },
                "coords": [{ "x": 550, "y": 724 }, { "x": 530, "y": 744 }, { "x": 1090, "y": 744 }, { "x": 1070, "y": 724 }],
                "graph": { "0": {}, "context": {}, "length": 1 }
            }, {
                "thick": 20,
                "start": { "x": 1080, "y": 734 },
                "end": { "x": 1080, "y": 194 },
                "type": "normal",
                "parent": 1,
                "child": 3,
                "angle": -1.5707963267948966,
                "equations": {
                    "up": { "A": "v", "B": 1070 },
                    "down": { "A": "v", "B": 1090 },
                    "base": { "A": "v", "B": 1080 }
                },
                "coords": [{ "x": 1070, "y": 724 }, { "x": 1090, "y": 744 }, { "x": 1090, "y": 184 }, { "x": 1070, "y": 204 }],
                "graph": { "0": {}, "context": {}, "length": 1 }
            }, {
                "thick": 20,
                "start": { "x": 1080, "y": 194 },
                "end": { "x": 540, "y": 194 },
                "type": "normal",
                "parent": 2,
                "child": 0,
                "angle": 3.141592653589793,
                "equations": { "up": { "A": "h", "B": 204 }, "down": { "A": "h", "B": 184 }, "base": { "A": "h", "B": 194 } },
                "coords": [{ "x": 1070, "y": 204 }, { "x": 1090, "y": 184 }, { "x": 530, "y": 184 }, { "x": 550, "y": 204 }],
                "graph": { "0": {}, "context": {}, "length": 1 }
            }],
            "roomData": [{
                "coords": [{ "x": 540, "y": 734 }, { "x": 1080, "y": 734 }, { "x": 1080, "y": 194 }, {
                    "x": 540,
                    "y": 194
                }, { "x": 540, "y": 734 }],
                "coordsOutside": [{ "x": 1090, "y": 744 }, { "x": 1090, "y": 184 }, { "x": 530, "y": 184 }, {
                    "x": 530,
                    "y": 744
                }, { "x": 1090, "y": 744 }],
                "coordsInside": [{ "x": 1070, "y": 724 }, { "x": 1070, "y": 204 }, { "x": 550, "y": 204 }, {
                    "x": 550,
                    "y": 724
                }, { "x": 1070, "y": 724 }],
                "inside": [],
                "way": ["0", "2", "3", "1", "0"],
                "area": 270400,
                "surface": "",
                "name": "",
                "color": "gradientWhite",
                "showSurface": true,
                "action": "add"
            }]
        });
        HISTORY[0] = JSON.stringify(HISTORY[0]);
        localStorage.setItem('history', JSON.stringify(HISTORY));
        load(0);
        save();
    }
    if (boot === "newL") {
        if (localStorage.getItem('history')) localStorage.removeItem('history');
        HISTORY.push({
            "objData": [],
            "wallData": [{
                "thick": 20,
                "start": { "x": 447, "y": 458 },
                "end": { "x": 447, "y": 744 },
                "type": "normal",
                "parent": 5,
                "child": 1,
                "angle": 1.5707963267948966,
                "equations": { "up": { "A": "v", "B": 457 }, "down": { "A": "v", "B": 437 }, "base": { "A": "v", "B": 447 } },
                "coords": [{ "x": 457, "y": 468 }, { "x": 437, "y": 448 }, { "x": 437, "y": 754 }, { "x": 457, "y": 734 }],
                "graph": { "0": {}, "context": {}, "length": 1 }
            }, {
                "thick": 20,
                "start": { "x": 447, "y": 744 },
                "end": { "x": 1347, "y": 744 },
                "type": "normal",
                "parent": 0,
                "child": 2,
                "angle": 0,
                "equations": { "up": { "A": "h", "B": 734 }, "down": { "A": "h", "B": 754 }, "base": { "A": "h", "B": 744 } },
                "coords": [{ "x": 457, "y": 734 }, { "x": 437, "y": 754 }, { "x": 1357, "y": 754 }, { "x": 1337, "y": 734 }],
                "graph": { "0": {}, "context": {}, "length": 1 }
            }, {
                "thick": 20,
                "start": { "x": 1347, "y": 744 },
                "end": { "x": 1347, "y": 144 },
                "type": "normal",
                "parent": 1,
                "child": 3,
                "angle": -1.5707963267948966,
                "equations": {
                    "up": { "A": "v", "B": 1337 },
                    "down": { "A": "v", "B": 1357 },
                    "base": { "A": "v", "B": 1347 }
                },
                "coords": [{ "x": 1337, "y": 734 }, { "x": 1357, "y": 754 }, { "x": 1357, "y": 134 }, { "x": 1337, "y": 154 }],
                "graph": { "0": {}, "context": {}, "length": 1 }
            }, {
                "thick": 20,
                "start": { "x": 1347, "y": 144 },
                "end": { "x": 1020, "y": 144 },
                "type": "normal",
                "parent": 2,
                "child": 4,
                "angle": 3.141592653589793,
                "equations": { "up": { "A": "h", "B": 154 }, "down": { "A": "h", "B": 134 }, "base": { "A": "h", "B": 144 } },
                "coords": [{ "x": 1337, "y": 154 }, { "x": 1357, "y": 134 }, { "x": 1010, "y": 134 }, { "x": 1030, "y": 154 }],
                "graph": { "0": {}, "context": {}, "length": 1 }
            }, {
                "thick": 20,
                "start": { "x": 1020, "y": 144 },
                "end": { "x": 1020, "y": 458 },
                "type": "normal",
                "parent": 3,
                "child": 5,
                "angle": 1.5707963267948966,
                "equations": {
                    "up": { "A": "v", "B": 1030 },
                    "down": { "A": "v", "B": 1010 },
                    "base": { "A": "v", "B": 1020 }
                },
                "coords": [{ "x": 1030, "y": 154 }, { "x": 1010, "y": 134 }, { "x": 1010, "y": 448 }, { "x": 1030, "y": 468 }],
                "graph": { "0": {}, "context": {}, "length": 1 }
            }, {
                "thick": 20,
                "start": { "x": 1020, "y": 458 },
                "end": { "x": 447, "y": 458 },
                "type": "normal",
                "parent": 4,
                "child": 0,
                "angle": 3.141592653589793,
                "equations": { "up": { "A": "h", "B": 468 }, "down": { "A": "h", "B": 448 }, "base": { "A": "h", "B": 458 } },
                "coords": [{ "x": 1030, "y": 468 }, { "x": 1010, "y": 448 }, { "x": 437, "y": 448 }, { "x": 457, "y": 468 }],
                "graph": { "0": {}, "context": {}, "length": 1 }
            }],
            "roomData": [{
                "coords": [{ "x": 447, "y": 744 }, { "x": 1347, "y": 744 }, { "x": 1347, "y": 144 }, {
                    "x": 1020,
                    "y": 144
                }, { "x": 1020, "y": 458 }, { "x": 447, "y": 458 }, { "x": 447, "y": 744 }],
                "coordsOutside": [{ "x": 1357, "y": 754 }, { "x": 1357, "y": 134 }, { "x": 1010, "y": 134 }, {
                    "x": 1010,
                    "y": 448
                }, { "x": 437, "y": 448 }, { "x": 437, "y": 754 }, { "x": 1357, "y": 754 }],
                "coordsInside": [{ "x": 1337, "y": 734 }, { "x": 1337, "y": 154 }, { "x": 1030, "y": 154 }, {
                    "x": 1030,
                    "y": 468
                }, { "x": 457, "y": 468 }, { "x": 457, "y": 734 }, { "x": 1337, "y": 734 }],
                "inside": [],
                "way": ["0", "2", "3", "4", "5", "1", "0"],
                "area": 330478,
                "surface": "",
                "name": "",
                "color": "gradientWhite",
                "showSurface": true,
                "action": "add"
            }]
        });
        HISTORY[0] = JSON.stringify(HISTORY[0]);
        localStorage.setItem('history', JSON.stringify(HISTORY));
        load(0);
        save();
    }
}

document.getElementById('redo').addEventListener("click", function () {
    if (HISTORY.index < HISTORY.length) {
        load(HISTORY.index);
        HISTORY.index++;
        $('#undo').removeClass('disabled');
        if (HISTORY.index === HISTORY.length) {
            $('#redo').addClass('disabled');
        }
    }
});

document.getElementById('undo').addEventListener("click", function () {
    if (HISTORY.index > 0) {
        $('#undo').removeClass('disabled');
        if (HISTORY.index - 1 > 0) {
            HISTORY.index--;
            load(HISTORY.index - 1);
            $('#redo').removeClass('disabled');
        }
    }
    if (HISTORY.index === 1) $('#undo').addClass('disabled');
});

function save(boot = false) {
    if (boot) localStorage.removeItem('history');
    // FOR CYCLIC OBJ INTO LOCALSTORAGE !!!
    for (let k in WALLS) {
        if (WALLS[k].child != null) {
            WALLS[k].child = WALLS.indexOf(WALLS[k].child);
        }
        if (WALLS[k].parent != null) {
            WALLS[k].parent = WALLS.indexOf(WALLS[k].parent);
        }
    }
    // Serialize curved walls
    var curvedWallsData = typeof serializeCurvedWalls === 'function' ? serializeCurvedWalls() : [];

    if (JSON.stringify({ objData: OBJDATA, wallData: WALLS, roomData: ROOM, curvedWallData: curvedWallsData }) === HISTORY[HISTORY.length - 1]) {
        for (let k in WALLS) {
            if (WALLS[k].child != null) {
                WALLS[k].child = WALLS[WALLS[k].child];
            }
            if (WALLS[k].parent != null) {
                WALLS[k].parent = WALLS[WALLS[k].parent];
            }
        }
        return false;
    }

    if (HISTORY.index < HISTORY.length) {
        HISTORY.splice(HISTORY.index, (HISTORY.length - HISTORY.index));
        $('#redo').addClass('disabled');
    }
    var snapshot = JSON.stringify({ objData: OBJDATA, wallData: WALLS, roomData: ROOM, curvedWallData: curvedWallsData });

    // Cap history length to avoid quota issues (keep last 20 states)
    var MAX_HISTORY = 20;
    if (HISTORY.length >= MAX_HISTORY) {
        HISTORY = HISTORY.slice(HISTORY.length - (MAX_HISTORY - 1));
        HISTORY.index = HISTORY.length;
    }

    HISTORY.push(snapshot);
    try {
        localStorage.setItem('history', JSON.stringify(HISTORY));
    } catch (e) {
        console.warn('History not saved to localStorage (quota exceeded)', e);
    }
    HISTORY.index++;
    if (HISTORY.index > 1) $('#undo').removeClass('disabled');
    for (let k in WALLS) {
        if (WALLS[k].child != null) {
            WALLS[k].child = WALLS[WALLS[k].child];
        }
        if (WALLS[k].parent != null) {
            WALLS[k].parent = WALLS[WALLS[k].parent];
        }
    }
    return true;
}

function load(index = HISTORY.index, boot = false) {
    if (HISTORY.length === 0 && !boot) return false;
    for (let k in OBJDATA) {
        OBJDATA[k].graph.remove();
    }
    OBJDATA = [];
    let historyTemp = [];
    historyTemp = JSON.parse(localStorage.getItem('history'));
    historyTemp = JSON.parse(historyTemp[index]);

    for (let k in historyTemp.objData) {
        let OO = historyTemp.objData[k];
        // if (OO.family === 'energy') OO.family = 'byObject';
        let obj = new editor.obj2D(OO.family, OO.class, OO.type, {
            x: OO.x,
            y: OO.y
        }, OO.angle, OO.angleSign, OO.size, OO.hinge = 'normal', OO.thick, OO.value);
        obj.limit = OO.limit;
        OBJDATA.push(obj);
        $('#boxcarpentry').append(OBJDATA[OBJDATA.length - 1].graph);
        obj.update();
    }
    WALLS = historyTemp.wallData;
    for (let k in WALLS) {
        if (WALLS[k].child != null) {
            WALLS[k].child = WALLS[WALLS[k].child];
        }
        if (WALLS[k].parent != null) {
            WALLS[k].parent = WALLS[WALLS[k].parent];
        }
    }
    ROOM = historyTemp.roomData;

    // Load curved walls if available
    if (historyTemp.curvedWallData && typeof deserializeCurvedWalls === 'function') {
        deserializeCurvedWalls(historyTemp.curvedWallData);
    }

    editor.architect(WALLS);
    editor.showScaleBox();
    rib();
}
