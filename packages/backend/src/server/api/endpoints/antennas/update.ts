import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchAntenna___, noSuchUserList_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { AntennaEntityService } from '@/core/entities/AntennaEntityService.js';
import { AntennaSchema } from '@/models/zod/AntennaSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = AntennaSchema;
export const meta = {
	tags: ['antennas'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	errors: {noSuchAntenna:noSuchAntenna___,noSuchUserList:noSuchUserList_},
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
			// Fetch the antenna
			const antenna = await this.prismaService.client.antenna.findUnique({
				where: {
					id: ps.antennaId,
					userId: me.id,
				},
			});

			if (antenna == null) {
				throw new ApiError(meta.errors.noSuchAntenna);
			}

			let userList;

			if (ps.src === 'list' && ps.userListId) {
				userList = await this.prismaService.client.user_list.findUnique({
					where: {
						id: ps.userListId,
						userId: me.id,
					},
				});

				if (userList == null) {
					throw new ApiError(meta.errors.noSuchUserList);
				}
			}

			const updated = await this.prismaService.client.antenna.update({
				where: { id: antenna.id },
				data: {
					name: ps.name,
					src: ps.src,
					userListId: userList ? userList.id : null,
					keywords: ps.keywords,
					excludeKeywords: ps.excludeKeywords,
					users: ps.users,
					caseSensitive: ps.caseSensitive,
					withReplies: ps.withReplies,
					withFile: ps.withFile,
					notify: ps.notify,
					isActive: true,
					lastUsedAt: new Date(),
				},
			});

			this.globalEventService.publishInternalEvent('antennaUpdated', updated);

			return await this.antennaEntityService.pack(updated);
		});
	}
}
