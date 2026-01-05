// Minimal tslib shim to ensure __extends exists before sentry-expo evaluates.
// This file is aliased via metro.config.js as "tslib".
const g = global;

if (typeof g.__extends !== 'function') {
  g.__extends = function (d, b) {
    if (typeof Object.setPrototypeOf === 'function') {
      Object.setPrototypeOf(d, b);
    } else {
      // eslint-disable-next-line no-proto
      d.__proto__ = b;
    }
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
  };
}

module.exports = {
  __extends: g.__extends,
};
