import * as fs from 'node:fs';
import { z } from 'zod';
import type { LocalUser } from '@/models/entities/User.js';
import { ApiError } from './error.js';
import type { AccessToken } from '@prisma/client';
import type { IEndpointMeta } from './endpoints.js';

type File = {
	name: string | null;
	path: string;
};

type Executor<T extends Omit<IEndpointMeta, 'res'>, Ps, Res> = (
	params: Ps,
	user: T['requireCredential'] extends true ? LocalUser : LocalUser | null,
	token: AccessToken | null,
	file?: File,
	cleanup?: () => void,
	ip?: string | null,
	headers?: Record<string, string> | null,
) => Promise<Res>;

export abstract class Endpoint<
	T extends Omit<IEndpointMeta, 'res'>,
	Ps extends z.ZodType,
	Res extends z.ZodType,
> {
	public exec: (
		params: unknown,
		user: T['requireCredential'] extends true ? LocalUser : LocalUser | null,
		token: AccessToken | null,
		file?: File,
		ip?: string | null,
		headers?: Record<string, string> | null,
	) => Promise<z.infer<Res>>;

	constructor(
		meta: T,
		paramDef: Ps,
		cb: Executor<T, z.infer<Ps>, z.infer<Res>>,
	) {
		this.exec = (
			params: unknown,
			user: T['requireCredential'] extends true ? LocalUser : LocalUser | null,
			token: AccessToken | null,
			file?: File,
			ip?: string | null,
			headers?: Record<string, string> | null,
		): Promise<z.infer<Res>> => {
			let cleanup: undefined | (() => void) = undefined;

			if (meta.requireFile) {
				cleanup = (): void => {
					if (file) fs.unlink(file.path, () => {});
				};

				if (file == null) {
					return Promise.reject(
						new ApiError({
							message: 'File required.',
							code: 'FILE_REQUIRED',
							id: '4267801e-70d1-416a-b011-4ee502885d8b',
						}),
					);
				}
			}

			const result = paramDef.safeParse(params);
			if (!result.success) {
				if (file) cleanup!();

				const err = new ApiError(
					{
						message: 'Invalid param.',
						code: 'INVALID_PARAM',
						id: '3d81ceae-475f-4600-b2a8-2bc116157532',
					},
					result.error.issues,
				);
				return Promise.reject(err);
			}

			return cb(result.data, user, token, file, cleanup, ip, headers);
		};
	}
}
