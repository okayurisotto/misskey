import { Injectable } from '@nestjs/common';
import { Prisma, announcement, announcement_read } from '@prisma/client';
import { z } from 'zod';
import { pick } from 'omick';
import type { AnnouncementForAdminSchema } from '@/models/zod/AnnouncementForAdminSchema.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { ApiError } from '@/server/api/error.js';
import { noSuchAnnouncement } from '@/server/api/errors.js';
import { PrismaService } from '../PrismaService.js';
import { IdService } from '../IdService.js';
import { PaginationQuery } from '../PrismaQueryService.js';

type AnnouncementPackData = {
	announcement: EntityMap<'id', announcement>;
	announcement_read: EntityMap<'id', announcement_read>;
};

@Injectable()
export class AnnouncementEntityService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async create(
		data: Omit<Prisma.announcementCreateInput, 'id' | 'createdAt'>,
	): Promise<announcement> {
		return await this.prismaService.client.announcement.create({
			data: {
				...data,
				id: this.idService.genId(),
				createdAt: new Date(),
			},
		});
	}

	public async showMany(
		where: Prisma.announcementWhereInput,
		paginationQuery: PaginationQuery,
	): Promise<z.infer<typeof AnnouncementForAdminSchema>[]> {
		const results = await this.prismaService.client.announcement.findMany({
			...paginationQuery,
			where: { AND: [where, paginationQuery.where] },
			include: { announcement_read: true },
		});

		return this.packMany(
			results.map((result) => result.id),
			{
				announcement: new EntityMap('id', results),
				announcement_read: new EntityMap(
					'id',
					results.map((v) => v.announcement_read).flat(),
				),
			},
		);
	}

	public async update(
		where: Prisma.announcementWhereUniqueInput,
		data: Pick<Prisma.announcementUpdateInput, 'imageUrl' | 'text' | 'title'>,
	): Promise<void> {
		try {
			await this.prismaService.client.announcement.update({
				where,
				data: {
					...data,
					imageUrl: data.imageUrl === '' ? null : data.imageUrl,
					updatedAt: new Date(),
				},
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				if (e.code === 'P2025') {
					throw new ApiError(noSuchAnnouncement);
				}
			}

			throw e;
		}
	}

	public async delete(
		where: Prisma.announcementWhereUniqueInput,
	): Promise<void> {
		await this.prismaService.client.announcement.delete({ where });
	}

	public pack(
		id: announcement['id'],
		data: AnnouncementPackData,
	): z.infer<typeof AnnouncementForAdminSchema> {
		const announcement = data.announcement.get(id);
		const reads = [...data.announcement_read.values()].filter(
			(read) => read.announcementId === id,
		);

		return {
			...pick(announcement, [
				'id',
				'createdAt',
				'updatedAt',
				'text',
				'title',
				'imageUrl',
			]),
			createdAt: announcement.createdAt.toISOString(),
			updatedAt: announcement.updatedAt?.toISOString() ?? null,
			reads: reads.length,
		};
	}

	public packMany(
		ids: announcement['id'][],
		data: AnnouncementPackData,
	): z.infer<typeof AnnouncementForAdminSchema>[] {
		return ids.map((target) => this.pack(target, data));
	}
}
