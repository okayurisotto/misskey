import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import {
	invalidParam,
	noSuchUserList,
	tooManyAntennas,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { AntennaEntityService } from '@/core/entities/AntennaEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { AntennaSchema } from '@/models/zod/AntennaSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { ApiError } from '../../error.js';
import type { user_list } from '@prisma/client';

const res = AntennaSchema;
export const meta = {
	tags: ['antennas'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	errors: { noSuchUserList: noSuchUserList, tooManyAntennas: tooManyAntennas },
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
			if (ps.keywords.length === 0) {
				throw new ApiError(invalidParam);
			}

			if (ps.keywords[0].every((x) => x === '')) {
				throw new ApiError(invalidParam);
			}

			const { currentAntennasCount, policies } = await awaitAll({
				currentAntennasCount: () =>
					this.prismaService.client.antenna.count({
						where: { userId: me.id },
					}),
				policies: () => this.roleService.getUserPolicies(me.id),
			});

			if (currentAntennasCount > policies.antennaLimit) {
				throw new ApiError(meta.errors.tooManyAntennas);
			}

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

			const now = new Date();

			const antenna = await this.prismaService.client.antenna.create({
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
					id: this.idService.genId(),
					createdAt: now,
					lastUsedAt: now,
					userId: me.id,
					userListId: userList?.id ?? null,
				},
			});

			this.globalEventService.publishInternalEvent('antennaCreated', antenna);

			return this.antennaEntityService.pack(antenna.id, {
				antenna: new EntityMap('id', [antenna]),
			});
		});
	}
}
