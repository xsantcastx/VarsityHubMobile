const { withXcodeProject } = require('@expo/config-plugins');

module.exports = function withSentryNativeGate(config) {
  return withXcodeProject(config, next => {
    const phases = next.modResults.hash.project.objects.PBXShellScriptBuildPhase || {};
    let found = false;
    for (const phase of Object.values(phases)) {
      if (typeof phase !== 'object') continue;
      if (
        String(phase.shellScript).includes('sentry-xcode-debug-files.sh') ||
        String(phase.shellScript).includes('sentry-native-release.sh')
      ) {
        phase.shellScript = JSON.stringify(
          '/bin/bash "$PROJECT_DIR/../scripts/sentry-native-release.sh"'
        );
        found = true;
      }
    }
    if (!found)
      throw new Error(
        'Sentry native debug upload phase missing; apply the Sentry plugin before its verification gate'
      );
    return next;
  });
};
