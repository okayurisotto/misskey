import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma, ad } from '@prisma/client';
import { AdSchema } from '@/models/zod/AdSchema.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { ApiError } from '@/server/api/error.js';
import { noSuchAd } from '@/server/api/errors.js';
import { PaginationQuery } from '../PrismaQueryService.js';
import { PrismaService } from '../PrismaService.js';
import { IdService } from '../IdService.js';

type AdPackData = {
	ad: EntityMap<'id', ad>;
};

@Injectable()
export class AdEntityService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async create(
		data: Omit<Prisma.adCreateInput, 'id' | 'createdAt'>,
	): Promise<z.infer<typeof AdSchema>> {
		const result = await this.prismaService.client.ad.create({
			data: {
				...data,
				id: this.idService.genId(),
				createdAt: new Date(),
			},
		});
		return this.pack(result, { ad: new EntityMap('id', [result]) });
	}

	public async delete(where: Prisma.adWhereUniqueInput): Promise<void> {
		try {
			await this.prismaService.client.ad.delete({ where });
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				if (e.code === 'P2025') {
					throw new ApiError(noSuchAd);
				}
			}

			throw e;
		}
	}

	public async showMany(
		where: Prisma.adWhereInput,
		paginationQuery?: PaginationQuery,
	): Promise<z.infer<typeof AdSchema>[]> {
		const result = await this.prismaService.client.ad.findMany({
			...paginationQuery,
			where: paginationQuery ? { AND: [where, paginationQuery.where] } : where,
		});

		return this.packMany(result, {
			ad: new EntityMap('id', result),
		});
	}

	public async update(
		where: Prisma.adWhereUniqueInput,
		data: Prisma.adUpdateInput,
	): Promise<void> {
		try {
			await this.prismaService.client.ad.update({
				where,
				data,
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				if (e.code === 'P2025') {
					throw new ApiError(noSuchAd);
				}
			}

			throw e;
		}
	}

	public pack(
		target: Pick<ad, 'id'>,
		data: AdPackData,
	): z.infer<typeof AdSchema> {
		const ad = data.ad.get(target.id);

		return {
			...ad,
			createdAt: +ad.createdAt,
			expiresAt: +ad.expiresAt,
			startsAt: +ad.startsAt,
		};
	}

	public packMany(
		targets: Pick<ad, 'id'>[],
		data: AdPackData,
	): z.infer<typeof AdSchema>[] {
		return targets.map((target) => this.pack(target, data));
	}
}
