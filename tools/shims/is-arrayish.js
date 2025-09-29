"use strict";
// Minimal is-arrayish shim for React Native Metro bundler.
// Avoids broken nested installs on Windows by aliasing this module.
module.exports = function isArrayish(obj) {
  if (!obj) return false;
  if (Array.isArray(obj)) return true;
  // Strings are array-like but should not be considered arrayish here.
  if (typeof obj === 'string') return false;
  return typeof obj.length === 'number';
};

