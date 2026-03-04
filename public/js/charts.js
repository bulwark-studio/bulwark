/**
 * Chester Dev Monitor v2.0 — Chart.js Helper System
 * Global Charts object for creating, updating, and managing Chart.js instances
 */

(function () {
  'use strict';

  var Charts = {};

  // ── Chart Instance Registry ──
  Charts.instances = {};

  // ── Color Presets ──
  Charts.colors = {
    cyan: '#22d3ee',
    orange: '#ff6b2b',
    purple: '#a78bfa',
    blue: '#3b82f6',
    yellow: '#eab308'
  };

  // ── Default Dark Theme Config ──
  var darkGridColor = 'rgba(255, 255, 255, 0.06)';
  var darkTickColor = 'rgba(255, 255, 255, 0.3)';
  var darkBorderColor = 'rgba(255, 255, 255, 0.08)';

  /**
   * Create a Chart.js chart
   * @param {string} canvasId - The canvas element ID
   * @param {string} type - Chart type: 'line', 'bar', 'doughnut', etc.
   * @param {Object} config - Chart.js configuration (data, options, plugins)
   * @returns {Chart|null} Chart.js instance or null if canvas not found
   */
  Charts.create = function (canvasId, type, config) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn('[Charts] Canvas not found:', canvasId);
      return null;
    }

    // Destroy existing instance on same canvas
    if (Charts.instances[canvasId]) {
      Charts.instances[canvasId].destroy();
      delete Charts.instances[canvasId];
    }

    var ctx = canvas.getContext('2d');

    // Merge default options with provided config
    var defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 300
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(15, 17, 23, 0.95)',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 8,
          cornerRadius: 6,
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          displayColors: false
        }
      },
      scales: {}
    };

    // Apply dark grid styling for cartesian charts
    if (type === 'line' || type === 'bar') {
      defaultOptions.scales = {
        x: {
          grid: {
            color: darkGridColor,
            borderColor: darkBorderColor
          },
          ticks: {
            color: darkTickColor,
            font: { size: 10 }
          }
        },
        y: {
          grid: {
            color: darkGridColor,
            borderColor: darkBorderColor
          },
          ticks: {
            color: darkTickColor,
            font: { size: 10 }
          }
        }
      };
    }

    // Deep merge user options over defaults
    var mergedOptions = deepMerge(defaultOptions, (config && config.options) || {});

    var chartConfig = {
      type: type,
      data: (config && config.data) || { labels: [], datasets: [] },
      options: mergedOptions
    };

    if (config && config.plugins) {
      chartConfig.plugins = config.plugins;
    }

    var chart = new Chart(ctx, chartConfig);
    Charts.instances[canvasId] = chart;

    return chart;
  };

  /**
   * Update an existing chart's data
   * @param {string} canvasId
   * @param {Array} labels - New labels array
   * @param {Array} datasets - Array of dataset objects with { data, ...props }
   */
  Charts.update = function (canvasId, labels, datasets) {
    var chart = Charts.instances[canvasId];
    if (!chart) {
      console.warn('[Charts] No instance found for:', canvasId);
      return;
    }

    if (labels) {
      chart.data.labels = labels;
    }

    if (datasets && Array.isArray(datasets)) {
      for (var i = 0; i < datasets.length; i++) {
        if (chart.data.datasets[i]) {
          // Update existing dataset
          Object.keys(datasets[i]).forEach(function (key) {
            chart.data.datasets[i][key] = datasets[i][key];
          });
        } else {
          // Add new dataset
          chart.data.datasets.push(datasets[i]);
        }
      }
    }

    chart.update('none');
  };

  /**
   * Append a single data point to a chart dataset
   * @param {string} canvasId
   * @param {string} label - Label for the new point
   * @param {number|Array} value - Value(s) to append. If number, appends to dataset 0. If array, appends to corresponding datasets.
   * @param {number} [maxPoints=30] - Maximum number of data points to retain
   */
  Charts.appendPoint = function (canvasId, label, value, maxPoints) {
    var chart = Charts.instances[canvasId];
    if (!chart) return;

    maxPoints = maxPoints || 30;

    // Add label
    chart.data.labels.push(label);
    if (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift();
    }

    // Add value(s)
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        if (chart.data.datasets[i]) {
          chart.data.datasets[i].data.push(value[i]);
          if (chart.data.datasets[i].data.length > maxPoints) {
            chart.data.datasets[i].data.shift();
          }
        }
      }
    } else {
      if (chart.data.datasets[0]) {
        chart.data.datasets[0].data.push(value);
        if (chart.data.datasets[0].data.length > maxPoints) {
          chart.data.datasets[0].data.shift();
        }
      }
    }

    chart.update('none');
  };

  /**
   * Destroy a chart instance
   * @param {string} canvasId
   */
  Charts.destroy = function (canvasId) {
    var chart = Charts.instances[canvasId];
    if (chart) {
      chart.destroy();
      delete Charts.instances[canvasId];
    }
  };

  /**
   * Get default line dataset configuration
   * @param {string} color - Color string (e.g., '#22d3ee' or Charts.colors.cyan)
   * @returns {Object} Dataset config object
   */
  Charts.defaultLineConfig = function (color) {
    return {
      borderColor: color,
      borderWidth: 1.5,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointHoverBackgroundColor: color,
      fill: true,
      backgroundColor: function (context) {
        if (!context.chart || !context.chart.ctx) return 'transparent';
        var ctx = context.chart.ctx;
        var area = context.chart.chartArea;
        if (!area) return 'transparent';
        var gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
        gradient.addColorStop(0, hexToRgba(color, 0.15));
        gradient.addColorStop(1, hexToRgba(color, 0.0));
        return gradient;
      }
    };
  };

  /**
   * Get default bar dataset configuration
   * @param {string} color - Color string
   * @returns {Object} Dataset config object
   */
  Charts.defaultBarConfig = function (color) {
    return {
      backgroundColor: hexToRgba(color, 0.6),
      borderColor: color,
      borderWidth: 1,
      borderRadius: 3,
      hoverBackgroundColor: hexToRgba(color, 0.8),
      hoverBorderColor: color
    };
  };

  // ── Utility Functions ──

  /**
   * Convert hex color to rgba string
   */
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

  /**
   * Deep merge two objects (source overwrites target)
   */
  function deepMerge(target, source) {
    var result = {};
    var key;

    // Copy target
    for (key in target) {
      if (target.hasOwnProperty(key)) {
        result[key] = target[key];
      }
    }

    // Merge source
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

  /**
   * Check if value is a plain object (not array, not null)
   */
  function isPlainObject(val) {
    return val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Function);
  }

  // ── Expose Globally ──
  window.Charts = Charts;

})();
