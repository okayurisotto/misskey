import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { InstancesRepository } from '@/models/index.js';
import type { } from '@/models/entities/Blocking.js';
import type { Instance } from '@/models/entities/Instance.js';
import { MetaService } from '@/core/MetaService.js';
import { bindThis } from '@/decorators.js';
import type { FederationInstanceSchema } from '@/models/zod/FederationInstanceSchema.js';
import { UtilityService } from '../UtilityService.js';
import type { z } from 'zod';

@Injectable()
export class InstanceEntityService {
	constructor(
		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		private metaService: MetaService,

		private utilityService: UtilityService,
	) {
	}

	@bindThis
	public async pack(
		instance: Instance,
	): Promise<z.infer<typeof FederationInstanceSchema>> {
		const meta = await this.metaService.fetch();
		return {
			id: instance.id,
			firstRetrievedAt: instance.firstRetrievedAt.toISOString(),
			host: instance.host,
			usersCount: instance.usersCount,
			notesCount: instance.notesCount,
			followingCount: instance.followingCount,
			followersCount: instance.followersCount,
			isNotResponding: instance.isNotResponding,
			isSuspended: instance.isSuspended,
			isBlocked: this.utilityService.isBlockedHost(meta.blockedHosts, instance.host),
			softwareName: instance.softwareName,
			softwareVersion: instance.softwareVersion,
			openRegistrations: instance.openRegistrations,
			name: instance.name,
			description: instance.description,
			maintainerName: instance.maintainerName,
			maintainerEmail: instance.maintainerEmail,
			iconUrl: instance.iconUrl,
			faviconUrl: instance.faviconUrl,
			themeColor: instance.themeColor,
			infoUpdatedAt: instance.infoUpdatedAt ? instance.infoUpdatedAt.toISOString() : null,
		};
	}

	@bindThis
	public packMany(
		instances: Instance[],
	) {
		return Promise.all(instances.map(x => this.pack(x)));
	}
}

