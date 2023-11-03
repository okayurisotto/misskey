import { NestFactory } from '@nestjs/core';
import { ChartManagementService } from '@/core/chart/ChartManagementService.js';
import { NestLogger } from '@/NestLogger.js';
import { JanitorService } from '@/daemons/JanitorService.js';
import { QueueStatsService } from '@/daemons/QueueStatsService.js';
import { ServerStatsService } from '@/daemons/ServerStatsService.js';
import { ServerService } from '@/server/ServerService.js';
import { MainModule } from '@/MainModule.js';
import type { INestApplicationContext } from '@nestjs/common';

export const startServer = async (): Promise<INestApplicationContext> => {
	const app = await NestFactory.createApplicationContext(MainModule, {
		logger: new NestLogger(),
	});
	app.enableShutdownHooks();

	const serverService = app.get(ServerService);
	await serverService.launch();

	if (process.env['NODE_ENV'] !== 'test') {
		await Promise.all([
			app.get(ChartManagementService).start(),
			app.get(JanitorService).start(),
			app.get(QueueStatsService).start(),
			app.get(ServerStatsService).start(),
		]);
	}

	return app;
};
