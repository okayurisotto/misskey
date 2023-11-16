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
	) {}

	private async startServer(): Promise<void> {
		await this.serverService.launch();

		if (NODE_ENV !== 'test') {
			await Promise.all([
				this.chartManagementService.start(),
				this.janitorService.start(),
				this.queueStatsService.start(),
				this.serverStatsService.start(),
			]);
		}

		this.logger.succ(
			this.configLoaderService.data.socket
				? `Now listening on socket ${this.configLoaderService.data.socket} on ${this.configLoaderService.data.url}`
				: `Now listening on port ${this.configLoaderService.data.port} on ${this.configLoaderService.data.url}`,
			true,
		);
	}

	private startJobQueue(): void {
		this.queueProcessorService.start();
		this.chartManagementService.start();
	}

	public async initializePrimary(): Promise<void> {
		this.bootMessageService.showGreetingMessage(this.logger);
		this.bootMessageService.showEnvironment(this.logger);
		await this.bootMessageService.showMachineInfo(this.logger);
		this.bootMessageService.showNodejsVersion(this.logger);

		if (envOption.onlyServer) {
			await this.startServer();
		} else if (envOption.onlyQueue) {
			this.startJobQueue();
		} else {
			await this.startServer();
		}

		this.logger.succ('Misskey initialized');
	}

	public async initializeWorker(): Promise<void> {
		if (envOption.onlyServer) {
			await this.startServer();
		} else if (envOption.onlyQueue) {
			this.startJobQueue();
		} else {
			this.startJobQueue();
		}

		process.send?.(ProcessMessage.Ready);
	}

	public async spawnWorkers(): Promise<void> {
		const limit = this.configLoaderService.data.clusterLimit;
		await this.clusterManagementService.spawnWorkers(limit);
	}
}
