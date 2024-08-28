import * as core from '@actions/core';
import semver from 'semver';

async function run() {
  try {
    const prevFloatingUiReactDomVersion = core.getInput('prev_origin_version', { required: true });
    const newFloatingUiReactDomVersion = core.getInput('new_origin_version', { required: true });
    const floatingUIVersion = core.getInput('current_version', { required: true });
    const updateType = semver.diff(
      prevFloatingUiReactDomVersion,
      newFloatingUiReactDomVersion,
    ) as semver.ReleaseType;
    const newVKUIFloatingVersion = semver.inc(floatingUIVersion, updateType);
    core.setOutput('new_version', newVKUIFloatingVersion);
  } catch (e) {}
}

void run();
