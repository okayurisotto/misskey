import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { InstancesRepository } from '@/models/index.js';
import { InstanceEntityService } from '@/core/entities/InstanceEntityService.js';
import { MetaService } from '@/core/MetaService.js';
import { DI } from '@/di-symbols.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { FederationInstanceSchema } from '@/models/zod/FederationInstanceSchema.js';

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
	limit: z.number().int().min(1).max(100).default(30),
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
		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		private instanceEntityService: InstanceEntityService,
		private metaService: MetaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.instancesRepository.createQueryBuilder('instance');

			switch (ps.sort) {
				case '+pubSub':
					query
						.orderBy('instance.followingCount', 'DESC')
						.orderBy('instance.followersCount', 'DESC');
					break;
				case '-pubSub':
					query
						.orderBy('instance.followingCount', 'ASC')
						.orderBy('instance.followersCount', 'ASC');
					break;
				case '+notes':
					query.orderBy('instance.notesCount', 'DESC');
					break;
				case '-notes':
					query.orderBy('instance.notesCount', 'ASC');
					break;
				case '+users':
					query.orderBy('instance.usersCount', 'DESC');
					break;
				case '-users':
					query.orderBy('instance.usersCount', 'ASC');
					break;
				case '+following':
					query.orderBy('instance.followingCount', 'DESC');
					break;
				case '-following':
					query.orderBy('instance.followingCount', 'ASC');
					break;
				case '+followers':
					query.orderBy('instance.followersCount', 'DESC');
					break;
				case '-followers':
					query.orderBy('instance.followersCount', 'ASC');
					break;
				case '+firstRetrievedAt':
					query.orderBy('instance.firstRetrievedAt', 'DESC');
					break;
				case '-firstRetrievedAt':
					query.orderBy('instance.firstRetrievedAt', 'ASC');
					break;
				case '+latestRequestReceivedAt':
					query.orderBy(
						'instance.latestRequestReceivedAt',
						'DESC',
						'NULLS LAST',
					);
					break;
				case '-latestRequestReceivedAt':
					query.orderBy(
						'instance.latestRequestReceivedAt',
						'ASC',
						'NULLS FIRST',
					);
					break;

				default:
					query.orderBy('instance.id', 'DESC');
					break;
			}

			if (typeof ps.blocked === 'boolean') {
				const meta = await this.metaService.fetch(true);
				if (ps.blocked) {
					query.andWhere(
						meta.blockedHosts.length === 0
							? '1=0'
							: 'instance.host IN (:...blocks)',
						{ blocks: meta.blockedHosts },
					);
				} else {
					query.andWhere(
						meta.blockedHosts.length === 0
							? '1=1'
							: 'instance.host NOT IN (:...blocks)',
						{ blocks: meta.blockedHosts },
					);
				}
			}

			if (typeof ps.notResponding === 'boolean') {
				if (ps.notResponding) {
					query.andWhere('instance.isNotResponding = TRUE');
				} else {
					query.andWhere('instance.isNotResponding = FALSE');
				}
			}

			if (typeof ps.suspended === 'boolean') {
				if (ps.suspended) {
					query.andWhere('instance.isSuspended = TRUE');
				} else {
					query.andWhere('instance.isSuspended = FALSE');
				}
			}

			if (typeof ps.federating === 'boolean') {
				if (ps.federating) {
					query.andWhere(
						'((instance.followingCount > 0) OR (instance.followersCount > 0))',
					);
				} else {
					query.andWhere(
						'((instance.followingCount = 0) AND (instance.followersCount = 0))',
					);
				}
			}

			if (typeof ps.subscribing === 'boolean') {
				if (ps.subscribing) {
					query.andWhere('instance.followersCount > 0');
				} else {
					query.andWhere('instance.followersCount = 0');
				}
			}

			if (typeof ps.publishing === 'boolean') {
				if (ps.publishing) {
					query.andWhere('instance.followingCount > 0');
				} else {
					query.andWhere('instance.followingCount = 0');
				}
			}

			if (ps.host) {
				query.andWhere('instance.host like :host', {
					host: '%' + sqlLikeEscape(ps.host.toLowerCase()) + '%',
				});
			}

			const instances = await query.limit(ps.limit).offset(ps.offset).getMany();

			return (await this.instanceEntityService.packMany(
				instances,
			)) satisfies z.infer<typeof res>;
		});
	}
}
