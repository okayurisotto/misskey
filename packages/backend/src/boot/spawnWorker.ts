import cluster from 'node:cluster';
import Logger from '@/misc/logger.js';
import { ProcessMessage } from './ProcessMessage.js';

export const spawnWorker = (logger: Logger): Promise<void> => {
	return new Promise((res) => {
		const worker = cluster.fork();
		worker.on('message', (message) => {
			if (message === ProcessMessage.ListenFailed) {
				logger.error('The server Listen failed due to the previous error.');
				process.exit(1);
			}
			if (message !== ProcessMessage.Ready) return;
			res();
		});
	});
};
