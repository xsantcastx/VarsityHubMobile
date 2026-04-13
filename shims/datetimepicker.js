// Web shim for @react-native-community/datetimepicker (native-only)
// Date/time picking on web uses HTML <input type="date"> / <input type="time"> instead.
const { View } = require('react-native');

function DateTimePicker() {
  return null;
}

DateTimePicker.defaultProps = {};

module.exports = DateTimePicker;
module.exports.default = DateTimePicker;
