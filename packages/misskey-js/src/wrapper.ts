import { paths } from './api.types';

type RemoveSlash<T extends `/${string}`> = T extends `/${infer U}` ? U : never;

export type Endpoints = {
	[K in RemoveSlash<keyof paths>]: {
		req: paths[`/${K}`]['post']['requestBody']['content'] extends {
			'application/json': unknown;
		}
			? paths[`/${K}`]['post']['requestBody']['content']['application/json']
			: Record<string, never>;
		res: paths[`/${K}`]['post']['responses'] extends {
			'200': { content: { 'application/json': unknown } };
		}
			? paths[`/${K}`]['post']['responses']['200']['content']['application/json']
			: Record<string, never>;
	};
};
