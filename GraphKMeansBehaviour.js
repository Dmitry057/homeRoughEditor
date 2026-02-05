/**
 * GraphKMeansBehaviour
 * Orchestrates graph generation, area estimation, and wall spawning.
 */

function GraphKMeansBehaviour(options) {
  options = options || {};
  var spawnOffsetX = options.spawnOffsetX !== undefined ? options.spawnOffsetX : 220;
  var spawnOffsetY = options.spawnOffsetY !== undefined ? options.spawnOffsetY : 0;

  this.config = {
    centerX: options.centerX || (originX_viewbox + width_viewbox / 2 + spawnOffsetX),
    centerY: options.centerY || (originY_viewbox + height_viewbox / 2 + spawnOffsetY),
    minRadius: options.minRadius || 120,
    maxRadius: options.maxRadius || 260,
    jitterAngle: options.jitterAngle || 0.6,
    radialNoise: options.radialNoise || 0.35,
    nodeRadius: options.nodeRadius || 8,
    noiseAmount: options.noiseAmount || 1000,
    noiseSize: options.noiseSize || 0.25,
    noiseNabla: options.noiseNabla || 0.03,
    layerId: options.layerId || 'boxDebug',
    spawnOffsetX: spawnOffsetX,
    spawnOffsetY: spawnOffsetY,
    rectPadding: options.rectPadding || 10,
    rectStroke: options.rectStroke || '#ff7a00',
    rectStrokeWidth: options.rectStrokeWidth || 2,
    rectFill: options.rectFill || 'rgba(255,122,0,0.08)',
    rectMinOverlap: options.rectMinOverlap || 1
  };

  this.kMeans = options.kMeans || 3;
  this.wallThickness = options.wallThickness || 20;

  this.nodes = [];
  this.edges = [];
  this.builtWalls = [];
  this.builtPawns = [];

  this.generator = new GraphGenerator(this.config);
  this.areaEstimator = new AreaEstimator(this.config);
  this.wallSpawner = new WallSpawner({ wallThickness: this.wallThickness });
  this.graph = new Graph({ layerId: this.config.layerId, nodeRadius: this.config.nodeRadius });
}

GraphKMeansBehaviour.prototype.generate = function (numNodes, kMeans) {
  numNodes = Math.max(2, parseInt(numNodes, 10) || 5);
  this.kMeans = kMeans !== undefined ? kMeans : this.kMeans;

  console.log('%c=== Pipeline Start ===', 'background: #222; color: #bada55; font-size: 14px;');
  console.time('🔷 TOTAL pipeline');

  console.time('1️⃣ Clear previous');
  this.clear();
  console.timeEnd('1️⃣ Clear previous');

  console.time('2️⃣ Generate graph (nodes + edges)');
  var data = this.generator.generate(numNodes, this.kMeans);
  this.nodes = data.nodes;
  this.edges = data.edges;
  console.timeEnd('2️⃣ Generate graph (nodes + edges)');
  console.log('   Nodes:', this.nodes.length, 'Edges:', this.edges.length);

  console.time('3️⃣ Render graph visualization');
  this.graph.render(this.nodes, this.edges);
  console.timeEnd('3️⃣ Render graph visualization');

  console.time('4️⃣ Area estimator (rectangles + union)');
  var segments = this.areaEstimator.render(this.nodes, this.edges);
  this.areaSegments = segments;
  console.timeEnd('4️⃣ Area estimator (rectangles + union)');
  console.log('   Segments:', segments ? segments.length : 0);

  // console.time('4.5️⃣ Render intersections (green)');
  // this.areaEstimator.renderIntersections();
  // console.timeEnd('4.5️⃣ Render intersections (green)');

  console.time('5️⃣ Wall spawner (build walls)');
  var spawned = this.wallSpawner.buildFromSegments(segments);
  this.builtWalls = spawned.walls;
  this.builtPawns = spawned.pawns;
  console.timeEnd('5️⃣ Wall spawner (build walls)');
  console.log('   Walls:', this.builtWalls.length);

  console.timeEnd('🔷 TOTAL pipeline');
  console.log('%c=== Pipeline End ===', 'background: #222; color: #bada55; font-size: 14px;');

  return {
    nodes: this.nodes,
    edges: this.edges,
    kMeans: this.kMeans
  };
};

GraphKMeansBehaviour.prototype.clear = function () {
  this.wallSpawner.clearWalls(this.builtWalls);
  this.builtWalls = [];
  this.builtPawns = [];
  this.areaEstimator.clear();
  this.areaSegments = [];
  this.nodes = [];
  this.edges = [];
  if (this.graph) {
    this.graph.clear();
  }
};

GraphKMeansBehaviour.prototype.destroy = function () {
  this.clear();
  if (this.graph) this.graph.destroy();
};
