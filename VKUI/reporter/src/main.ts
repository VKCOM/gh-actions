import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';
import { jest } from './jest.ts';
import { lint } from './lint.ts';
import { playwrightReport } from './playwrightReport.ts';

async function run(): Promise<void> {
  try {
    const jobs = [];
    const lintResults = path.join(process.cwd(), 'lint-results.json');
    const testResults = path.join(process.cwd(), 'test-results.json');
    const a11yResults = path.join(process.cwd(), 'a11y-results.json');

    if (fs.existsSync(lintResults)) {
      jobs.push(lint(lintResults));
    }

    if (fs.existsSync(testResults)) {
      jobs.push(jest(testResults));
    }

    if (fs.existsSync(a11yResults)) {
      jobs.push(jest(a11yResults));
    }

    const playwrightReportURL = core.getInput('playwrightReportURL', {
      required: false,
    });
    const token = core.getInput('token', { required: false });
    const prNumberRaw = core.getInput('prNumber', { required: false });

    if (playwrightReportURL && token) {
      const prNumber = prNumberRaw ? Number(prNumberRaw) : undefined;
      jobs.push(playwrightReport(playwrightReportURL, token, prNumber));
    }

    await Promise.all(jobs);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

void run();
