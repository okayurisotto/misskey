import cluster from 'node:cluster';
import { Injectable } from '@nestjs/common';
import { ChartManagementService } from '@/core/chart/ChartManagementService.js';
import { JanitorService } from '@/daemons/JanitorService.js';
import { QueueStatsService } from '@/daemons/QueueStatsService.js';
import { ServerStatsService } from '@/daemons/ServerStatsService.js';
import { NODE_ENV, envOption } from '@/env.js';
import Logger from '@/misc/logger.js';
import { QueueProcessorService } from '@/queue/QueueProcessorService.js';
import { ServerService } from '@/server/ServerService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { ProcessMessage } from './ProcessMessage.js';
import { ClusterManagementService } from './ClusterManagementService.js';
import { BootMessageService } from './BootMessageService.js';

@Injectable()
export class BootManagementService {
	private readonly logger = new Logger('boot', 'magenta');

	constructor(
		private readonly bootMessageService: BootMessageService,
		private readonly chartManagementService: ChartManagementService,
		private readonly clusterManagementService: ClusterManagementService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly janitorService: JanitorService,
		private readonly queueProcessorService: QueueProcessorService,
		private readonly queueStatsService: QueueStatsService,
		private readonly serverService: ServerService,
		private readonly serverStatsService: ServerStatsService,
	) {
		process.on('uncaughtException', (err) => {
			this.logger.error(err);
			console.trace(err);
		});

		process.on('unhandledRejection', (reason, promise) => {
			if (!envOption.quiet) {
				console.dir(reason, promise);
			}
		});

		process.on('exit', (code) => {
			this.logger.info(`The process is going to exit with code ${code}`);
		});
	}

	private async startServer(): Promise<void> {
		await Promise.all([
			//
			this.serverService.launch(),
			...(NODE_ENV !== 'test'
				? [
						this.chartManagementService.start(),
						this.janitorService.start(),
						this.queueStatsService.start(),
						this.serverStatsService.start(),
				  ]
				: []),
		]);

		if (this.configLoaderService.data.socket) {
			this.logger.succ(
				`Now listening on socket ${this.configLoaderService.data.socket} on ${this.configLoaderService.data.url}`,
				true,
			);
		} else {
			this.logger.succ(
				`Now listening on port ${this.configLoaderService.data.port} on ${this.configLoaderService.data.url}`,
				true,
			);
		}
	}

	private startJobQueue(): void {
		this.queueProcessorService.start();
		this.chartManagementService.start();
	}

	private async initializePrimary(): Promise<void> {
		await this.bootMessageService.show(this.logger);

		if (envOption.onlyServer) {
			await this.startServer();
		} else if (envOption.onlyQueue) {
			this.startJobQueue();
		} else {
			await this.startServer();
		}

		this.logger.succ('Misskey initialized');
	}

	private async initializeWorker(): Promise<void> {
		if (envOption.onlyServer) {
			await this.startServer();
		} else if (envOption.onlyQueue) {
			this.startJobQueue();
		} else {
			this.startJobQueue();
		}

		process.send?.(ProcessMessage.Ready);
	}

	private async spawnWorkers(): Promise<void> {
		const limit = this.configLoaderService.data.clusterLimit;
		await this.clusterManagementService.spawnWorkers(limit);
	}

	public async boot(): Promise<void> {
		if (envOption.disableClustering) {
			await Promise.all([this.initializePrimary(), this.initializeWorker()]);
		} else {
			if (cluster.isPrimary) {
				await Promise.all([this.initializePrimary(), this.spawnWorkers()]);
			} else {
				await this.initializeWorker();
			}
		}
	}
}
