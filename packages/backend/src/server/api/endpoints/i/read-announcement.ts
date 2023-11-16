import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchAnnouncement__ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'write:account',
	errors: { noSuchAnnouncement: noSuchAnnouncement__ },
} as const;

export const paramDef = z.object({
	announcementId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly idService: IdService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Check if announcement exists
			const announcementExist =
				(await this.prismaService.client.announcement.count({
					where: { id: ps.announcementId },
					take: 1,
				})) > 0;

			if (!announcementExist) {
				throw new ApiError(meta.errors.noSuchAnnouncement);
			}

			// Check if already read
			const alreadyRead =
				(await this.prismaService.client.announcement_read.count({
					where: {
						announcementId: ps.announcementId,
						userId: me.id,
					},
					take: 1,
				})) > 0;

			if (alreadyRead) return;

			// Create read
			await this.prismaService.client.announcement_read.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					announcementId: ps.announcementId,
					userId: me.id,
				},
			});

			if (!(await this.userEntityService.getHasUnreadAnnouncement(me.id))) {
				this.globalEventService.publishMainStream(
					me.id,
					'readAllAnnouncements',
				);
			}
		});
	}
}
