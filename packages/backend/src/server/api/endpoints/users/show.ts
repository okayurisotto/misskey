import { z } from 'zod';
import { Injectable } from '@nestjs/common';
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
import type { user } from '@prisma/client';

const res = z.union([UserDetailedSchema, z.array(UserDetailedSchema)]);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	description: 'Show the properties of a user.',
	res,
	errors: {
		failedToResolveRemoteUser: {
			message: 'Failed to resolve remote user.',
			code: 'FAILED_TO_RESOLVE_REMOTE_USER',
			id: 'ef7b9be4-9cba-4e6f-ab41-90ed171c7d3c',
			kind: 'server',
		},
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '4362f8dc-731f-4ad8-a694-be5a88922a24',
			httpStatusCode: 404,
		},
	},
} as const;

const paramDef_base = {
	host: z
		.string()
		.nullable()
		.optional()
		.describe('The local host is represented with `null`.'),
};
export const paramDef = z.union([
	z.object(paramDef_base).merge(
		z.object({
			userId: MisskeyIdSchema,
		}),
	),
	z.object(paramDef_base).merge(
		z.object({
			userIds: uniqueItems(z.array(MisskeyIdSchema)),
		}),
	),
	z.object(paramDef_base).merge(
		z.object({
			username: z.string(),
		}),
	),
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

			if ('userIds' in ps) {
				if (ps.userIds.length === 0) {
					return [];
				}

				const users = await this.prismaService.client.user.findMany({
					where: isModerator
						? { id: { in: ps.userIds } }
						: { id: { in: ps.userIds }, isSuspended: false },
				});

				// リクエストされた通りに並べ替え
				const users_: user[] = [];
				for (const id of ps.userIds) {
					users_.push(users.find((x) => x.id === id)!);
				}

				return await Promise.all(
					users_.map((u) =>
						this.userEntityService.pack(u, me, {
							detail: true,
						}),
					),
				);
			}

			let user: user | null;

			// Lookup user
			if (ps.host != null && 'username' in ps) {
				user = await this.remoteUserResolveService
					.resolveUser(ps.username.trim(), ps.host)
					.catch((err) => {
						this.apiLoggerService.logger.warn(
							`failed to resolve remote user: ${err}`,
						);
						throw new ApiError(meta.errors.failedToResolveRemoteUser);
					});
			} else {
				user = await this.prismaService.client.user.findFirst({
					where:
						'username' in ps
							? { usernameLower: ps.username.trim().toLowerCase(), host: null }
							: { id: ps.userId },
				});
			}

			if (user == null || (!isModerator && user.isSuspended)) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			if (user.host == null) {
				if (me == null && ip != null) {
					this.perUserPvChart.commitByVisitor(user, ip);
				} else if (me && me.id !== user.id) {
					this.perUserPvChart.commitByUser(user, me.id);
				}
			}

			return (await this.userEntityService.pack(user, me, {
				detail: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
