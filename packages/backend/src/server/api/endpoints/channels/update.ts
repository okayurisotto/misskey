import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { ChannelSchema } from '@/models/zod/ChannelSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = ChannelSchema;
export const meta = {
	tags: ['channels'],
	requireCredential: true,
	kind: 'write:channels',
	res,
	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'f9c5467f-d492-4c3c-9a8d-a70dacc86512',
		},
		accessDenied: {
			message: 'You do not have edit privilege of the channel.',
			code: 'ACCESS_DENIED',
			id: '1fb7cb09-d46a-4fdf-b8df-057788cce513',
		},
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'e86c14a4-0da2-4032-8df3-e737a04c7f3b',
		},
	},
} as const;

export const paramDef = z.object({
	channelId: MisskeyIdSchema,
	name: z.string().min(1).max(128).optional(),
	description: z.string().min(1).max(2048).nullable().optional(),
	bannerId: MisskeyIdSchema.nullable().optional(),
	isArchived: z.boolean().nullable().optional(),
	pinnedNoteIds: z.array(MisskeyIdSchema).optional(),
	color: z.string().min(1).max(16).optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly channelEntityService: ChannelEntityService,
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.prismaService.client.channel.findUnique({
				where: { id: ps.channelId },
			});

			if (channel == null) {
				throw new ApiError(meta.errors.noSuchChannel);
			}

			const iAmModerator = await this.roleService.isModerator(me);
			if (channel.userId !== me.id && !iAmModerator) {
				throw new ApiError(meta.errors.accessDenied);
			}

			// eslint:disable-next-line:no-unnecessary-initializer
			let banner = undefined;
			if (ps.bannerId != null) {
				banner = await this.prismaService.client.drive_file.findUnique({
					where: {
						id: ps.bannerId,
						userId: me.id,
					},
				});

				if (banner == null) {
					throw new ApiError(meta.errors.noSuchFile);
				}
			} else if (ps.bannerId === null) {
				banner = null;
			}

			await this.prismaService.client.channel.update({
				where: { id: channel.id },
				data: {
					name: ps.name,
					description: ps.description,
					pinnedNoteIds: ps.pinnedNoteIds,
					color: ps.color,
					isArchived: ps.isArchived ?? undefined,
					bannerId: banner?.id,
				},
			});

			return (await this.channelEntityService.pack(
				channel.id,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
