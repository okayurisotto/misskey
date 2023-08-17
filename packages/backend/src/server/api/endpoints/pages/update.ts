import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { defineOpenApiSpec } from 'zod2spec';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PageContentSchema } from '@/models/zod/PageContentSchema.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['pages'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:pages',
	limit: {
		duration: ms('1hour'),
		max: 300,
	},
	errors: {
		noSuchPage: {
			message: 'No such page.',
			code: 'NO_SUCH_PAGE',
			id: '21149b9e-3616-4778-9592-c4ce89f5a864',
		},
		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '3c15cd52-3b4b-4274-967d-6456fc4f792b',
		},
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'cfc23c7c-3887-490e-af30-0ed576703c82',
		},
		nameAlreadyExists: {
			message: 'Specified name already exists.',
			code: 'NAME_ALREADY_EXISTS',
			id: '2298a392-d4a1-44c5-9ebb-ac1aeaa5a9ab',
		},
	},
} as const;

export const paramDef = z.object({
	pageId: MisskeyIdSchema,
	title: z.string(),
	name: z.string().min(1),
	summary: z.string().nullable().optional(),
	content: PageContentSchema,
	variables: defineOpenApiSpec(z.array(z.never()), {
		type: 'array',
		maxItems: 0,
	}),
	script: z.string(),
	eyeCatchingImageId: MisskeyIdSchema.nullable().optional(),
	font: z.enum(['serif', 'sans-serif']).default('sans-serif'),
	alignCenter: z.boolean().optional(),
	hideTitleWhenPinned: z.boolean().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			const page = await this.prismaService.client.page.findUnique({
				where: { id: ps.pageId },
			});
			if (page == null) {
				throw new ApiError(meta.errors.noSuchPage);
			}
			if (page.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

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
						id: { not: ps.pageId },
						userId: me.id,
						name: ps.name,
					},
				})
				.then((result) => {
					if (result.length > 0) {
						throw new ApiError(meta.errors.nameAlreadyExists);
					}
				});

			await this.prismaService.client.page.update({
				where: { id: page.id },
				data: {
					updatedAt: new Date(),
					title: ps.title,
					name: ps.name === undefined ? page.name : ps.name,
					summary: ps.summary === undefined ? page.summary : ps.summary,
					content: ps.content,
					variables: ps.variables,
					script: ps.script,
					alignCenter:
						ps.alignCenter === undefined ? page.alignCenter : ps.alignCenter,
					hideTitleWhenPinned:
						ps.hideTitleWhenPinned === undefined
							? page.hideTitleWhenPinned
							: ps.hideTitleWhenPinned,
					font: ps.font === undefined ? page.font : ps.font,
					eyeCatchingImageId:
						ps.eyeCatchingImageId === null
							? null
							: ps.eyeCatchingImageId === undefined
							? page.eyeCatchingImageId
							: eyeCatchingImage!.id,
				},
			});
		});
	}
}
