import * as core from "@actions/core";
import * as github from "@actions/github";

async function run(): Promise<void> {
  try {
    const token = core.getInput("token", { required: true });
    const releaseName = core.getInput("releaseName", { required: true });
    const latest = core.getInput("latest", { required: true });
    const sha = core.getInput("sha", { required: true });

    const gh = github.getOctokit(token);

    const { owner, repo } = github.context.repo;

    const response = await gh.rest.repos.listReleases({
      owner,
      repo,
      per_page: 10,
    });

    const release = response.data.find((r) => r.draft && r.name === releaseName);

    if (!release) {
      throw new Error(`There are no release notes for ${releaseName}`);
    }

    await gh.rest.repos.updateRelease({
      owner,
      repo,
      release_id: release.id,
      tag_name: releaseName,
      draft: false,
      // make_latest does not work as expected
      prerelease: latest !== "true",
      target_commitish: sha,
    });
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

void run();
