/**
 * Bulwark v2.1 — Chart.js Helper System
 * Dark glass theme with gradient fills, smooth curves, vibrant colors
 */

(function () {
  'use strict';

  var Charts = {};

  // ── Chart Instance Registry ──
  Charts.instances = {};

  // ── Color Presets (vibrant on dark) ──
  Charts.colors = {
    cyan:    '#22d3ee',
    orange:  '#ff6b2b',
    purple:  '#a78bfa',
    blue:    '#3b82f6',
    yellow:  '#eab308',
    pink:    '#ec4899',
    lime:    '#84cc16',
    rose:    '#f43f5e',
    emerald: '#34d399',
    amber:   '#f59e0b'
  };

  // ── Gradient palette for multi-dataset charts ──
  Charts.palette = ['#ec4899', '#22d3ee', '#84cc16', '#a78bfa', '#f59e0b', '#34d399', '#f43f5e', '#3b82f6'];

  // ── Dark Theme Grid (near-invisible) ──
  var gridColor = 'rgba(255, 255, 255, 0.04)';
  var tickColor = 'rgba(255, 255, 255, 0.25)';
  var borderColor = 'rgba(255, 255, 255, 0.06)';

  /**
   * Create a Chart.js chart
   */
  Charts.create = function (canvasId, type, config) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    if (Charts.instances[canvasId]) {
      Charts.instances[canvasId].destroy();
      delete Charts.instances[canvasId];
    }

    var ctx = canvas.getContext('2d');

    var defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10, 11, 16, 0.92)',
          titleColor: '#e4e4e7',
          bodyColor: '#a1a1aa',
          borderColor: 'rgba(34, 211, 238, 0.2)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: "'JetBrains Mono', monospace", size: 11, weight: '600' },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 4,
          usePointStyle: true
        }
      },
      scales: {}
    };

    if (type === 'line' || type === 'bar') {
      defaultOptions.scales = {
        x: {
          grid: { color: gridColor, drawBorder: false },
          border: { color: borderColor },
          ticks: {
            color: tickColor,
            font: { family: "'JetBrains Mono', monospace", size: 9 },
            maxRotation: 0,
            maxTicksLimit: 8
          }
        },
        y: {
          grid: { color: gridColor, drawBorder: false },
          border: { color: borderColor },
          ticks: {
            color: tickColor,
            font: { family: "'JetBrains Mono', monospace", size: 9 },
            maxTicksLimit: 5,
            padding: 8
          }
        }
      };
    }

    var mergedOptions = deepMerge(defaultOptions, (config && config.options) || {});

    var chartConfig = {
      type: type,
      data: (config && config.data) || { labels: [], datasets: [] },
      options: mergedOptions
    };

    if (config && config.plugins) chartConfig.plugins = config.plugins;

    var chart = new Chart(ctx, chartConfig);
    Charts.instances[canvasId] = chart;
    return chart;
  };

  /**
   * Update an existing chart's data
   */
  Charts.update = function (canvasId, labels, datasets) {
    var chart = Charts.instances[canvasId];
    if (!chart) return;
    if (labels) chart.data.labels = labels;
    if (datasets && Array.isArray(datasets)) {
      for (var i = 0; i < datasets.length; i++) {
        if (chart.data.datasets[i]) {
          Object.keys(datasets[i]).forEach(function (key) {
            chart.data.datasets[i][key] = datasets[i][key];
          });
        } else {
          chart.data.datasets.push(datasets[i]);
        }
      }
    }
    chart.update({ duration: 0 });
  };

  /**
   * Append a single data point to a chart dataset
   */
  Charts.appendPoint = function (canvasId, label, value, maxPoints) {
    var chart = Charts.instances[canvasId];
    if (!chart) return;
    maxPoints = maxPoints || 30;
    chart.data.labels.push(label);
    if (chart.data.labels.length > maxPoints) chart.data.labels.shift();
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        if (chart.data.datasets[i]) {
          chart.data.datasets[i].data.push(value[i]);
          if (chart.data.datasets[i].data.length > maxPoints) chart.data.datasets[i].data.shift();
        }
      }
    } else {
      if (chart.data.datasets[0]) {
        chart.data.datasets[0].data.push(value);
        if (chart.data.datasets[0].data.length > maxPoints) chart.data.datasets[0].data.shift();
      }
    }
    chart.update({ duration: 0 });
  };

  /**
   * Destroy a chart instance
   */
  Charts.destroy = function (canvasId) {
    var chart = Charts.instances[canvasId];
    if (chart) { chart.destroy(); delete Charts.instances[canvasId]; }
  };

  /**
   * Default line dataset config — smooth curve with rich gradient fill
   * Matches the Autonomous Brain chart style
   */
  Charts.defaultLineConfig = function (color) {
    return {
      borderColor: color,
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: color,
      pointHoverBorderColor: '#0a0b10',
      pointHoverBorderWidth: 2,
      fill: true,
      backgroundColor: function (context) {
        if (!context.chart || !context.chart.ctx) return 'transparent';
        var c = context.chart.ctx;
        var area = context.chart.chartArea;
        if (!area) return 'transparent';
        var g = c.createLinearGradient(0, area.top, 0, area.bottom);
        g.addColorStop(0, hexToRgba(color, 0.35));
        g.addColorStop(0.6, hexToRgba(color, 0.08));
        g.addColorStop(1, hexToRgba(color, 0.0));
        return g;
      }
    };
  };

  /**
   * Area chart config — even richer fill for single-metric charts
   */
  Charts.areaConfig = function (color) {
    return {
      borderColor: color,
      borderWidth: 2.5,
      tension: 0.45,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: '#0a0b10',
      pointHoverBorderColor: color,
      pointHoverBorderWidth: 2.5,
      fill: true,
      backgroundColor: function (context) {
        if (!context.chart || !context.chart.ctx) return 'transparent';
        var c = context.chart.ctx;
        var area = context.chart.chartArea;
        if (!area) return 'transparent';
        var g = c.createLinearGradient(0, area.top, 0, area.bottom);
        g.addColorStop(0, hexToRgba(color, 0.45));
        g.addColorStop(0.5, hexToRgba(color, 0.15));
        g.addColorStop(1, hexToRgba(color, 0.0));
        return g;
      }
    };
  };

  /**
   * Default bar dataset config — glass-style bars
   */
  Charts.defaultBarConfig = function (color) {
    return {
      backgroundColor: function (context) {
        if (!context.chart || !context.chart.ctx) return hexToRgba(color, 0.6);
        var c = context.chart.ctx;
        var area = context.chart.chartArea;
        if (!area) return hexToRgba(color, 0.6);
        var g = c.createLinearGradient(0, area.bottom, 0, area.top);
        g.addColorStop(0, hexToRgba(color, 0.2));
        g.addColorStop(1, hexToRgba(color, 0.7));
        return g;
      },
      borderColor: hexToRgba(color, 0.8),
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: false,
      hoverBackgroundColor: hexToRgba(color, 0.85),
      hoverBorderColor: color
    };
  };

  /**
   * Doughnut/pie config with glass-compatible colors
   */
  Charts.doughnutConfig = function (colors) {
    colors = colors || [Charts.colors.cyan, Charts.colors.purple, Charts.colors.pink, Charts.colors.amber, Charts.colors.emerald];
    return {
      backgroundColor: colors.map(function (c) { return hexToRgba(c, 0.7); }),
      borderColor: colors.map(function (c) { return hexToRgba(c, 0.9); }),
      borderWidth: 1,
      hoverBackgroundColor: colors,
      hoverBorderColor: '#0a0b10',
      hoverBorderWidth: 2,
      hoverOffset: 4
    };
  };

  // ── Utility Functions ──

  function hexToRgba(hex, alpha) {
    if (!hex || hex.charAt(0) !== '#') return hex;
    var r, g, b;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    }
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // Expose for external use
  Charts.hexToRgba = hexToRgba;

  function deepMerge(target, source) {
    var result = {};
    var key;
    for (key in target) {
      if (target.hasOwnProperty(key)) result[key] = target[key];
    }
    for (key in source) {
      if (source.hasOwnProperty(key)) {
        if (isPlainObject(source[key]) && isPlainObject(result[key])) {
          result[key] = deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    return result;
  }

  function isPlainObject(val) {
    return val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Function);
  }

  // ── Expose Globally ──
  window.Charts = Charts;

})();
