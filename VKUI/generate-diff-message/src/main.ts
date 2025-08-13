import * as core from '@actions/core';
import * as fs from 'fs';
import { generateMessageBody } from './generateMessageBody';

async function run() {
  const diffReportUrl = core.getInput('diff_report_url', { required: true });

  const changedFilesTxt = fs.readFileSync('changed_files.txt', 'utf-8');

  const result = `## 🆚 Bundle diff report\n\n${generateMessageBody(changedFilesTxt, diffReportUrl)}`;

  core.setOutput('diff_message', result);
}

void run();
