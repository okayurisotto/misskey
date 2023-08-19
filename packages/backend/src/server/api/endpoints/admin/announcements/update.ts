import { noSuchAnnouncement_ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {noSuchAnnouncement:noSuchAnnouncement_},
} as const;

export const paramDef = z.object({
	id: MisskeyIdSchema,
	title: z.string().min(1),
	text: z.string().min(1),
	imageUrl: z.string().min(0).nullable(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps) => {
			try {
				await this.prismaService.client.announcement.update({
					where: { id: ps.id },
					data: {
						updatedAt: new Date(),
						title: ps.title,
						text: ps.text,
						imageUrl: ps.imageUrl === '' ? null : ps.imageUrl,
					},
				});
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError) {
					if (e.code === 'P2025') {
						throw new ApiError(meta.errors.noSuchAnnouncement);
					}
				}

				throw e;
			}
		});
	}
}
