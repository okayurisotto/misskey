import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma, type user_list } from '@prisma/client';
import { pick } from 'omick';
import { noSuchAntenna___, noSuchUserList_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { AntennaEntityService } from '@/core/entities/AntennaEntityService.js';
import { AntennaSchema } from '@/models/zod/AntennaSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { ApiError } from '../../error.js';

const res = AntennaSchema;
export const meta = {
	tags: ['antennas'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	errors: { noSuchAntenna: noSuchAntenna___, noSuchUserList: noSuchUserList_ },
	res,
} as const;

export const paramDef = z.object({
	antennaId: MisskeyIdSchema,
	name: z.string().min(1).max(100),
	src: z.enum(['home', 'all', 'users', 'list']),
	userListId: MisskeyIdSchema.nullable().optional(),
	keywords: z.array(z.array(z.string())),
	excludeKeywords: z.array(z.array(z.string())),
	users: z.array(z.string()),
	caseSensitive: z.boolean(),
	withReplies: z.boolean(),
	withFile: z.boolean(),
	notify: z.boolean(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly antennaEntityService: AntennaEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let userList: user_list | null = null;
			if (ps.src === 'list' && ps.userListId) {
				userList = await this.prismaService.client.user_list.findUnique({
					where: {
						id: ps.userListId,
						userId: me.id,
					},
				});

				if (userList === null) {
					throw new ApiError(meta.errors.noSuchUserList);
				}
			}

			try {
				const updated = await this.prismaService.client.antenna.update({
					where: {
						id: ps.antennaId,
						userId: me.id,
					},
					data: {
						...pick(ps, [
							'caseSensitive',
							'excludeKeywords',
							'keywords',
							'name',
							'notify',
							'src',
							'users',
							'withFile',
							'withReplies',
						]),
						userListId: userList?.id ?? null,
						isActive: true,
						lastUsedAt: new Date(),
					},
				});

				this.globalEventService.publishInternalEvent('antennaUpdated', updated);

				return this.antennaEntityService.pack(updated.id, {
					antenna: new EntityMap('id', [updated]),
				});
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError) {
					if (e.code === 'P2025') {
						throw new ApiError(meta.errors.noSuchAntenna);
					}
				}

				throw e;
			}
		});
	}
}
