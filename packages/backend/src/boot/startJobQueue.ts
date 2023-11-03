import { NestFactory } from '@nestjs/core';
import { ChartManagementService } from '@/core/chart/ChartManagementService.js';
import { QueueProcessorService } from '@/queue/QueueProcessorService.js';
import { NestLogger } from '@/NestLogger.js';
import { QueueProcessorModule } from '@/queue/QueueProcessorModule.js';
import type { INestApplicationContext } from '@nestjs/common';

export const startJobQueue = async (): Promise<INestApplicationContext> => {
	const jobQueue = await NestFactory.createApplicationContext(
		QueueProcessorModule,
		{ logger: new NestLogger() },
	);
	jobQueue.enableShutdownHooks();

	await Promise.all([
		jobQueue.get(QueueProcessorService).start(),
		jobQueue.get(ChartManagementService).start(),
	]);

	return jobQueue;
};
