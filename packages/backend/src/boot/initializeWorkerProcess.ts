import cluster from 'node:cluster';
import { envOption } from '@/env.js';
import { startJobQueue } from './startJobQueue.js';
import { startServer } from './startServer.js';
import { ProcessMessage } from './ProcessMessage.js';

export const initializeWorkerProcess = async (): Promise<void> => {
	if (envOption.onlyServer) {
		await startServer();
	} else if (envOption.onlyQueue) {
		await startJobQueue();
	} else {
		await startJobQueue();
	}

	if (cluster.isWorker) {
		process.send?.(ProcessMessage.Ready);
	}
};
