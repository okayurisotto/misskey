import Logger from '@/misc/logger.js';
import { loadConfig } from '@/config.js';
import type { Config } from '@/config.js';

export const loadConfigBoot = (parentLogger: Logger): Config => {
	const configLogger = parentLogger.createSubLogger('config');

	try {
		const config = loadConfig();
		configLogger.succ('Loaded');
		return config;
	} catch (exception) {
		if (typeof exception === 'string') {
			configLogger.error(exception);
			process.exit(1);
		}

		if (
			exception instanceof Error &&
			'code' in exception &&
			exception.code === 'ENOENT'
		) {
			configLogger.error('Configuration file not found', null, true);
			process.exit(1);
		}

		throw exception;
	}
};
