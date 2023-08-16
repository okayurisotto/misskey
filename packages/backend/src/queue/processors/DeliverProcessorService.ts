import { Injectable } from '@nestjs/common';
import * as Bull from 'bullmq';
import { MetaService } from '@/core/MetaService.js';
import { ApRequestService } from '@/core/activitypub/ApRequestService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import { FetchInstanceMetadataService } from '@/core/FetchInstanceMetadataService.js';
import { MemorySingleCache } from '@/misc/cache.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import ApRequestChart from '@/core/chart/charts/ap-request.js';
import FederationChart from '@/core/chart/charts/federation.js';
import { StatusError } from '@/misc/status-error.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { DeliverJobData } from '../types.js';
import type { instance } from '@prisma/client';

@Injectable()
export class DeliverProcessorService {
	private readonly suspendedHostsCache: MemorySingleCache<instance[]>;

	constructor(
		private readonly metaService: MetaService,
		private readonly utilityService: UtilityService,
		private readonly federatedInstanceService: FederatedInstanceService,
		private readonly fetchInstanceMetadataService: FetchInstanceMetadataService,
		private readonly apRequestService: ApRequestService,
		private readonly instanceChart: InstanceChart,
		private readonly apRequestChart: ApRequestChart,
		private readonly federationChart: FederationChart,
		private readonly prismaService: PrismaService,
	) {
		this.suspendedHostsCache = new MemorySingleCache<instance[]>(1000 * 60 * 60);
	}

	@bindThis
	public async process(job: Bull.Job<DeliverJobData>): Promise<string> {
		const { host } = new URL(job.data.to);

		// ブロックしてたら中断
		const meta = await this.metaService.fetch();
		if (this.utilityService.isBlockedHost(meta.blockedHosts, this.utilityService.toPuny(host))) {
			return 'skip (blocked)';
		}

		// isSuspendedなら中断
		let suspendedHosts = this.suspendedHostsCache.get();
		if (suspendedHosts == null) {
			suspendedHosts = await this.prismaService.client.instance.findMany({
				where: {
					isSuspended: true,
				},
			});
			this.suspendedHostsCache.set(suspendedHosts);
		}
		if (suspendedHosts.map(x => x.host).includes(this.utilityService.toPuny(host))) {
			return 'skip (suspended)';
		}

		try {
			await this.apRequestService.signedPost(job.data.user, job.data.to, job.data.content);

			// Update stats
			this.federatedInstanceService.fetch(host).then(i => {
				if (i.isNotResponding) {
					this.federatedInstanceService.update(i.id, {
						isNotResponding: false,
					});
				}

				this.fetchInstanceMetadataService.fetchInstanceMetadata(i);
				this.apRequestChart.deliverSucc();
				this.federationChart.deliverd(i.host, true);

				if (meta.enableChartsForFederatedInstances) {
					this.instanceChart.requestSent(i.host, true);
				}
			});

			return 'Success';
		} catch (res) {
			// Update stats
			this.federatedInstanceService.fetch(host).then(i => {
				if (!i.isNotResponding) {
					this.federatedInstanceService.update(i.id, {
						isNotResponding: true,
					});
				}

				this.apRequestChart.deliverFail();
				this.federationChart.deliverd(i.host, false);

				if (meta.enableChartsForFederatedInstances) {
					this.instanceChart.requestSent(i.host, false);
				}
			});

			if (res instanceof StatusError) {
				// 4xx
				if (res.isClientError) {
					// 相手が閉鎖していることを明示しているため、配送停止する
					if (job.data.isSharedInbox && res.statusCode === 410) {
						this.federatedInstanceService.fetch(host).then(i => {
							this.federatedInstanceService.update(i.id, {
								isSuspended: true,
							});
						});
						throw new Bull.UnrecoverableError(`${host} is gone`);
					}
					throw new Bull.UnrecoverableError(`${res.statusCode} ${res.statusMessage}`);
				}

				// 5xx etc.
				throw new Error(`${res.statusCode} ${res.statusMessage}`);
			} else {
				// DNS error, socket error, timeout ...
				throw res;
			}
		}
	}
}
