import { NestFactory } from '@nestjs/core';
import { ChartManagementService } from '@/core/chart/ChartManagementService.js';
import { QueueProcessorService } from '@/queue/QueueProcessorService.js';
import { NestLogger } from '@/misc/NestLogger.js';
import { QueueProcessorModule } from '@/queue/QueueProcessorModule.js';
import type { INestApplicationContext } from '@nestjs/common';

export const startJobQueue = async (): Promise<INestApplicationContext> => {
	const jobQueue = await NestFactory.createApplicationContext(
		QueueProcessorModule,
		{ logger: new NestLogger() },
	);
	jobQueue.enableShutdownHooks();

	jobQueue.get(QueueProcessorService).start(); // TODO: `await`するとテストに通らなくなる？
	await jobQueue.get(ChartManagementService).start();

	return jobQueue;
};
