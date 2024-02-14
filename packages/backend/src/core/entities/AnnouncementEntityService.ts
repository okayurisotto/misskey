import { Injectable } from '@nestjs/common';
import {
	Prisma,
	type Announcement,
	type AnnouncementRead,
} from '@prisma/client';
import { z } from 'zod';
import { pick } from 'omick';
import type { AnnouncementForAdminSchema } from '@/models/zod/AnnouncementForAdminSchema.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { PrismaService } from '../PrismaService.js';
import { IdService } from '../IdService.js';
import { PaginationQuery } from '../PrismaQueryService.js';

type AnnouncementPackData = {
	announcement: EntityMap<'id', Announcement>;
	announcement_read: EntityMap<'id', AnnouncementRead>;
};

@Injectable()
export class AnnouncementEntityService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async create(
		data: Omit<Prisma.AnnouncementCreateInput, 'id' | 'createdAt'>,
	): Promise<Announcement> {
		return await this.prismaService.client.announcement.create({
			data: {
				...data,
				id: this.idService.genId(),
				createdAt: new Date(),
			},
		});
	}

	public async showMany(
		where: Prisma.AnnouncementWhereInput,
		paginationQuery?: PaginationQuery,
	): Promise<z.infer<typeof AnnouncementForAdminSchema>[]> {
		const results = await this.prismaService.client.announcement.findMany({
			...paginationQuery,
			where:
				paginationQuery === undefined
					? where
					: { AND: [where, paginationQuery.where] },
			include: { reads: true },
		});

		return this.packMany(
			results.map((result) => result.id),
			{
				announcement: new EntityMap('id', results),
				announcement_read: new EntityMap(
					'id',
					results.flatMap((v) => v.reads),
				),
			},
		);
	}

	public async update(
		where: Prisma.AnnouncementWhereUniqueInput,
		data: Pick<Prisma.AnnouncementUpdateInput, 'imageUrl' | 'text' | 'title'>,
	): Promise<void> {
		await this.prismaService.client.announcement.update({
			where,
			data: {
				...data,
				imageUrl: data.imageUrl === '' ? null : data.imageUrl,
				updatedAt: new Date(),
			},
		});
	}

	public async delete(
		where: Prisma.AnnouncementWhereUniqueInput,
	): Promise<void> {
		await this.prismaService.client.announcement.delete({ where });
	}

	public pack(
		id: string,
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
		ids: Announcement['id'][],
		data: AnnouncementPackData,
	): z.infer<typeof AnnouncementForAdminSchema>[] {
		return ids.map((target) => this.pack(target, data));
	}
}
