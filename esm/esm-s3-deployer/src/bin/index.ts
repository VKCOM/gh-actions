#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import type { ConfigurationPartial } from '../architecture/entities/config.ts';
import { Configuration } from '../architecture/entities/config.ts';
import type { Context } from '../architecture/entities/context.ts';
import type { Repositories } from '../architecture/entities/repositories.ts';
import { libRepository } from '../architecture/repositories/repositories.ts';
import { MainService } from '../architecture/services/main.ts';

class SystemSignalAbortError extends Error {
  constructor() {
    super('System signal received');
  }
}

function mainContext(): Context {
  const controller = new AbortController();

  const abortProcess = () => {
    console.log('System signal received. Aborting operations...');
    controller.abort(new SystemSignalAbortError());
  };

  process.on('SIGINT', abortProcess);
  process.on('SIGTERM', abortProcess);

  return { signal: controller.signal };
}

async function loadConfig(configPath: string): Promise<ConfigurationPartial> {
  const absolutePath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(process.cwd(), configPath);

  const content = await fs.readFile(absolutePath, { encoding: 'utf-8' });
  const json = JSON.parse(content) as unknown;

  return Configuration.partial().parse(json);
}

async function main() {
  const ctx = mainContext();
  console.log('start');

  const config = await loadConfig('esm-s3-deployer.json');

  const repositories: Repositories = await libRepository(ctx, config);

  const service = new MainService(repositories);

  await service.run(ctx);

  console.log('end');
  process.exit(0);
}

void main();
