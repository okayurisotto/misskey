import { NODE_ENV } from '@/env.js';
import Logger from '@/logger.js';

export const showEnvironment = (parentLogger: Logger): void => {
	const logger = parentLogger.createSubLogger('env');
	logger.info(NODE_ENV === undefined ? 'NODE_ENV is not set' : `NODE_ENV: ${NODE_ENV}`);

	if (NODE_ENV !== 'production') {
		logger.warn('The environment is not in production mode.');
		logger.warn('DO NOT USE FOR PRODUCTION PURPOSE!', true);
	}
};
