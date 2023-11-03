import Logger from '@/logger.js';

export const showEnvironment = (parentLogger: Logger): void => {
	const env = process.env['NODE_ENV'];
	const logger = parentLogger.createSubLogger('env');
	logger.info(env === undefined ? 'NODE_ENV is not set' : `NODE_ENV: ${env}`);

	if (env !== 'production') {
		logger.warn('The environment is not in production mode.');
		logger.warn('DO NOT USE FOR PRODUCTION PURPOSE!', null, true);
	}
};
