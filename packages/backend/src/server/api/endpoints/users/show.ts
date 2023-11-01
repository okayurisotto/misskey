import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	failedToResolveRemoteUser,
	noSuchUser__________________________,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import PerUserPvChart from '@/core/chart/charts/per-user-pv.js';
import { RoleService } from '@/core/RoleService.js';
import { MisskeyIdSchema, uniqueItems } from '@/models/zod/misc.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';
import { ApiLoggerService } from '../../ApiLoggerService.js';

const res = z.union([UserDetailedSchema, z.array(UserDetailedSchema)]);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	description: 'Show the properties of a user.',
	res,
	errors: {
		failedToResolveRemoteUser: failedToResolveRemoteUser,
		noSuchUser: noSuchUser__________________________,
	},
} as const;

export const paramDef = z.union([
	z.object({ userIds: uniqueItems(z.array(MisskeyIdSchema)) }),
	z.object({ userId: MisskeyIdSchema }),
	z.object({
		host: z
			.string()
			.nullable()
			.default(null)
			.describe('The local host is represented with `null`.'),
		username: z.string(),
	}),
]);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly remoteUserResolveService: RemoteUserResolveService,
		private readonly roleService: RoleService,
		private readonly perUserPvChart: PerUserPvChart,
		private readonly apiLoggerService: ApiLoggerService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me, _1, _2, _3, ip) => {
			const isModerator = await this.roleService.isModerator(me);

			if ('userId' in ps) {
				const user = await this.prismaService.client.user.findUnique({
					where: {
						id: ps.userId,
						...(isModerator ? {} : { isSuspended: false }),
					},
				});

				if (user === null) {
					throw new ApiError(meta.errors.noSuchUser);
				}

				return await this.userEntityService.packDetailed(user, me);
			}

			if ('username' in ps) {
				if (ps.host === null) {
					const user = await this.prismaService.client.user.findFirst({
						where: {
							usernameLower: ps.username.trim().toLowerCase(),
							host: null,
							...(isModerator ? {} : { isSuspended: false }),
						},
					});

					if (user === null) {
						throw new ApiError(meta.errors.noSuchUser);
					}

					if (me === null) {
						if (ip != null) {
							this.perUserPvChart.commitByVisitor(user, ip);
						}
					} else {
						if (me.id !== user.id) {
							this.perUserPvChart.commitByUser(user, me.id);
						}
					}

					return await this.userEntityService.packDetailed(user, me);
				} else {
					const user = await this.remoteUserResolveService
						.resolveUser(ps.username.trim(), ps.host)
						.catch((err) => {
							this.apiLoggerService.logger.warn(
								`failed to resolve remote user: ${err}`,
							);
							throw new ApiError(meta.errors.failedToResolveRemoteUser);
						});

					if (!isModerator && user.isSuspended) {
						throw new ApiError(meta.errors.noSuchUser);
					}

					return await this.userEntityService.packDetailed(user, me);
				}
			}

			if ('userIds' in ps) {
				if (ps.userIds.length === 0) return [];

				const users = await this.prismaService.client.user.findMany({
					where: isModerator
						? { id: { in: ps.userIds } }
						: { id: { in: ps.userIds }, isSuspended: false },
				});

				return await Promise.all(
					ps.userIds
						// リクエストされた通りに並べ替え
						.map((id) => {
							const user = users.find((user) => user.id === id);
							if (user === undefined) {
								throw new ApiError(meta.errors.noSuchUser);
							}
							return user;
						})
						.map((user) => this.userEntityService.packDetailed(user, me)),
				);
			}

			return ps satisfies never;
		});
	}
}
