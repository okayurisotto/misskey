import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PageEntityService } from '@/core/entities/PageEntityService.js';
import { PageSchema } from '@/models/zod/PageSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = PageSchema;
export const meta = {
	tags: ['pages'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:pages',
	limit: {
		duration: ms('1hour'),
		max: 10,
	},
	res,
	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'b7b97489-0f66-4b12-a5ff-b21bd63f6e1c',
		},
		nameAlreadyExists: {
			message: 'Specified name already exists.',
			code: 'NAME_ALREADY_EXISTS',
			id: '4650348e-301c-499a-83c9-6aa988c66bc1',
		},
	},
} as const;

export const paramDef = z.object({
	title: z.string(),
	name: z.string().min(1),
	summary: z.string().nullable().optional(),
	content: z.array(z.record(z.string(), z.unknown())),
	variables: z.array(z.record(z.string(), z.unknown())),
	script: z.string(),
	eyeCatchingImageId: MisskeyIdSchema.nullable().optional(),
	font: z.enum(['serif', 'sans-serif']).default('sans-serif'),
	alignCenter: z.boolean().default(false),
	hideTitleWhenPinned: z.boolean().default(false),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly pageEntityService: PageEntityService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let eyeCatchingImage = null;
			if (ps.eyeCatchingImageId != null) {
				eyeCatchingImage =
					await this.prismaService.client.drive_file.findUnique({
						where: {
							id: ps.eyeCatchingImageId,
							userId: me.id,
						},
					});

				if (eyeCatchingImage == null) {
					throw new ApiError(meta.errors.noSuchFile);
				}
			}

			await this.prismaService.client.page
				.findMany({
					where: {
						userId: me.id,
						name: ps.name,
					},
				})
				.then((result) => {
					if (result.length > 0) {
						throw new ApiError(meta.errors.nameAlreadyExists);
					}
				});

			const page = await this.prismaService.client.page.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					updatedAt: new Date(),
					title: ps.title,
					name: ps.name,
					summary: ps.summary,
					content: ps.content,
					variables: ps.variables,
					script: ps.script,
					eyeCatchingImageId: eyeCatchingImage ? eyeCatchingImage.id : null,
					userId: me.id,
					visibility: 'public',
					alignCenter: ps.alignCenter,
					hideTitleWhenPinned: ps.hideTitleWhenPinned,
					font: ps.font,
				},
			});

			return (await this.pageEntityService.pack(page)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
