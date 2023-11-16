import cluster from 'node:cluster';
import os from 'node:os';
import { range } from 'range';
import { Injectable } from '@nestjs/common';
import chalk from 'chalk';
import Logger from '@/misc/logger.js';
import { ProcessMessage } from './ProcessMessage.js';

@Injectable()
export class ClusterManagementService {
	private readonly logger = new Logger('cluster', 'orange');

	constructor() {
		cluster.on('fork', (worker) => {
			this.logger.debug(`Process forked: [${worker.id}]`);
		});

		cluster.on('online', (worker) => {
			this.logger.debug(`Process is now online: [${worker.id}]`);
		});

		cluster.on('exit', (worker) => {
			this.logger.error(chalk.red(`[${worker.id}] died :(`));
			cluster.fork();
		});
	}

	private spawnWorker(): Promise<void> {
		return new Promise((resolve) => {
			const worker = cluster.fork();
			worker.on('message', (message) => {
				if (message === ProcessMessage.ListenFailed) {
					this.logger.error('The server Listen failed.');
					process.exit(1);
				} else if (message === ProcessMessage.Ready) {
					resolve();
				} else {
					// ?
				}
			});
		});
	}

	public async spawnWorkers(limit: number): Promise<void> {
		const workers = Math.min(limit, os.cpus().length);

		await Promise.all(
			range({ stop: workers }).map(async () => {
				await this.spawnWorker();
			}),
		);
	}
}
