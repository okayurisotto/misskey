import cluster from 'node:cluster';
import Logger from '@/logger.js';

export const spawnWorker = (logger: Logger): Promise<void> => {
	return new Promise((res) => {
		const worker = cluster.fork();
		worker.on('message', (message) => {
			if (message === 'listenFailed') {
				logger.error('The server Listen failed due to the previous error.');
				process.exit(1);
			}
			if (message !== 'ready') return;
			res();
		});
	});
};
