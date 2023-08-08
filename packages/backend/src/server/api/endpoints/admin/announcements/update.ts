import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {
		noSuchAnnouncement: {
			message: 'No such announcement.',
			code: 'NO_SUCH_ANNOUNCEMENT',
			id: 'd3aae5a7-6372-4cb4-b61c-f511ffc2d7cc',
		},
	},
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
			const announcement =
				await this.prismaService.client.announcement.findUnique({
					where: { id: ps.id },
				});

			if (announcement === null) {
				throw new ApiError(meta.errors.noSuchAnnouncement);
			}

			await this.prismaService.client.announcement.update({
				where: { id: announcement.id },
				data: {
					updatedAt: new Date(),
					title: ps.title,
					text: ps.text,
					imageUrl: ps.imageUrl === '' ? null : ps.imageUrl,
				},
			});
		});
	}
}
