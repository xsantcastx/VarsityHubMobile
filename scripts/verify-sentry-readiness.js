#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const ORG = process.env.SENTRY_ORG || 'lime-productions';
const PROJECT = process.env.SENTRY_PROJECT || 'varsityhub';
const RELEASE = process.env.SENTRY_RELEASE || '';

function railwayVar(key) {
  try {
    const output = execFileSync('railway', ['variables', '--service', 'api', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const vars = JSON.parse(output);
    return vars[key] || '';
  } catch {
    return '';
  }
}

function sentryToken() {
  return process.env.SENTRY_AUTH_TOKEN || railwayVar('SENTRY_AUTH_TOKEN');
}

async function sentryGet(path) {
  const token = sentryToken();
  if (!token) {
    throw new Error('SENTRY_AUTH_TOKEN is not set locally and was not readable from Railway');
  }
  const res = await fetch(`https://sentry.io/api/0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Sentry API ${path} returned ${res.status}`);
  }
  return res.json();
}

async function sentryGetOptional(path) {
  try {
    return { ok: true, data: await sentryGet(path) };
  } catch (error) {
    return { ok: false, error };
  }
}

function latestReleaseForProject(releases) {
  return releases.find(release =>
    Array.isArray(release.projects)
      ? release.projects.some(project => project.slug === PROJECT)
      : false
  );
}

function resolveExpoConfig() {
  const output = execFileSync('npx', ['expo', 'config', '--type', 'public', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      SENTRY_DISABLE_AUTO_UPLOAD: '',
    },
  });
  return JSON.parse(output);
}

function sentryPluginFromExpoConfig(config) {
  return (config.plugins || []).find(
    plugin => Array.isArray(plugin) && plugin[0] === '@sentry/react-native/expo'
  );
}

function checkLocalSourceMapConfig(failures) {
  const config = resolveExpoConfig();
  const sentryPlugin = sentryPluginFromExpoConfig(config);
  if (!sentryPlugin) {
    failures.push('production Expo config does not include @sentry/react-native/expo');
  } else {
    const options = sentryPlugin[1] || {};
    if (options.organization !== ORG) {
      failures.push(
        `production Expo Sentry organization mismatch: ${options.organization || 'missing'}`
      );
    }
    if (options.project !== PROJECT) {
      failures.push(`production Expo Sentry project mismatch: ${options.project || 'missing'}`);
    }
    if (options.uploadSourcemaps !== true) {
      failures.push('production Expo config has Sentry uploadSourcemaps disabled');
    }
  }

  const androidGradle = fs.existsSync('android/app/build.gradle')
    ? fs.readFileSync('android/app/build.gradle', 'utf8')
    : '';
  const iosProject = fs.existsSync('ios/VarsityHub.xcodeproj/project.pbxproj')
    ? fs.readFileSync('ios/VarsityHub.xcodeproj/project.pbxproj', 'utf8')
    : '';
  const androidProperties = fs.existsSync('android/sentry.properties')
    ? fs.readFileSync('android/sentry.properties', 'utf8')
    : '';
  const iosProperties = fs.existsSync('ios/sentry.properties')
    ? fs.readFileSync('ios/sentry.properties', 'utf8')
    : '';

  if (!androidGradle.includes('sentry.gradle')) {
    failures.push('Android Sentry Gradle upload hook is missing');
  }
  if (!iosProject.includes('sentry-xcode.sh')) {
    failures.push('iOS Sentry Xcode source-map upload hook is missing');
  }
  if (
    !androidProperties.includes(`defaults.org=${ORG}`) ||
    !androidProperties.includes(`defaults.project=${PROJECT}`)
  ) {
    failures.push('android/sentry.properties does not match expected org/project');
  }
  if (
    !iosProperties.includes(`defaults.org=${ORG}`) ||
    !iosProperties.includes(`defaults.project=${PROJECT}`)
  ) {
    failures.push('ios/sentry.properties does not match expected org/project');
  }

  return {
    version: config.version || 'unknown',
    runtimeVersion: config.runtimeVersion || 'unknown',
    uploadSourcemaps: sentryPlugin?.[1]?.uploadSourcemaps === true,
    androidHook: androidGradle.includes('sentry.gradle'),
    iosHook: iosProject.includes('sentry-xcode.sh'),
  };
}

async function main() {
  const failures = [];
  const warnings = [];
  const localConfig = checkLocalSourceMapConfig(failures);

  const project = await sentryGet(`/projects/${ORG}/${PROJECT}/`);
  if (project.slug !== PROJECT) failures.push(`unexpected project slug: ${project.slug}`);

  let productionRules = [];
  const rulesResult = await sentryGetOptional(`/projects/${ORG}/${PROJECT}/rules/`);
  if (rulesResult.ok) {
    const rules = Array.isArray(rulesResult.data) ? rulesResult.data : [];
    productionRules = rules.filter(rule => rule.environment === 'production');
    if (productionRules.length === 0) warnings.push('no production Sentry alert rules found');
  } else {
    warnings.push(
      `Sentry alert-rule API unavailable; verify production alert rules in dashboard (${rulesResult.error.message})`
    );
  }

  const releases = await sentryGet(`/organizations/${ORG}/releases/?per_page=10`);
  const latestRelease = RELEASE
    ? releases.find(release => release.version === RELEASE)
    : latestReleaseForProject(releases);
  if (!latestRelease) {
    failures.push(
      RELEASE ? `release not found: ${RELEASE}` : 'no recent release found for project'
    );
  }

  let releaseFiles = [];
  if (latestRelease) {
    releaseFiles = await sentryGet(
      `/organizations/${ORG}/releases/${encodeURIComponent(latestRelease.version)}/files/`
    );
    if (releaseFiles.length === 0) {
      warnings.push(
        `latest release has no legacy release-file uploads: ${latestRelease.version}; EAS Update source maps should upload as debug-id artifact bundles`
      );
    }
    if (!latestRelease.lastEvent) {
      warnings.push(`latest release has no recorded events: ${latestRelease.version}`);
    }
  }

  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const issueQuery = `environment:production is:unresolved lastSeen:>=${since}${RELEASE ? ` release:${JSON.stringify(RELEASE)}` : ''}`;
  const unresolved = await sentryGet(
    `/projects/${ORG}/${PROJECT}/issues/?limit=10&query=${encodeURIComponent(issueQuery)}`
  );
  const productionUnresolved = unresolved.filter(issue =>
    String(issue.metadata?.type || issue.title || '').trim()
  );
  if (productionUnresolved.length > 0) {
    warnings.push(`${productionUnresolved.length} unresolved recent issue(s) found`);
  }

  console.log(`Sentry readiness check for ${ORG}/${PROJECT}`);
  console.log(
    `Local production config: version=${localConfig.version}, runtime=${localConfig.runtimeVersion}, uploadSourcemaps=${localConfig.uploadSourcemaps}`
  );
  console.log(
    `Native upload hooks: android=${localConfig.androidHook}, ios=${localConfig.iosHook}`
  );
  console.log(`Project: ${project.slug} (${project.platform || 'unknown platform'})`);
  console.log(`Production alert rules: ${productionRules.length}`);
  if (latestRelease) {
    console.log(`Latest release checked: ${latestRelease.version}`);
    console.log(`Release last event: ${latestRelease.lastEvent || 'none'}`);
    console.log(`Release uploaded files: ${releaseFiles.length}`);
  }
  console.log(`Recent unresolved issues sampled: ${productionUnresolved.length}`);
  for (const issue of productionUnresolved.slice(0, 5)) {
    console.log(`- ${issue.shortId}: ${issue.title} (${issue.level}, lastSeen=${issue.lastSeen})`);
  }

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of warnings) console.log(`- ${warning}`);
  }

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    '\nSentry configuration checks passed. Runtime stability and alert delivery are not certified by this command.'
  );
}

main().catch(error => {
  console.error(`Sentry readiness check failed: ${error.message}`);
  process.exit(1);
});
