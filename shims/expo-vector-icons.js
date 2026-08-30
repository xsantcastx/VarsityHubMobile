const React = require('react');
const { Text } = require('react-native');

function Icon({ color = 'currentColor', name, size = 24, style, testID, ...props }) {
  return React.createElement(Text, {
    ...props,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
    style: [{ color, fontSize: size, lineHeight: size }, style],
    testID,
  });
}

module.exports = Icon;
module.exports.default = Icon;
module.exports.Ionicons = Icon;
module.exports.MaterialIcons = Icon;
