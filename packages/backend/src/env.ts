import { z } from 'zod';

const envOption_ = z
	.object({
		MK_DISABLE_CLUSTERING: z.literal('').optional(),
		MK_NO_DAEMONS: z.literal('').optional(),
		MK_ONLY_QUEUE: z.literal('').optional(),
		MK_ONLY_SERVER: z.literal('').optional(),
		MK_QUIET: z.literal('').optional(),
		MK_VERBOSE: z.literal('').optional(),
		MK_WITH_LOG_TIME: z.literal('').optional(),
	})
	.parse(process.env);

const envOption = {
	disableClustering: envOption_.MK_DISABLE_CLUSTERING !== undefined,
	noDaemons: envOption_.MK_NO_DAEMONS !== undefined,
	onlyQueue: envOption_.MK_ONLY_QUEUE !== undefined,
	onlyServer: envOption_.MK_ONLY_SERVER !== undefined,
	quiet: envOption_.MK_QUIET !== undefined,
	verbose: envOption_.MK_VERBOSE !== undefined,
	withLogTime: envOption_.MK_WITH_LOG_TIME !== undefined,
};

if (process.env['NODE_ENV'] === 'test') {
	envOption.disableClustering = true;
	envOption.noDaemons = true;
	envOption.quiet = true;
}

export { envOption };
