import Logger from '@/misc/logger.js';

export const showNodejsVersion = (parentLogger: Logger): void => {
	const nodejsLogger = parentLogger.createSubLogger('nodejs');
	nodejsLogger.info(`Version ${process.version} detected.`);
};
