import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { HashtagEntityService } from '@/core/entities/HashtagEntityService.js';
import { HashtagSchema } from '@/models/zod/HashtagSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';
import type { Prisma } from '@prisma/client';

const res = z.array(HashtagSchema);
export const meta = {
	tags: ['hashtags'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 10 }),
	attachedToUserOnly: z.boolean().default(false),
	attachedToLocalUserOnly: z.boolean().default(false),
	attachedToRemoteUserOnly: z.boolean().default(false),
	sort: z.enum([
		'+mentionedUsers',
		'-mentionedUsers',
		'+mentionedLocalUsers',
		'-mentionedLocalUsers',
		'+mentionedRemoteUsers',
		'-mentionedRemoteUsers',
		'+attachedUsers',
		'-attachedUsers',
		'+attachedLocalUsers',
		'-attachedLocalUsers',
		'+attachedRemoteUsers',
		'-attachedRemoteUsers',
	]),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly hashtagEntityService: HashtagEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const orderBy = ((): Prisma.HashtagOrderByWithRelationInput => {
				switch (ps.sort) {
					case '+mentionedUsers':
						return { mentionedUsersCount: 'desc' };
					case '-mentionedUsers':
						return { mentionedUsersCount: 'asc' };
					case '+mentionedLocalUsers':
						return { mentionedLocalUsersCount: 'desc' };
					case '-mentionedLocalUsers':
						return { mentionedLocalUsersCount: 'asc' };
					case '+mentionedRemoteUsers':
						return { mentionedRemoteUsersCount: 'desc' };
					case '-mentionedRemoteUsers':
						return { mentionedRemoteUsersCount: 'asc' };
					case '+attachedUsers':
						return { attachedUsersCount: 'desc' };
					case '-attachedUsers':
						return { attachedUsersCount: 'asc' };
					case '+attachedLocalUsers':
						return { attachedLocalUsersCount: 'desc' };
					case '-attachedLocalUsers':
						return { attachedLocalUsersCount: 'asc' };
					case '+attachedRemoteUsers':
						return { attachedRemoteUsersCount: 'desc' };
					case '-attachedRemoteUsers':
						return { attachedRemoteUsersCount: 'asc' };
				}
			})();

			const tags = await this.prismaService.client.hashtag.findMany({
				where: {
					AND: [
						{ attachedUsersCount: { not: 0 } },
						ps.attachedToLocalUserOnly
							? { attachedLocalUsersCount: { not: 0 } }
							: {},
						ps.attachedToRemoteUserOnly
							? { attachedRemoteUsersCount: { not: 0 } }
							: {},
					],
				},
				orderBy,
				take: ps.limit,
			});

			return await Promise.all(
				tags.map((tag) => this.hashtagEntityService.pack(tag)),
			);
		});
	}
}
