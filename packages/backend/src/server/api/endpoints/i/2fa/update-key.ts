import { noSuchKey, accessDenied________ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const res = z.object({});
export const meta = {
	requireCredential: true,
	secure: true,
	errors: {noSuchKey:noSuchKey,accessDenied:accessDenied________},
	res,
} as const;

export const paramDef = z.object({
	name: z.string().min(1).max(30),
	credentialId: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const key = await this.prismaService.client.user_security_key.findUnique({
				where: { id: ps.credentialId },
			});

			if (key == null) {
				throw new ApiError(meta.errors.noSuchKey);
			}

			if (key.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

			await this.prismaService.client.user_security_key.update({
				where: { id: key.id },
				data: { name: ps.name },
			});

			// Publish meUpdated event
			this.globalEventService.publishMainStream(
				me.id,
				'meUpdated',
				await this.userEntityService.pack(me.id, me, {
					detail: true,
					includeSecrets: true,
				}),
			);

			return {} satisfies z.infer<typeof res>;
		});
	}
}
