/**
 * Misskey Entry Point!
 */

import 'reflect-metadata';

import cluster from 'node:cluster';
import { EventEmitter } from 'node:events';
import { NestFactory } from '@nestjs/core';
import Xev from 'xev';
import { GlobalModule } from '@/GlobalModule.js';
import { NestLogger } from '@/misc/NestLogger.js';
import { ProcessMessage } from './ProcessMessage.js';
import { BootManagementService } from './BootManagementService.js';

Error.stackTraceLimit = Infinity;
EventEmitter.defaultMaxListeners = 128;

process.title = `Misskey (${
	cluster.worker ? `worker[${cluster.worker.id}]` : 'primary'
})`;

const xev = new Xev();
if (cluster.isPrimary) xev.mount();

const app = await NestFactory.createApplicationContext(GlobalModule, {
	logger: new NestLogger(),
});
const bootManagementService = await app.resolve(BootManagementService);
await bootManagementService.boot();

process.send?.(ProcessMessage.Ok);
