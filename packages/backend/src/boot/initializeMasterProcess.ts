import Logger from '@/misc/logger.js';
import type { Config } from '@/config.js';
import { showMachineInfo } from '@/boot/showMachineInfo.js';
import { envOption } from '@/env.js';
import { startJobQueue } from './startJobQueue.js';
import { startServer } from './startServer.js';
import { showGreetingMessage } from './showGreetingMessage.js';
import { spawnWorkers } from './spawnWorkers.js';
import { loadConfigBoot } from './loadConfigBoot.js';
import { showNodejsVersion } from './showNodejsVersion.js';
import { showEnvironment } from './showEnvironment.js';

export const initializeMasterProcess = async (): Promise<void> => {
	const logger = new Logger('core', 'cyan');
	const bootLogger = logger.createSubLogger('boot', 'magenta');

	let config!: Config;

	// initialize app
	try {
		showGreetingMessage(bootLogger);
		showEnvironment(bootLogger);
		await showMachineInfo(bootLogger);
		showNodejsVersion(bootLogger);
		config = loadConfigBoot(bootLogger);
	} catch {
		bootLogger.error('Fatal error occurred during initialization', null, true);
		process.exit(1);
	}

	if (envOption.onlyServer) {
		await startServer();
	} else if (envOption.onlyQueue) {
		await startJobQueue();
	} else {
		await startServer();
	}

	bootLogger.succ('Misskey initialized');

	if (!envOption.disableClustering) {
		await spawnWorkers(bootLogger, config.clusterLimit);
	}

	bootLogger.succ(
		config.socket
			? `Now listening on socket ${config.socket} on ${config.url}`
			: `Now listening on port ${config.port} on ${config.url}`,
		true,
	);
};
