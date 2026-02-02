/**
 * Процедурный генератор планировок v2
 * Реалистичные планировки: L-образные формы, стены под углом,
 * разная толщина стен, окна только на внешних стенах
 */

var FloorplanGenerator = {

    // Типы комнат с характеристиками
    roomTypes: {
        kitchen: { name: 'Кухня', color: 'gradientYellow', minArea: 8, maxArea: 15 },
        living: { name: 'Зал', color: 'gradientBlue', minArea: 15, maxArea: 30 },
        bedroom: { name: 'Спальня', color: 'gradientGreen', minArea: 10, maxArea: 20 },
        bathroom: { name: 'Ванная', color: 'gradientSky', minArea: 4, maxArea: 8 },
        toilet: { name: 'Туалет', color: 'gradientGrey', minArea: 2, maxArea: 4 },
        hallway: { name: 'Прихожая', color: 'gradientWhite', minArea: 4, maxArea: 10 },
        corridor: { name: 'Коридор', color: 'gradientWhite', minArea: 3, maxArea: 8 },
        office: { name: 'Кабинет', color: 'gradientOrange', minArea: 8, maxArea: 15 },
        storage: { name: 'Кладовая', color: 'gradientGrey', minArea: 2, maxArea: 5 },
        garage: { name: 'Гараж', color: 'gradientGrey', minArea: 15, maxArea: 30 },
        terrace: { name: 'Терраса', color: 'gradientGreen', minArea: 5, maxArea: 15 }
    },

    // Типы дверей
    doorTypes: ['simple', 'double', 'pocket'],

    // Типы окон
    windowTypes: ['fix', 'twin', 'bay'],

    // Настройки
    defaults: {
        loadBearingWallThick: 25,  // Несущие стены
        partitionWallThick: 10,    // Перегородки
        meter: 60,
        minRoomSize: 180,
        doorSize: 60,
        windowSizeSmall: 60,
        windowSizeLarge: 100,
        gridSnap: 30,
        concaveChance: 0.2
    },

    // Хранение информации о внешних стенах
    outerWalls: [],
    innerWalls: [],

    /**
     * Очистить текущую планировку
     */
    clearFloorplan: function() {
        for (var i = WALLS.length - 1; i >= 0; i--) {
            if (WALLS[i].graph) WALLS[i].graph.remove();
        }
        WALLS = [];

        for (var i = OBJDATA.length - 1; i >= 0; i--) {
            if (OBJDATA[i].graph) OBJDATA[i].graph.remove();
        }
        OBJDATA = [];
        ROOM = [];
        this.outerWalls = [];
        this.innerWalls = [];

        $('#boxwall').empty();
        $('#boxRoom').empty();
        $('#boxSurface').empty();
        $('#boxArea').empty();
        $('#boxcarpentry').empty();
        $('#boxEnergy').empty();
    },

    /**
     * Утилиты
     */
    utils: {
        random: function(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },
        randomFloat: function(min, max) {
            return Math.random() * (max - min) + min;
        },
        shuffle: function(array) {
            var result = array.slice();
            for (var i = result.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = result[i];
                result[i] = result[j];
                result[j] = temp;
            }
            return result;
        },
        snapToGrid: function(value, grid) {
            return Math.round(value / grid) * grid;
        },
        distance: function(p1, p2) {
            return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        },
        // Поворот точки вокруг центра
        rotatePoint: function(point, center, angleDeg) {
            var angleRad = angleDeg * Math.PI / 180;
            var cos = Math.cos(angleRad);
            var sin = Math.sin(angleRad);
            var dx = point.x - center.x;
            var dy = point.y - center.y;
            return {
                x: center.x + dx * cos - dy * sin,
                y: center.y + dx * sin + dy * cos
            };
        }
    },

    /**
     * Создать стену
     */
    createWall: function(x1, y1, x2, y2, type, thick, isOuter) {
        type = type || 'normal';
        thick = thick || this.defaults.partitionWallThick;

        var wall = new editor.wall(
            { x: x1, y: y1 },
            { x: x2, y: y2 },
            type,
            thick
        );
        wall.isOuter = isOuter || false;
        WALLS.push(wall);

        if (isOuter) {
            this.outerWalls.push(wall);
        } else {
            this.innerWalls.push(wall);
        }

        return wall;
    },

    /**
     * Генерация формы здания (не прямоугольник!)
     * Возвращает массив точек полигона
     */
    generateBuildingShape: function(baseWidth, baseHeight, shapeType, concaveChance) {
        var points = [];
        var x = 200, y = 200;
        concaveChance = concaveChance || 0;

        // Случайный выбор формы если не указан
        if (!shapeType) {
            var shapes = ['L', 'T', 'U', 'irregular', 'angled'];
            shapeType = shapes[this.utils.random(0, shapes.length - 1)];
        }

        switch (shapeType) {
            case 'L':
                // L-образная форма
                var cutWidth = this.utils.random(baseWidth * 0.3, baseWidth * 0.5);
                var cutHeight = this.utils.random(baseHeight * 0.3, baseHeight * 0.5);
                points = [
                    { x: x, y: y },
                    { x: x + baseWidth, y: y },
                    { x: x + baseWidth, y: y + baseHeight - cutHeight },
                    { x: x + baseWidth - cutWidth, y: y + baseHeight - cutHeight },
                    { x: x + baseWidth - cutWidth, y: y + baseHeight },
                    { x: x, y: y + baseHeight }
                ];
                break;

            case 'T':
                // T-образная форма
                var wingWidth = this.utils.random(baseWidth * 0.2, baseWidth * 0.35);
                var wingHeight = this.utils.random(baseHeight * 0.3, baseHeight * 0.4);
                points = [
                    { x: x + wingWidth, y: y },
                    { x: x + baseWidth - wingWidth, y: y },
                    { x: x + baseWidth - wingWidth, y: y + wingHeight },
                    { x: x + baseWidth, y: y + wingHeight },
                    { x: x + baseWidth, y: y + baseHeight },
                    { x: x, y: y + baseHeight },
                    { x: x, y: y + wingHeight },
                    { x: x + wingWidth, y: y + wingHeight }
                ];
                break;

            case 'U':
                // U-образная форма
                var courtWidth = this.utils.random(baseWidth * 0.3, baseWidth * 0.5);
                var courtHeight = this.utils.random(baseHeight * 0.4, baseHeight * 0.6);
                var sideWidth = (baseWidth - courtWidth) / 2;
                points = [
                    { x: x, y: y },
                    { x: x + sideWidth, y: y },
                    { x: x + sideWidth, y: y + courtHeight },
                    { x: x + sideWidth + courtWidth, y: y + courtHeight },
                    { x: x + sideWidth + courtWidth, y: y },
                    { x: x + baseWidth, y: y },
                    { x: x + baseWidth, y: y + baseHeight },
                    { x: x, y: y + baseHeight }
                ];
                break;

            case 'angled':
                // Форма со скошенным углом (как гараж на примере)
                var cutSize = this.utils.random(baseWidth * 0.15, baseWidth * 0.25);
                points = [
                    { x: x, y: y },
                    { x: x + baseWidth - cutSize, y: y },
                    { x: x + baseWidth, y: y + cutSize }, // скошенный угол
                    { x: x + baseWidth, y: y + baseHeight },
                    { x: x, y: y + baseHeight }
                ];
                break;

            case 'irregular':
                // Неправильная форма с выступами
                var bump2 = this.utils.random(baseHeight * 0.15, baseHeight * 0.25);
                points = [
                    { x: x, y: y },
                    { x: x + baseWidth * 0.6, y: y },
                    { x: x + baseWidth * 0.6, y: y - bump2 }, // выступ вверх
                    { x: x + baseWidth * 0.8, y: y - bump2 },
                    { x: x + baseWidth * 0.8, y: y },
                    { x: x + baseWidth, y: y },
                    { x: x + baseWidth, y: y + baseHeight },
                    { x: x + baseWidth * 0.4, y: y + baseHeight },
                    { x: x + baseWidth * 0.4, y: y + baseHeight + bump2 }, // выступ вниз (терраса)
                    { x: x + baseWidth * 0.1, y: y + baseHeight + bump2 },
                    { x: x + baseWidth * 0.1, y: y + baseHeight },
                    { x: x, y: y + baseHeight }
                ];
                break;

            default:
                // Прямоугольник
                points = [
                    { x: x, y: y },
                    { x: x + baseWidth, y: y },
                    { x: x + baseWidth, y: y + baseHeight },
                    { x: x, y: y + baseHeight }
                ];
        }

        // Округляем до сетки
        for (var i = 0; i < points.length; i++) {
            points[i].x = this.utils.snapToGrid(points[i].x, this.defaults.gridSnap);
            points[i].y = this.utils.snapToGrid(points[i].y, this.defaults.gridSnap);
        }

        // Опционально добавляем вогнутый диагональный надрез внутрь формы
        if (Math.random() < concaveChance) {
            points = this.addConcaveNotch(points, this.defaults.gridSnap);
        }

        return points;
    },

    /**
     * Добавляет одну диагональную грань, смещённую к центру масс полигона.
     */
    addConcaveNotch: function(points, gridSnap) {
        if (points.length < 4) return points;

        // Центр масс (среднее координат вершин)
        var cx = 0, cy = 0;
        for (var i = 0; i < points.length; i++) {
            cx += points[i].x;
            cy += points[i].y;
        }
        cx /= points.length;
        cy /= points.length;

        // Выбираем случайное ребро
        var edgeIndex = this.utils.random(0, points.length - 1);
        var p1 = points[edgeIndex];
        var p2 = points[(edgeIndex + 1) % points.length];

        var mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        var vToCenter = { x: cx - mid.x, y: cy - mid.y };
        var dist = Math.sqrt(vToCenter.x * vToCenter.x + vToCenter.y * vToCenter.y);
        if (dist < 1) return points;

        // Сдвигаем внутрь на 40–70% пути к центру (гарантирует смещение по X и Y)
        var scale = this.utils.randomFloat(0.4, 0.7);
        var notch = {
            x: mid.x + vToCenter.x * scale,
            y: mid.y + vToCenter.y * scale
        };

        notch.x = this.utils.snapToGrid(notch.x, gridSnap);
        notch.y = this.utils.snapToGrid(notch.y, gridSnap);

        // Вставляем новую точку между p1 и p2
        var newPoints = [];
        for (var i = 0; i < points.length; i++) {
            newPoints.push(points[i]);
            if (i === edgeIndex) {
                newPoints.push(notch);
            }
        }
        return newPoints;
    },

    /**
     * Создать внешние стены по точкам полигона
     */
    createOuterWallsFromShape: function(points, thick) {
        thick = thick || this.defaults.loadBearingWallThick;

        for (var i = 0; i < points.length; i++) {
            var p1 = points[i];
            var p2 = points[(i + 1) % points.length];
            this.createWall(p1.x, p1.y, p2.x, p2.y, 'normal', thick, true);
        }
    },

    /**
     * Получить bounding box формы
     */
    getBoundingBox: function(points) {
        var minX = Infinity, minY = Infinity;
        var maxX = -Infinity, maxY = -Infinity;

        for (var i = 0; i < points.length; i++) {
            minX = Math.min(minX, points[i].x);
            minY = Math.min(minY, points[i].y);
            maxX = Math.max(maxX, points[i].x);
            maxY = Math.max(maxY, points[i].y);
        }

        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY,
                 width: maxX - minX, height: maxY - minY };
    },

    /**
     * Проверка, находится ли точка внутри полигона
     */
    pointInPolygon: function(point, polygon) {
        var inside = false;
        for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            var xi = polygon[i].x, yi = polygon[i].y;
            var xj = polygon[j].x, yj = polygon[j].y;

            if (((yi > point.y) != (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    },

    /**
     * Создание внутренних перегородок
     * Разбивает пространство на комнаты
     */
    createInnerPartitions: function(shape) {
        var bbox = this.getBoundingBox(shape);
        var thick = this.defaults.partitionWallThick;
        var loadBearingThick = this.defaults.loadBearingWallThick;

        // Создаём несколько горизонтальных и вертикальных разделителей
        var horizontalCuts = this.utils.random(1, 3);
        var verticalCuts = this.utils.random(1, 3);

        // Горизонтальные перегородки
        for (var i = 0; i < horizontalCuts; i++) {
            var y = this.utils.snapToGrid(
                bbox.minY + bbox.height * (i + 1) / (horizontalCuts + 1),
                this.defaults.gridSnap
            );

            // Находим пересечения с границами
            var intersections = this.findHorizontalIntersections(y, shape);
            if (intersections.length >= 2) {
                // Иногда делаем несущую стену внутри
                var wallThick = (i === 0 && Math.random() > 0.5) ? loadBearingThick : thick;

                // Иногда делаем стену не на всю ширину (оставляем проём)
                var startX = intersections[0];
                var endX = intersections[intersections.length - 1];

                if (Math.random() > 0.3) {
                    // Разрыв для прохода
                    var gapStart = this.utils.snapToGrid(
                        startX + (endX - startX) * this.utils.randomFloat(0.3, 0.7),
                        this.defaults.gridSnap
                    );
                    var gapEnd = gapStart + this.utils.random(60, 120);

                    if (gapStart > startX + 60) {
                        this.createWall(startX, y, gapStart, y, 'normal', wallThick, false);
                    }
                    if (gapEnd < endX - 60) {
                        this.createWall(gapEnd, y, endX, y, 'normal', wallThick, false);
                    }
                } else {
                    this.createWall(startX, y, endX, y, 'normal', wallThick, false);
                }
            }
        }

        // Вертикальные перегородки
        for (var i = 0; i < verticalCuts; i++) {
            var x = this.utils.snapToGrid(
                bbox.minX + bbox.width * (i + 1) / (verticalCuts + 1),
                this.defaults.gridSnap
            );

            var intersections = this.findVerticalIntersections(x, shape);
            if (intersections.length >= 2) {
                var wallThick = (i === 0 && Math.random() > 0.6) ? loadBearingThick : thick;

                var startY = intersections[0];
                var endY = intersections[intersections.length - 1];

                if (Math.random() > 0.3) {
                    var gapStart = this.utils.snapToGrid(
                        startY + (endY - startY) * this.utils.randomFloat(0.3, 0.7),
                        this.defaults.gridSnap
                    );
                    var gapEnd = gapStart + this.utils.random(60, 120);

                    if (gapStart > startY + 60) {
                        this.createWall(x, startY, x, gapStart, 'normal', wallThick, false);
                    }
                    if (gapEnd < endY - 60) {
                        this.createWall(x, gapEnd, x, endY, 'normal', wallThick, false);
                    }
                } else {
                    this.createWall(x, startY, x, endY, 'normal', wallThick, false);
                }
            }
        }

        // Диагональные стены убраны - они ломают замкнутость комнат
    },

    /**
     * Найти точку пересечения двух отрезков (стен)
     */
    getLineIntersection: function(p1, p2, p3, p4) {
        var d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
        if (Math.abs(d) < 0.001) return null; // Параллельны

        var t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
        var u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;

        // Проверяем, что пересечение внутри обоих отрезков
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: p1.x + t * (p2.x - p1.x),
                y: p1.y + t * (p2.y - p1.y)
            };
        }
        return null;
    },

    /**
     * Проверить, лежит ли точка на отрезке стены
     */
    isPointOnWall: function(point, wall, tolerance) {
        tolerance = tolerance || 5;
        var d1 = this.utils.distance(point, wall.start);
        var d2 = this.utils.distance(point, wall.end);
        var wallLen = this.utils.distance(wall.start, wall.end);
        return Math.abs(d1 + d2 - wallLen) < tolerance;
    },

    /**
     * Построить граф сегментов стен между пересечениями
     * Возвращает массив сегментов с доступным пространством для объектов
     */
    buildWallSegments: function() {
        var segments = [];

        for (var w = 0; w < WALLS.length; w++) {
            var wall = WALLS[w];
            var wallStart = wall.start;
            var wallEnd = wall.end;
            var wallLength = this.utils.distance(wallStart, wallEnd);
            if (wallLength < 10) continue;

            // Собираем все точки пересечения НА этой стене
            var pointsOnWall = [];

            // Начало и конец стены
            pointsOnWall.push({ pos: 0, x: wallStart.x, y: wallStart.y });
            pointsOnWall.push({ pos: wallLength, x: wallEnd.x, y: wallEnd.y });

            // Ищем пересечения с другими стенами
            for (var i = 0; i < WALLS.length; i++) {
                if (i === w) continue;
                var otherWall = WALLS[i];

                // Пересечение отрезков
                var inter = this.getLineIntersection(wallStart, wallEnd, otherWall.start, otherWall.end);
                if (inter) {
                    var pos = this.utils.distance(wallStart, inter);
                    if (pos > 5 && pos < wallLength - 5) {
                        pointsOnWall.push({ pos: pos, x: inter.x, y: inter.y });
                    }
                }

                // T-соединения: концы других стен на этой стене
                if (this.isPointOnWall(otherWall.start, wall, 15)) {
                    var pos = this.utils.distance(wallStart, otherWall.start);
                    if (pos > 5 && pos < wallLength - 5) {
                        pointsOnWall.push({ pos: pos, x: otherWall.start.x, y: otherWall.start.y });
                    }
                }
                if (this.isPointOnWall(otherWall.end, wall, 15)) {
                    var pos = this.utils.distance(wallStart, otherWall.end);
                    if (pos > 5 && pos < wallLength - 5) {
                        pointsOnWall.push({ pos: pos, x: otherWall.end.x, y: otherWall.end.y });
                    }
                }
            }

            // Сортируем по позиции вдоль стены
            pointsOnWall.sort(function(a, b) { return a.pos - b.pos; });

            // Убираем дубликаты (близкие точки)
            var uniquePoints = [pointsOnWall[0]];
            for (var i = 1; i < pointsOnWall.length; i++) {
                if (pointsOnWall[i].pos - uniquePoints[uniquePoints.length - 1].pos > 10) {
                    uniquePoints.push(pointsOnWall[i]);
                }
            }

            // Создаём сегменты между соседними точками
            for (var i = 0; i < uniquePoints.length - 1; i++) {
                var segStart = uniquePoints[i];
                var segEnd = uniquePoints[i + 1];
                var segLength = segEnd.pos - segStart.pos;

                // Минимальный отступ от краёв сегмента (от пересечений)
                var margin = 40;

                if (segLength > margin * 2 + 60) { // Минимум для объекта
                    segments.push({
                        wall: wall,
                        startPos: segStart.pos + margin,
                        endPos: segEnd.pos - margin,
                        startX: segStart.x + (segEnd.x - segStart.x) * (margin / segLength),
                        startY: segStart.y + (segEnd.y - segStart.y) * (margin / segLength),
                        endX: segEnd.x - (segEnd.x - segStart.x) * (margin / segLength),
                        endY: segEnd.y - (segEnd.y - segStart.y) * (margin / segLength),
                        length: segLength - margin * 2,
                        available: segLength - margin * 2, // Доступное пространство
                        objects: [] // Размещённые объекты
                    });
                }
            }
        }

        return segments;
    },

    // Хранилище сегментов для текущей генерации
    wallSegments: [],

    /**
     * Найти свободное место на сегменте для объекта
     * Возвращает позицию или null если места нет
     */
    findFreeSpotOnSegment: function(segment, objectSize) {
        var padding = 10; // Отступ между объектами
        var needed = objectSize + padding * 2;

        if (segment.available < needed) return null;

        // Если на сегменте ещё нет объектов
        if (segment.objects.length === 0) {
            return {
                pos: segment.startPos + segment.length / 2, // Центр сегмента
                localPos: segment.length / 2
            };
        }

        // Ищем свободный промежуток между объектами
        var sortedObjs = segment.objects.slice().sort(function(a, b) { return a.localPos - b.localPos; });

        // Проверяем начало сегмента
        var firstObjStart = sortedObjs[0].localPos - sortedObjs[0].size / 2;
        if (firstObjStart >= needed) {
            return {
                pos: segment.startPos + needed / 2,
                localPos: needed / 2
            };
        }

        // Проверяем промежутки между объектами
        for (var i = 0; i < sortedObjs.length - 1; i++) {
            var gapStart = sortedObjs[i].localPos + sortedObjs[i].size / 2 + padding;
            var gapEnd = sortedObjs[i + 1].localPos - sortedObjs[i + 1].size / 2 - padding;
            if (gapEnd - gapStart >= objectSize) {
                return {
                    pos: segment.startPos + (gapStart + gapEnd) / 2,
                    localPos: (gapStart + gapEnd) / 2
                };
            }
        }

        // Проверяем конец сегмента
        var lastObjEnd = sortedObjs[sortedObjs.length - 1].localPos + sortedObjs[sortedObjs.length - 1].size / 2;
        if (segment.length - lastObjEnd >= needed) {
            return {
                pos: segment.startPos + lastObjEnd + padding + objectSize / 2,
                localPos: lastObjEnd + padding + objectSize / 2
            };
        }

        return null;
    },

    /**
     * Разместить объект на сегменте (обновить доступное пространство)
     */
    placeObjectOnSegment: function(segment, localPos, objectSize) {
        segment.objects.push({
            localPos: localPos,
            size: objectSize
        });
        segment.available -= (objectSize + 20); // размер + отступы
    },

    /**
     * Получить сегменты для внешних стен
     */
    getOuterWallSegments: function() {
        var outerWallsSet = new Set(this.outerWalls);
        return this.wallSegments.filter(function(seg) {
            return outerWallsSet.has(seg.wall);
        });
    },

    /**
     * Получить сегменты для внутренних стен
     */
    getInnerWallSegments: function() {
        var innerWallsSet = new Set(this.innerWalls);
        return this.wallSegments.filter(function(seg) {
            return innerWallsSet.has(seg.wall);
        });
    },

    /**
     * Проверить, находится ли точка слишком близко к пересечению НА ЭТОЙ СТЕНЕ
     */
    isNearCornerOnWall: function(wall, x, y, minDistance) {
        minDistance = minDistance || 50;

        var wallDx = wall.end.x - wall.start.x;
        var wallDy = wall.end.y - wall.start.y;
        var wallLength = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
        if (wallLength < 1) return true;

        // Единичный вектор вдоль стены
        var ux = wallDx / wallLength;
        var uy = wallDy / wallLength;

        // Позиция точки вдоль стены (проекция)
        var pointProj = (x - wall.start.x) * ux + (y - wall.start.y) * uy;

        // Проверяем расстояние до начала и конца стены
        if (pointProj < minDistance || pointProj > wallLength - minDistance) {
            return true;
        }

        // Проверяем T-пересечения: где другие стены примыкают к этой
        for (var i = 0; i < WALLS.length; i++) {
            var otherWall = WALLS[i];
            if (otherWall === wall) continue;

            // Проверяем start другой стены
            if (this.isPointOnWall(otherWall.start, wall, 15)) {
                var proj = (otherWall.start.x - wall.start.x) * ux + (otherWall.start.y - wall.start.y) * uy;
                if (Math.abs(pointProj - proj) < minDistance) {
                    return true;
                }
            }

            // Проверяем end другой стены
            if (this.isPointOnWall(otherWall.end, wall, 15)) {
                var proj = (otherWall.end.x - wall.start.x) * ux + (otherWall.end.y - wall.start.y) * uy;
                if (Math.abs(pointProj - proj) < minDistance) {
                    return true;
                }
            }
        }

        return false;
    },

    /**
     * Проверить, находится ли точка слишком близко к существующему объекту НА ТОЙ ЖЕ СТЕНЕ
     */
    isNearExistingObjectOnWall: function(wall, x, y, objectSize) {
        var wallDx = wall.end.x - wall.start.x;
        var wallDy = wall.end.y - wall.start.y;
        var wallLength = Math.sqrt(wallDx * wallDx + wallDy * wallDy);
        if (wallLength < 1) return false;

        // Единичный вектор вдоль стены
        var ux = wallDx / wallLength;
        var uy = wallDy / wallLength;

        for (var i = 0; i < OBJDATA.length; i++) {
            var obj = OBJDATA[i];
            if (obj.family !== 'inWall') continue;

            // editor.obj2D сохраняет позицию как obj.x/obj.y, не obj.pos.x/obj.pos.y
            var objX = obj.x !== undefined ? obj.x : (obj.pos ? obj.pos.x : undefined);
            var objY = obj.y !== undefined ? obj.y : (obj.pos ? obj.pos.y : undefined);
            if (objX === undefined || objY === undefined) continue;

            // Проверяем, лежит ли объект на этой же стене
            // Проецируем позицию объекта на линию стены
            var ox = objX - wall.start.x;
            var oy = objY - wall.start.y;

            // Расстояние от объекта до линии стены (перпендикуляр)
            var perpDist = Math.abs(ox * (-uy) + oy * ux);

            // Если объект не на этой стене (далеко от линии), пропускаем
            if (perpDist > wall.thick + 5) continue;

            // Расстояние вдоль стены
            var projDist = ox * ux + oy * uy;

            // Проверяем, в пределах ли стены
            if (projDist < -10 || projDist > wallLength + 10) continue;

            // Теперь проверяем расстояние между центрами вдоль стены
            var newProjX = (x - wall.start.x) * ux + (y - wall.start.y) * uy;
            var distAlongWall = Math.abs(newProjX - projDist);

            // Минимальное расстояние = половины размеров обоих объектов + отступ
            var minDist = (obj.size || 60) / 2 + objectSize / 2 + 20;

            if (distAlongWall < minDist) {
                return true;
            }
        }
        return false;
    },

    /**
     * Получить безопасную позицию на стене (не на углах)
     */
    getSafeWallPosition: function(wall, objectSize) {
        var dx = wall.end.x - wall.start.x;
        var dy = wall.end.y - wall.start.y;
        var wallLength = Math.sqrt(dx * dx + dy * dy);

        // Минимальный отступ от краёв стены
        var minOffset = objectSize / 2 + 30;

        if (wallLength < minOffset * 2 + objectSize) {
            return null; // Стена слишком короткая
        }

        // Безопасный диапазон позиций (от 0 до 1)
        var minPos = minOffset / wallLength;
        var maxPos = 1 - minOffset / wallLength;

        return {
            min: minPos,
            max: maxPos,
            random: this.utils.randomFloat(minPos, maxPos)
        };
    },

    /**
     * Найти пересечения горизонтальной линии с полигоном
     */
    findHorizontalIntersections: function(y, polygon) {
        var intersections = [];
        for (var i = 0; i < polygon.length; i++) {
            var p1 = polygon[i];
            var p2 = polygon[(i + 1) % polygon.length];

            if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
                var x = p1.x + (y - p1.y) * (p2.x - p1.x) / (p2.y - p1.y);
                intersections.push(x);
            }
        }
        intersections.sort(function(a, b) { return a - b; });
        return intersections;
    },

    /**
     * Найти пересечения вертикальной линии с полигоном
     */
    findVerticalIntersections: function(x, polygon) {
        var intersections = [];
        for (var i = 0; i < polygon.length; i++) {
            var p1 = polygon[i];
            var p2 = polygon[(i + 1) % polygon.length];

            if ((p1.x <= x && p2.x > x) || (p2.x <= x && p1.x > x)) {
                var y = p1.y + (x - p1.x) * (p2.y - p1.y) / (p2.x - p1.x);
                intersections.push(y);
            }
        }
        intersections.sort(function(a, b) { return a - b; });
        return intersections;
    },

    /**
     * Создать дверь на стене
     */
    createDoor: function(wall, position, doorType, doorSize) {
        doorType = doorType || 'simple';
        doorSize = doorSize || this.defaults.doorSize;

        var dx = wall.end.x - wall.start.x;
        var dy = wall.end.y - wall.start.y;
        var wallLength = Math.sqrt(dx * dx + dy * dy);

        if (wallLength < doorSize + 80) return null;

        // Получаем безопасную позицию (не на углах)
        var safePos = this.getSafeWallPosition(wall, doorSize);
        if (!safePos) return null;

        // Ограничиваем позицию безопасным диапазоном
        var safePosition = Math.max(safePos.min, Math.min(safePos.max, position));

        var posX = wall.start.x + dx * safePosition;
        var posY = wall.start.y + dy * safePosition;

        // Проверяем, не слишком ли близко к пересечению на этой стене
        if (this.isNearCornerOnWall(wall, posX, posY, doorSize / 2 + 30)) {
            return null;
        }

        // Проверяем, не пересекается ли с существующими объектами на этой стене
        if (this.isNearExistingObjectOnWall(wall, posX, posY, doorSize)) {
            return null;
        }

        var angleWall = Math.atan2(dy, dx) * (180 / Math.PI);

        var door = new editor.obj2D(
            "inWall", "doorWindow", doorType,
            { x: posX, y: posY },
            angleWall, 0, doorSize, "normal", wall.thick, null
        );

        var halfSize = doorSize / 2;
        var unitX = dx / wallLength;
        var unitY = dy / wallLength;
        door.limit = [
            { x: posX - unitX * halfSize, y: posY - unitY * halfSize },
            { x: posX + unitX * halfSize, y: posY + unitY * halfSize }
        ];

        door.update();
        OBJDATA.push(door);
        $('#boxcarpentry').append(door.graph);

        return door;
    },

    /**
     * Создать проём (aperture) - отсутствие стены
     */
    createAperture: function(wall, position, size) {
        size = size || 80;
        return this.createDoor(wall, position, 'aperture', size);
    },

    /**
     * Создать окно ТОЛЬКО на внешней стене
     */
    createWindow: function(wall, position, windowType, windowSize) {
        // Проверяем, что это внешняя стена
        if (!wall.isOuter) {
            return null;
        }

        windowType = windowType || 'fix';
        windowSize = windowSize || this.defaults.windowSizeSmall;

        var dx = wall.end.x - wall.start.x;
        var dy = wall.end.y - wall.start.y;
        var wallLength = Math.sqrt(dx * dx + dy * dy);

        if (wallLength < windowSize + 80) return null;

        // Получаем безопасную позицию (не на углах)
        var safePos = this.getSafeWallPosition(wall, windowSize);
        if (!safePos) return null;

        // Ограничиваем позицию безопасным диапазоном
        var safePosition = Math.max(safePos.min, Math.min(safePos.max, position));

        var posX = wall.start.x + dx * safePosition;
        var posY = wall.start.y + dy * safePosition;

        // Проверяем, не слишком ли близко к пересечению на этой стене
        if (this.isNearCornerOnWall(wall, posX, posY, windowSize / 2 + 30)) {
            return null;
        }

        // Проверяем, не пересекается ли с существующими объектами на этой стене
        if (this.isNearExistingObjectOnWall(wall, posX, posY, windowSize)) {
            return null;
        }

        var angleWall = Math.atan2(dy, dx) * (180 / Math.PI);

        var window = new editor.obj2D(
            "inWall", "doorWindow", windowType,
            { x: posX, y: posY },
            angleWall, 0, windowSize, "normal", wall.thick, null
        );

        var halfSize = windowSize / 2;
        var unitX = dx / wallLength;
        var unitY = dy / wallLength;
        window.limit = [
            { x: posX - unitX * halfSize, y: posY - unitY * halfSize },
            { x: posX + unitX * halfSize, y: posY + unitY * halfSize }
        ];

        window.update();
        OBJDATA.push(window);
        $('#boxcarpentry').append(window.graph);

        return window;
    },

    /**
     * Создать объект на сегменте (новый подход через граф)
     */
    createObjectOnSegment: function(segment, objectType, objectClass, objectSize) {
        // Ищем свободное место на сегменте
        var spot = this.findFreeSpotOnSegment(segment, objectSize);
        if (!spot) return null;

        var wall = segment.wall;
        var dx = wall.end.x - wall.start.x;
        var dy = wall.end.y - wall.start.y;
        var wallLength = this.utils.distance(wall.start, wall.end);

        // Позиция вдоль стены (0-1)
        var t = spot.pos / wallLength;
        var posX = wall.start.x + dx * t;
        var posY = wall.start.y + dy * t;

        var angleWall = Math.atan2(dy, dx) * (180 / Math.PI);

        var obj = new editor.obj2D(
            "inWall", objectClass, objectType,
            { x: posX, y: posY },
            angleWall, 0, objectSize, "normal", wall.thick || 10, null
        );

        var halfSize = objectSize / 2;
        var unitX = dx / wallLength;
        var unitY = dy / wallLength;
        obj.limit = [
            { x: posX - unitX * halfSize, y: posY - unitY * halfSize },
            { x: posX + unitX * halfSize, y: posY + unitY * halfSize }
        ];

        obj.update();
        OBJDATA.push(obj);
        $('#boxcarpentry').append(obj.graph);

        // Обновляем сегмент
        this.placeObjectOnSegment(segment, spot.localPos, objectSize);

        return obj;
    },

    /**
     * Добавить окна только на внешние стены (через сегменты)
     */
    addWindowsToOuterWalls: function(windowCount) {
        windowCount = windowCount || 6;

        // Получаем сегменты внешних стен
        var segments = this.getOuterWallSegments();
        if (segments.length === 0) return 0;

        var placed = 0;

        // Перемешиваем сегменты для случайности
        segments = this.utils.shuffle(segments);

        for (var i = 0; i < segments.length && placed < windowCount; i++) {
            var segment = segments[i];

            // Сколько окон можно разместить на этом сегменте
            var windowsOnSegment = Math.floor(segment.available / 100); // ~100px на окно
            windowsOnSegment = Math.min(windowsOnSegment, windowCount - placed, 3);

            for (var w = 0; w < windowsOnSegment; w++) {
                var windowType, windowSize;
                if (Math.random() > 0.6) {
                    windowType = 'twin';
                    windowSize = this.defaults.windowSizeLarge;
                } else {
                    windowType = 'fix';
                    windowSize = this.defaults.windowSizeSmall;
                }

                if (this.createObjectOnSegment(segment, windowType, 'doorWindow', windowSize)) {
                    placed++;
                }
            }
        }

        return placed;
    },

    /**
     * Добавить двери между комнатами (через сегменты)
     */
    addDoorsToInnerWalls: function() {
        var segments = this.getInnerWallSegments();
        if (segments.length === 0) return 0;

        var placed = 0;

        for (var i = 0; i < segments.length; i++) {
            var segment = segments[i];

            // Одна дверь/проём на сегмент
            var useAperture = Math.random() > 0.7;
            var doorType, doorSize;

            if (useAperture) {
                doorType = 'aperture';
                doorSize = this.utils.random(80, 120);
            } else {
                doorType = this.doorTypes[this.utils.random(0, this.doorTypes.length - 1)];
                doorSize = (doorType === 'double') ? 100 : 70;
            }

            if (this.createObjectOnSegment(segment, doorType, 'doorWindow', doorSize)) {
                placed++;
            }
        }

        return placed;
    },

    /**
     * Добавить входную дверь на внешнюю стену
     */
    addEntranceDoor: function() {
        // Ищем подходящую внешнюю стену для входа
        var suitableWalls = this.outerWalls.filter(function(wall) {
            var length = Math.sqrt(
                Math.pow(wall.end.x - wall.start.x, 2) +
                Math.pow(wall.end.y - wall.start.y, 2)
            );
            return length > 150;
        });

        // Пробуем разместить дверь с несколькими попытками
        var shuffled = this.utils.shuffle(suitableWalls);
        for (var i = 0; i < shuffled.length; i++) {
            var wall = shuffled[i];
            // Пробуем несколько позиций
            for (var retry = 0; retry < 5; retry++) {
                var position = this.utils.randomFloat(0.3, 0.7);
                if (this.createDoor(wall, position, 'simple', 90)) {
                    return true;
                }
            }
        }
        return false;
    },

    /**
     * Добавить электрику
     */
    addEnergy: function(shape) {
        var bbox = this.getBoundingBox(shape);

        // Несколько розеток по периметру
        var plugCount = this.utils.random(4, 8);
        for (var i = 0; i < plugCount; i++) {
            var x = this.utils.snapToGrid(
                bbox.minX + bbox.width * Math.random(),
                this.defaults.gridSnap
            );
            var y = this.utils.snapToGrid(
                bbox.minY + bbox.height * Math.random(),
                this.defaults.gridSnap
            );

            if (this.pointInPolygon({ x: x, y: y }, shape)) {
                this.createEnergyObject(x, y, 'plug');
            }
        }

        // Выключатели
        var switchCount = this.utils.random(2, 4);
        for (var i = 0; i < switchCount; i++) {
            var x = this.utils.snapToGrid(
                bbox.minX + bbox.width * Math.random(),
                this.defaults.gridSnap
            );
            var y = this.utils.snapToGrid(
                bbox.minY + bbox.height * Math.random(),
                this.defaults.gridSnap
            );

            if (this.pointInPolygon({ x: x, y: y }, shape)) {
                this.createEnergyObject(x, y, 'switch');
            }
        }

        // Радиаторы под окнами (примерно)
        for (var i = 0; i < this.outerWalls.length; i++) {
            var wall = this.outerWalls[i];
            if (Math.random() > 0.6) {
                var midX = (wall.start.x + wall.end.x) / 2;
                var midY = (wall.start.y + wall.end.y) / 2;
                // Смещаем внутрь
                midX += (wall.start.y === wall.end.y) ? 0 : 30;
                midY += (wall.start.x === wall.end.x) ? 0 : 30;

                if (this.pointInPolygon({ x: midX, y: midY }, shape)) {
                    this.createEnergyObject(midX, midY, 'radiator');
                }
            }
        }
    },

    /**
     * Создать объект электрики
     */
    createEnergyObject: function(x, y, type, angle) {
        angle = angle || 0;

        var obj = new editor.obj2D(
            "free", "energy", type,
            { x: x, y: y },
            angle, 0, 0, "normal", 0, null
        );

        obj.update();
        OBJDATA.push(obj);
        $('#boxEnergy').append(obj.graph);

        return obj;
    },

    /**
     * Главная функция генерации
     */
    generate: function(config) {
        config = config || {};

        var width = config.width || 720;
        var height = config.height || 540;
        var shapeType = config.shapeType || null; // null = случайный
        var windowCount = config.windowCount || 6;
        var addEnergy = config.addEnergy !== false;
        var animateSteps = config.animateSteps === true;
        var stepDelay = config.stepDelayMs || 100;
        var concaveChance = (config.concaveChance !== undefined) ? config.concaveChance : this.defaults.concaveChance;

        console.log('=== GENERATOR DEBUG ===');

        // 1. Очистка
        this.clearFloorplan();

        // 2. Генерация формы здания
        var shape = this.generateBuildingShape(width, height, shapeType, concaveChance);
        console.log('Shape points:', shape.length);

        // 3. Создание внешних стен (несущие)
        this.createOuterWallsFromShape(shape, this.defaults.loadBearingWallThick);
        console.log('After outer walls: WALLS=' + WALLS.length + ', outerWalls=' + this.outerWalls.length);

        // 4. Создание внутренних перегородок
        this.createInnerPartitions(shape);
        console.log('After inner walls: WALLS=' + WALLS.length + ', innerWalls=' + this.innerWalls.length);

        // Проверка структуры стен
        if (this.innerWalls.length > 0) {
            var testWall = this.innerWalls[0];
            console.log('Test inner wall:', testWall ? 'exists' : 'null',
                        'thick=' + (testWall ? testWall.thick : 'N/A'),
                        'start=' + (testWall && testWall.start ? JSON.stringify(testWall.start) : 'N/A'));
        }

        // 5. Перестраиваем геометрию
        editor.architect(WALLS);
        console.log('After architect: WALLS=' + WALLS.length);

        // 6. Строим граф сегментов стен (между пересечениями)
        this.wallSegments = this.buildWallSegments();
        console.log('Wall segments built:', this.wallSegments.length);

        // 7. Добавляем входную дверь (на внешние сегменты)
        var outerSegments = this.getOuterWallSegments();
        var entranceResult = false;
        if (outerSegments.length > 0) {
            var shuffled = this.utils.shuffle(outerSegments);
            for (var i = 0; i < shuffled.length && !entranceResult; i++) {
                if (this.createObjectOnSegment(shuffled[i], 'simple', 'doorWindow', 90)) {
                    entranceResult = true;
                }
            }
        }
        console.log('Entrance door:', entranceResult);

        // 8. Добавляем двери/проёмы между комнатами
        var doorsResult = this.addDoorsToInnerWalls();
        console.log('Inner doors placed:', doorsResult);

        // 9. Добавляем окна ТОЛЬКО на внешние стены
        var windowsResult = this.addWindowsToOuterWalls(windowCount);
        console.log('Windows placed:', windowsResult, '(requested:', windowCount + ')');

        // 10. Электрика
        if (addEnergy) {
            this.addEnergy(shape);
        }

        // 11. Финальное обновление
        editor.architect(WALLS);

        // 12. Сохранение
        save();

        // 13. Пошаговая анимация появления элементов
        if (animateSteps) {
            this.animateSpawn(stepDelay);
        }

        console.log('=== FINAL: OBJDATA=' + OBJDATA.length + ' ===');

        return {
            shape: shapeType,
            wallCount: WALLS.length,
            outerWalls: this.outerWalls.length,
            innerWalls: this.innerWalls.length,
            objectCount: OBJDATA.length
        };
    },

    /**
     * Плавное поочерёдное появление всех сгенерированных элементов
     * delayMs — задержка между объектами
     */
    animateSpawn: function(delayMs) {
        delayMs = delayMs || 100;
        var selectors = [
            '#boxwall > *',
            '#boxRoom > *',
            '#boxSurface > *',
            '#boxcarpentry > *',
            '#boxEnergy > *',
            '#boxFurniture > *',
            '#boxArea > *',
            '#boxDebug > *'
        ];

        var nodes = [];
        selectors.forEach(function(sel) {
            nodes = nodes.concat($(sel).toArray());
        });

        nodes.forEach(function(node) {
            var $n = $(node);
            $n.css('opacity', 0);
            // если уже есть transition, не затираем
            var existing = $n.css('transition');
            if (!existing || existing === 'all 0s ease 0s') {
                $n.css('transition', 'opacity 0.08s ease-out');
            }
        });

        nodes.forEach(function(node, idx) {
            setTimeout(function() {
                $(node).css('opacity', 1);
            }, delayMs * idx);
        });
    }
};

// Быстрые команды
function generateFloorplan(config) {
    return FloorplanGenerator.generate(config);
}

function clearFloorplan() {
    FloorplanGenerator.clearFloorplan();
}

console.log('FloorplanGenerator v2 loaded. Shapes: L, T, U, angled, irregular');
