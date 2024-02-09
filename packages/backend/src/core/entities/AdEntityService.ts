import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma, Ad } from '@prisma/client';
import { pick } from 'omick';
import type { AdSchema } from '@/models/zod/AdSchema.js';
import { EntityMap } from '@/misc/EntityMap.js';
import type { AdLiteSchema } from '@/models/zod/AdLiteSchema.js';
import { PaginationQuery } from '../PrismaQueryService.js';
import { PrismaService } from '../PrismaService.js';
import { IdService } from '../IdService.js';

type AdPackData = {
	ad: EntityMap<'id', Ad>;
};

type AdLitePackData = AdPackData;

@Injectable()
export class AdEntityService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async create(
		data: Omit<Prisma.AdCreateInput, 'id' | 'createdAt'>,
	): Promise<AdPackData> {
		const result = await this.prismaService.client.ad.create({
			data: {
				...data,
				id: this.idService.genId(),
				createdAt: new Date(),
			},
		});
		return { ad: new EntityMap('id', [result]) };
	}

	public async delete(where: Prisma.AdWhereUniqueInput): Promise<void> {
		await this.prismaService.client.ad.delete({ where });
	}

	public async showMany(
		where: Prisma.AdWhereInput,
		paginationQuery?: PaginationQuery,
	): Promise<AdPackData> {
		const results = await this.prismaService.client.ad.findMany({
			...paginationQuery,
			where:
				paginationQuery === undefined
					? where
					: { AND: [where, paginationQuery.where] },
		});
		return { ad: new EntityMap('id', results) };
	}

	public async update(
		where: Prisma.AdWhereUniqueInput,
		data: Omit<Prisma.AdUpdateInput, 'id' | 'createdAt'>,
	): Promise<void> {
		await this.prismaService.client.ad.update({
			where,
			data,
		});
	}

	public packLite(
		id: string,
		data: AdLitePackData,
	): z.infer<typeof AdLiteSchema> {
		const ad = data.ad.get(id);
		return pick(ad, ['id', 'dayOfWeek', 'imageUrl', 'place', 'ratio', 'url']);
	}

	public pack(id: string, data: AdPackData): z.infer<typeof AdSchema> {
		const ad = data.ad.get(id);

		return {
			...pick(ad, [
				'dayOfWeek',
				'id',
				'imageUrl',
				'memo',
				'place',
				'priority',
				'ratio',
				'url',
			]),
			createdAt: +ad.createdAt,
			expiresAt: +ad.expiresAt,
			startsAt: +ad.startsAt,
		};
	}
}
