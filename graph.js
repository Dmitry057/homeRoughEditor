/**
 * graph.js
 * Lightweight helper to store and render simple graphs on the editor SVG.
 * Uses qSVG to draw into an existing layer (defaults to #boxDebug).
 */

function Graph(options) {
  options = options || {};

  this.layerId = options.layerId || 'boxDebug';
  this.groupId = options.groupId || 'graph-layer';

  this.nodeRadius = options.nodeRadius || 8;
  this.nodeFill = options.nodeFill || '#0d6efd';
  this.centerFill = options.centerFill || '#f7c32e';
  this.edgeColor = options.edgeColor || '#0abfbc';
  this.edgeWidth = options.edgeWidth || 3;
  this.labelColor = options.labelColor || '#333';
  this.labelSize = options.labelSize || 11;

  this.nodes = [];
  this.edges = [];
}

Graph.prototype.setData = function (nodes, edges) {
  this.nodes = nodes || [];
  this.edges = edges || [];
  return this;
};

Graph.prototype.clear = function () {
  var existing = $('#' + this.groupId);
  if (existing && existing.length) {
    existing.remove();
  }
};

Graph.prototype.render = function (nodes, edges) {
  if (nodes) this.nodes = nodes;
  if (edges) this.edges = edges;

  this.clear();

  // Container group for easy cleanup
  qSVG.create(this.layerId, 'g', { id: this.groupId });

  // Draw edges first (so nodes sit on top)
  for (var i = 0; i < this.edges.length; i++) {
    var edge = this.edges[i];
    var from = this._getNode(edge.from);
    var to = this._getNode(edge.to);
    if (!from || !to) continue;

    qSVG.create(this.groupId, 'line', {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      stroke: this.edgeColor,
      'stroke-width': this.edgeWidth,
      'stroke-linecap': 'round',
      'pointer-events': 'none',
      opacity: 0.9
    });
  }

  // Draw nodes with simple labels
  for (var n = 0; n < this.nodes.length; n++) {
    var node = this.nodes[n];
    var fill = node.isCenter ? this.centerFill : this.nodeFill;

    qSVG.create(this.groupId, 'circle', {
      cx: node.x,
      cy: node.y,
      r: this.nodeRadius,
      fill: fill,
      stroke: '#fff',
      'stroke-width': 2,
      'pointer-events': 'none',
      opacity: 0.95
    });

    qSVG.create(this.groupId, 'text', {
      x: node.x,
      y: node.y - (this.nodeRadius + 6),
      'text-anchor': 'middle',
      'font-size': this.labelSize + 'px',
      fill: this.labelColor,
      'pointer-events': 'none'
    })[0].textContent = node.label || ('N' + node.id);
  }

  return this;
};

Graph.prototype._getNode = function (id) {
  for (var i = 0; i < this.nodes.length; i++) {
    if (this.nodes[i].id === id) return this.nodes[i];
  }
  return null;
};

Graph.prototype.destroy = function () {
  this.clear();
  this.nodes = [];
  this.edges = [];
};
