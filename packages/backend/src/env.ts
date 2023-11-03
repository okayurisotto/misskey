import type { ScreamingSnakeCase } from 'type-fest';

const envOption = {
	disableClustering: false,
	noDaemons: false,
	onlyQueue: false,
	onlyServer: false,
	quiet: false,
	verbose: false,
	withLogTime: false,
};

const keyMapping = new Map<
	`MK_${ScreamingSnakeCase<keyof typeof envOption>}`,
	keyof typeof envOption
>([
	['MK_DISABLE_CLUSTERING', 'disableClustering'],
	['MK_ONLY_QUEUE', 'onlyQueue'],
	['MK_ONLY_SERVER', 'onlyServer'],
	['MK_QUIET', 'quiet'],
	['MK_VERBOSE', 'verbose'],
	['MK_WITH_LOG_TIME', 'withLogTime'],
	['MK_NO_DAEMONS', 'noDaemons'],
]);

for (const [envKey, optionKey] of keyMapping) {
	if (process.env[envKey]) {
		envOption[optionKey] = true;
	}
}

if (process.env['NODE_ENV'] === 'test') {
	envOption.disableClustering = true;
	envOption.noDaemons = true;
	envOption.quiet = true;
}

export { envOption };
