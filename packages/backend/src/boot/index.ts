/**
 * Misskey Entry Point!
 */

import cluster from 'node:cluster';
import { EventEmitter } from 'node:events';
import { NestFactory } from '@nestjs/core';
import Xev from 'xev';
import { GlobalModule } from '@/GlobalModule.js';
import { envOption } from '@/env.js';
import Logger from '@/misc/logger.js';
import { NestLogger } from '@/misc/NestLogger.js';
import { ProcessMessage } from './ProcessMessage.js';
import { BootManagementService } from './BootManagementService.js';

import 'reflect-metadata';

process.title = `Misskey (${
	cluster.worker ? `worker[${cluster.worker.id}]` : 'primary'
})`;

Error.stackTraceLimit = Infinity;
EventEmitter.defaultMaxListeners = 128;

const logger = new Logger('core', 'cyan');
const ev = new Xev();

// Display detail of unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
	if (!envOption.quiet) {
		console.dir(reason, promise);
	}
});

// Display detail of uncaught exception
process.on('uncaughtException', (err) => {
	try {
		logger.error(err);
		console.trace(err);
	} catch {
		// continue
	}
});

// Dying away...
process.on('exit', (code) => {
	logger.info(`The process is going to exit with code ${code}`);
});

const app = await NestFactory.createApplicationContext(GlobalModule, {
	logger: new NestLogger(),
});
const bootManagementService = await app.resolve(BootManagementService);

if (cluster.isPrimary) {
	ev.mount();
}

if (envOption.disableClustering) {
	await bootManagementService.initializePrimary();
	await bootManagementService.initializeWorker();
} else {
	if (cluster.isPrimary) {
		await bootManagementService.spawnWorkers();
		await bootManagementService.initializePrimary();
	} else {
		await bootManagementService.initializeWorker();
	}
}

process.send?.(ProcessMessage.Ok);
