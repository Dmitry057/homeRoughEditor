/**
 * graphGenerator.js
 * Responsible for producing noisy nodes and k-nearest edges for the generator.
 */

function GraphGenerator(config) {
  this.config = config || {};
}

GraphGenerator.prototype.generate = function (numNodes, kMeans) {
  var cfg = this.config;
  var nodes = [];
  var edges = [];

  // 1) Spawn noisy points around the center
  for (var i = 0; i < numNodes; i++) {
    var baseAngle = (Math.PI * 2 * i) / numNodes;
    var angleNoise = (this._noise(i, 0) - 0.5) * (cfg.jitterAngle || 0) * 2;
    var angle = baseAngle + angleNoise;

    var baseRadius = cfg.minRadius + (this._noise(i, 50) * (cfg.maxRadius - cfg.minRadius));
    var radialMul = 1 + (this._noise(i, 100) - 0.5) * (cfg.radialNoise || 0) * 2;
    var radius = baseRadius * radialMul;

    var warpX = (this._noise(i, 150) - 0.5) * (cfg.noiseAmount || 0) * 0.01;
    var warpY = (this._noise(i, 200) - 0.5) * (cfg.noiseAmount || 0) * 0.01;

    nodes.push({
      id: i,
      x: cfg.centerX + Math.cos(angle) * radius + warpX,
      y: cfg.centerY + Math.sin(angle) * radius + warpY,
      label: 'N' + i
    });
  }

  // 2) Connect k nearest neighbors (undirected, no duplicates)
  var k = Math.min(Math.max(1, parseInt(kMeans, 10) || 1), numNodes - 1);
  var edgeMap = {};

  for (var n = 0; n < nodes.length; n++) {
    var node = nodes[n];
    var distances = [];
    for (var m = 0; m < nodes.length; m++) {
      if (m === n) continue;
      var other = nodes[m];
      var dx = node.x - other.x;
      var dy = node.y - other.y;
      distances.push({ id: other.id, dist2: dx * dx + dy * dy });
    }
    distances.sort(function (a, b) { return a.dist2 - b.dist2; });

    for (var j = 0; j < k && j < distances.length; j++) {
      var toId = distances[j].id;
      var a = Math.min(node.id, toId);
      var b = Math.max(node.id, toId);
      var key = a + '-' + b;
      if (!edgeMap[key]) {
        edgeMap[key] = true;
        edges.push({ from: a, to: b });
      }
    }
  }

  return { nodes: nodes, edges: edges };
};

// Wrapper around user-provided noise; falls back to Math.random if unavailable
GraphGenerator.prototype._noise = function (x, y) {
  if (typeof orgBlenderNoise === 'function') {
    return orgBlenderNoise(
      x * (this.config.noiseSize || 0.25),
      y * (this.config.noiseSize || 0.25),
      this.config.noiseNabla || 0.03
    );
  }
  return Math.random();
};
