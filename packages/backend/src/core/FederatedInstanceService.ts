import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { HostFactory } from '@/factories/HostFactory.js';
import type { Instance } from '@prisma/client';

@Injectable()
export class FederatedInstanceService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly hostFactory: HostFactory,
	) {}

	public async fetch(host_: string): Promise<Instance> {
		const host = this.hostFactory.create(host_).toASCII();

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
