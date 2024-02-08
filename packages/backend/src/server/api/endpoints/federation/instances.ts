import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { InstanceEntityService } from '@/core/entities/InstanceEntityService.js';
import { MetaService } from '@/core/MetaService.js';
import { FederationInstanceSchema } from '@/models/zod/FederationInstanceSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';
import type { Prisma } from '@prisma/client';

const res = z.array(FederationInstanceSchema);
export const meta = {
	tags: ['federation'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 3600,
	res,
} as const;

export const paramDef = z.object({
	host: z.string().nullable().optional(),
	blocked: z.boolean().nullable().optional(),
	notResponding: z.boolean().nullable().optional(),
	suspended: z.boolean().nullable().optional(),
	federating: z.boolean().nullable().optional(),
	subscribing: z.boolean().nullable().optional(),
	publishing: z.boolean().nullable().optional(),
	limit: limit({ max: 100, default: 30 }),
	offset: z.number().int().default(0),
	sort: z.string().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly instanceEntityService: InstanceEntityService,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const where_blocked =
				await (async (): Promise<Prisma.InstanceWhereInput> => {
					if (ps.blocked == null) return {};
					const meta = await this.metaService.fetch(true);

					if (ps.blocked) {
						return { host: { in: meta.blockedHosts } };
					} else {
						return { host: { notIn: meta.blockedHosts } };
					}
				})();

			const where_notResponding = ((): Prisma.InstanceWhereInput => {
				if (ps.notResponding == null) return {};
				return { isNotResponding: ps.notResponding };
			})();

			const where_suspended = ((): Prisma.InstanceWhereInput => {
				if (ps.suspended == null) return {};
				return { isSuspended: ps.suspended };
			})();

			const where_federating = ((): Prisma.InstanceWhereInput => {
				if (ps.federating == null) return {};

				if (ps.federating) {
					return {
						OR: [{ followersCount: { gt: 0 } }, { followingCount: { gt: 0 } }],
					};
				} else {
					return { followersCount: 0, followingCount: 0 };
				}
			})();

			const where_subscribing = ((): Prisma.InstanceWhereInput => {
				if (ps.subscribing == null) return {};

				if (ps.subscribing) {
					return { followersCount: { gt: 0 } };
				} else {
					return { followersCount: 0 };
				}
			})();

			const where_publishing = ((): Prisma.InstanceWhereInput => {
				if (ps.publishing == null) return {};

				if (ps.publishing) {
					return { followingCount: { gt: 0 } };
				} else {
					return { followingCount: 0 };
				}
			})();

			const where_host = ((): Prisma.InstanceWhereInput => {
				if (ps.host == null) return {};
				return { host: { contains: ps.host.toLowerCase() } };
			})();

			const orderBy = (():
				| Prisma.InstanceOrderByWithRelationInput
				| Prisma.InstanceOrderByWithRelationInput[] => {
				switch (ps.sort) {
					case '+pubSub':
						return [{ followingCount: 'desc' }, { followersCount: 'desc' }];
					case '-pubSub':
						return [{ followingCount: 'asc' }, { followersCount: 'asc' }];
					case '+notes':
						return { notesCount: 'desc' };
					case '-notes':
						return { notesCount: 'asc' };
					case '+users':
						return { usersCount: 'desc' };
					case '-users':
						return { usersCount: 'asc' };
					case '+following':
						return { followingCount: 'desc' };
					case '-following':
						return { followingCount: 'asc' };
					case '+followers':
						return { followersCount: 'desc' };
					case '-followers':
						return { followersCount: 'asc' };
					case '+firstRetrievedAt':
						return { firstRetrievedAt: 'desc' };
					case '-firstRetrievedAt':
						return { firstRetrievedAt: 'asc' };
					case '+latestRequestReceivedAt':
						return { latestRequestReceivedAt: { sort: 'desc', nulls: 'last' } };
					case '-latestRequestReceivedAt':
						return { latestRequestReceivedAt: { sort: 'asc', nulls: 'first' } };
					default:
						return { id: 'desc' };
				}
			})();

			const instances = await this.prismaService.client.instance.findMany({
				where: {
					AND: [
						where_blocked,
						where_federating,
						where_host,
						where_notResponding,
						where_publishing,
						where_subscribing,
						where_suspended,
					],
				},
				orderBy,
				take: ps.limit,
				skip: ps.offset,
			});

			return await Promise.all(
				instances.map((instance) => this.instanceEntityService.pack(instance)),
			);
		});
	}
}
