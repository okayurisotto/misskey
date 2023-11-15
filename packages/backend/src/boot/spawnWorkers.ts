import * as os from 'node:os';
import { range } from 'range';
import Logger from '@/misc/logger.js';
import { spawnWorker } from './spawnWorker.js';

export const spawnWorkers = async (
	logger: Logger,
	limit: number,
): Promise<void> => {
	const workers = Math.min(limit, os.cpus().length);
	logger.info(`Starting ${workers} worker${workers === 1 ? '' : 's'}...`);
	await Promise.all(
		range({ stop: workers }).map(async () => {
			await spawnWorker(logger);
		}),
	);
	logger.succ('All workers started');
};
