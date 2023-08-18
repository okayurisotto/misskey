import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { AntennaEntityService } from '@/core/entities/AntennaEntityService.js';
import { RoleService } from '@/core/RoleService.js';
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
	errors: {
		noSuchUserList: {
			message: 'No such user list.',
			code: 'NO_SUCH_USER_LIST',
			id: '95063e93-a283-4b8b-9aa5-bcdb8df69a7f',
		},
		tooManyAntennas: {
			message: 'You cannot create antenna any more.',
			code: 'TOO_MANY_ANTENNAS',
			id: 'faf47050-e8b5-438c-913c-db2b1576fde4',
		},
	},
	res,
} as const;

export const paramDef = z.object({
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
		private readonly roleService: RoleService,
		private readonly idService: IdService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (ps.keywords.length === 0 || ps.keywords[0].every((x) => x === '')) {
				throw new Error('invalid param');
			}

			const [currentAntennasCount, policies] = await Promise.all([
				this.prismaService.client.antenna.count({ where: { userId: me.id } }),
				this.roleService.getUserPolicies(me.id),
			]);

			if (currentAntennasCount > policies.antennaLimit) {
				throw new ApiError(meta.errors.tooManyAntennas);
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

			const now = new Date();

			const antenna = await this.prismaService.client.antenna.create({
				data: {
					id: this.idService.genId(),
					createdAt: now,
					lastUsedAt: now,
					userId: me.id,
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
				},
			});

			this.globalEventService.publishInternalEvent('antennaCreated', antenna);

			return await this.antennaEntityService.pack(antenna);
		});
	}
}
