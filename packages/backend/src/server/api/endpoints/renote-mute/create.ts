import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import {
	noSuchUser_______________,
	muteeIsYourself__,
	alreadyMuting_,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:mutes',
	limit: {
		duration: ms('1hour'),
		max: 20,
	},
	errors: {
		noSuchUser: noSuchUser_______________,
		muteeIsYourself: muteeIsYourself__,
		alreadyMuting: alreadyMuting_,
	},
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly getterService: GetterService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const muter = me;

			// 自分自身
			if (me.id === ps.userId) {
				throw new ApiError(meta.errors.muteeIsYourself);
			}

			// Get mutee
			const mutee = await this.getterService.getUser(ps.userId).catch((err) => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
					throw new ApiError(meta.errors.noSuchUser);
				}
				throw err;
			});

			// Check if already muting
			const exist = await this.prismaService.client.renoteMuting.findFirst({
				where: {
					muterId: muter.id,
					muteeId: mutee.id,
				},
			});

			if (exist != null) {
				throw new ApiError(meta.errors.alreadyMuting);
			}

			// Create mute
			await this.prismaService.client.renoteMuting.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					muterId: muter.id,
					muteeId: mutee.id,
				},
			});
		});
	}
}
