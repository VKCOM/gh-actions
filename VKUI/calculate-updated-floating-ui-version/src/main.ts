import * as core from '@actions/core';
import semver from 'semver';
import fs from 'fs';

function getPackageVersion(packagePath: string) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

async function run() {
  try {
    const floatingUiPath = 'packages/vkui-floating-ui/package.json';
    const prevFloatingUiReactDomVersion = core.getInput('prev_version', { required: true });
    const newFloatingUiReactDomVersion = core.getInput('new_version', { required: true });
    const updateType = semver.diff(
      prevFloatingUiReactDomVersion,
      newFloatingUiReactDomVersion,
    ) as semver.ReleaseType;
    const newVKUIFloatingVersion = semver.inc(getPackageVersion(floatingUiPath), updateType);
    core.setOutput('new_version', newVKUIFloatingVersion);
  } catch (e) {}
}

void run();
