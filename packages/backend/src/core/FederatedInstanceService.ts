import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { Instance } from '@prisma/client';

@Injectable()
export class FederatedInstanceService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly utilityService: UtilityService,
	) {}

	public async fetch(host_: string): Promise<Instance> {
		const host = this.utilityService.toPuny(host_);

		const index = await this.prismaService.client.instance.findUnique({
			where: { host },
		});

		if (index == null) {
			const i = await this.prismaService.client.instance.create({
				data: {
					id: this.idService.genId(),
					host,
					firstRetrievedAt: new Date(),
				},
			});

			return i;
		} else {
			return index;
		}
	}

	public async update(id: string, data: Partial<Instance>): Promise<void> {
		await this.prismaService.client.instance.update({
			where: { id },
			data,
		});
	}
}
