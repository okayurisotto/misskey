import { z } from 'zod';

const vars = z
	.object({
		NODE_ENV: z.enum(['dev', 'development', 'test', 'production']).optional(),
		PORT: z.coerce.number().int().nonnegative().optional(),

		MISSKEY_CONFIG_YML: z.string().optional(),
		MISSKEY_WEBFINGER_USE_HTTP: z.string().optional(),

		MK_DISABLE_CLUSTERING: z.literal('').optional(),
		MK_NO_DAEMONS: z.literal('').optional(),
		MK_ONLY_QUEUE: z.literal('').optional(),
		MK_ONLY_SERVER: z.literal('').optional(),
		MK_QUIET: z.literal('').optional(),
		MK_VERBOSE: z.literal('').optional(),
		MK_WITH_LOG_TIME: z.literal('').optional(),
	})
	.parse(process.env);

export const NODE_ENV = vars.NODE_ENV;
export const PORT = vars.PORT;
export const MISSKEY_CONFIG_YML = vars.MISSKEY_CONFIG_YML;
export const MISSKEY_WEBFINGER_USE_HTTP = vars.MISSKEY_WEBFINGER_USE_HTTP;

export const envOption = {
	disableClustering:
		NODE_ENV === 'test' || vars.MK_DISABLE_CLUSTERING !== undefined,
	noDaemons: NODE_ENV === 'test' || vars.MK_NO_DAEMONS !== undefined,
	onlyQueue: vars.MK_ONLY_QUEUE !== undefined,
	onlyServer: vars.MK_ONLY_SERVER !== undefined,
	quiet: NODE_ENV === 'test' || vars.MK_QUIET !== undefined,
	verbose: vars.MK_VERBOSE !== undefined,
	withLogTime: vars.MK_WITH_LOG_TIME !== undefined,
};
