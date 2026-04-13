// Web shim for react-native-view-shot (native-only)
// View capture requires native rendering pipeline, not available on web.
const { View, forwardRef } = require('react-native');
const React = require('react');

const ViewShot = React.forwardRef(function ViewShot(props, ref) {
  return React.createElement(View, { ...props, ref });
});

function captureRef() {
  return Promise.reject(new Error('View capture is not available on web.'));
}

function captureScreen() {
  return Promise.reject(new Error('Screen capture is not available on web.'));
}

module.exports = ViewShot;
module.exports.default = ViewShot;
module.exports.captureRef = captureRef;
module.exports.captureScreen = captureScreen;
