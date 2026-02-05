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

  this.clear();

  var data = this.generator.generate(numNodes, this.kMeans);
  this.nodes = data.nodes;
  this.edges = data.edges;

  this.graph.render(this.nodes, this.edges);

  var segments = this.areaEstimator.render(this.nodes, this.edges);
  this.areaSegments = segments;

  var spawned = this.wallSpawner.buildFromSegments(segments);
  this.builtWalls = spawned.walls;
  this.builtPawns = spawned.pawns;

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
