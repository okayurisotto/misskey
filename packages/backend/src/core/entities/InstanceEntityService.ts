import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import type { FederationInstanceSchema } from '@/models/zod/FederationInstanceSchema.js';
import type { FederationInstanceLiteSchema } from '@/models/zod/FederationInstanceLiteSchema.js';
import { HostFactory } from '@/factories/HostFactory.js';
import type { z } from 'zod';
import type { Instance } from '@prisma/client';

@Injectable()
export class InstanceEntityService {
	constructor(private readonly hostFactory: HostFactory) {}

	public packLite(
		instance: Instance,
	): z.infer<typeof FederationInstanceLiteSchema> {
		return pick(instance, [
			'name',
			'softwareName',
			'softwareVersion',
			'iconUrl',
			'faviconUrl',
			'themeColor',
		]);
	}

	public async pack(
		instance: Instance,
	): Promise<z.infer<typeof FederationInstanceSchema>> {
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
			isBlocked: await this.hostFactory.create(instance.host).isBlocked(),
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
			infoUpdatedAt: instance.infoUpdatedAt
				? instance.infoUpdatedAt.toISOString()
				: null,
		};
	}
}
