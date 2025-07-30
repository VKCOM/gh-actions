import { retry } from '@octokit/plugin-retry';
import * as core from '@actions/core';
import * as github from '@actions/github';

type OctokitProp = ReturnType<typeof github.getOctokit>;

export class WorkflowHandler {
  private readonly gh: OctokitProp;
  private readonly releaseTag: string;
  private error = false;

  public constructor(token: string, releaseTagProp: string) {
    this.gh = github.getOctokit(token, { request: { retries: 3 } }, retry);
    this.releaseTag = releaseTagProp.trim();
  }

  public async processReleaseNotes() {
    try {
      const releaseNotes = await this.findReleaseNotesByReleaseTag();

      if (!releaseNotes) {
        throw new Error(`There are no release notes for ${this.releaseTag}`);
      }

      if (releaseNotes.draft) {
        await this.publishReleaseNotes(releaseNotes.id);
      }

      core.debug(`[processReleaseNotes]: ${releaseNotes.name} release notes already published`);
    } catch (error) {
      if (error instanceof Error) {
        core.error(error.message);
      }
      this.error = true;
    }
  }

  public isProcessWithError() {
    return this.error;
  }

  private async findReleaseNotesByReleaseTag() {
    const { data: releases } = await this.gh.rest.repos.listReleases(github.context.repo);
    return releases.find(({ name }) => name === this.releaseTag);
  }

  private async publishReleaseNotes(release_id: number) {
    await this.gh.rest.repos.updateRelease({
      ...github.context.repo,
      tag_name: this.releaseTag,
      release_id,
      draft: false,
      prerelease: false,
      make_latest: 'true',
    });
  }
}
