import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchFile_____ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['drive', 'notes'],
	requireCredential: true,
	kind: 'read:drive',
	description: 'Find the notes to which the given file is attached.',
	res,
	errors: { noSuchFile: noSuchFile_____ },
} as const;

export const paramDef = z.object({
	fileId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly noteEntityService: NoteEntityPackService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Fetch file
			const file = await this.prismaService.client.driveFile.findUnique({
				where: {
					id: ps.fileId,
					userId: me.id,
				},
			});

			if (file == null) {
				throw new ApiError(meta.errors.noSuchFile);
			}

			const notes = await this.prismaService.client.note.findMany({
				where: { fileIds: { has: file.id } },
			});

			return await this.noteEntityService.packMany(notes, me, {
				detail: true,
			});
		});
	}
}
