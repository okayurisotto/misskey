import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { } from '@/models/entities/Blocking.js';
import type { DriveFolder } from '@/models/entities/DriveFolder.js';
import { bindThis } from '@/decorators.js';
import type { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { z } from 'zod';
import type { drive_folder } from '@prisma/client';

@Injectable()
export class DriveFolderEntityService {
	constructor(private readonly prismaService: PrismaService) {}

	@bindThis
	public async pack(
		src: DriveFolder['id'] | T2P<DriveFolder, drive_folder>,
		options?: {
			detail: boolean
		},
	): Promise<z.infer<typeof DriveFolderSchema>> {
		const opts = Object.assign({
			detail: false,
		}, options);

		const folder = typeof src === 'object'
			? src
			: await this.prismaService.client.drive_folder.findUniqueOrThrow({ where: { id: src } });

		const getDetail = async () => {
			if (!opts.detail) return {};

			const result = await awaitAll({
				foldersCount: () =>
					this.prismaService.client.drive_folder.count({ where: { parentId: folder.id } }),
				filesCount: () =>
					this.prismaService.client.drive_file.count({ where: { folderId: folder.id } }),
			});

			return {
				foldersCount: result.foldersCount,
				filesCount: result.filesCount,
				...(folder.parentId ? { parent: await this.pack(folder.parentId, { detail: true }) } : {}),
			};
		};

		return {
			id: folder.id,
			createdAt: folder.createdAt.toISOString(),
			name: folder.name,
			parentId: folder.parentId,
			...await getDetail(),
		};
	}
}
