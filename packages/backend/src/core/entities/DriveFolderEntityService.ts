import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { z } from 'zod';
import type { DriveFolder } from '@prisma/client';

@Injectable()
export class DriveFolderEntityService {
	constructor(private readonly prismaService: PrismaService) {}

	/**
	 * `drive_folder`をpackする。
	 *
	 * @param src
	 * @param options.detail `true`だった場合、`parent`が再帰的に解決される。
	 * @returns
	 */
	public async pack(
		src: DriveFolder['id'] | DriveFolder,
		options?: {
			detail: boolean;
		},
	): Promise<z.infer<typeof DriveFolderSchema>> {
		const opts = {
			detail: false,
			...options,
		};

		const folder =
			typeof src === 'object'
				? src
				: await this.prismaService.client.driveFolder.findUniqueOrThrow({
						where: { id: src },
				  });

		const getDetail = async (): Promise<
			| Record<string, never>
			| {
					foldersCount: number;
					filesCount: number;
					parent?: z.infer<typeof DriveFolderSchema>;
			  }
		> => {
			if (!opts.detail) return {};

			const result = await awaitAll({
				foldersCount: () =>
					this.prismaService.client.driveFolder.count({
						where: { parentId: folder.id },
					}),
				filesCount: () =>
					this.prismaService.client.driveFile.count({
						where: { folderId: folder.id },
					}),
			});

			return {
				foldersCount: result.foldersCount,
				filesCount: result.filesCount,
				...(folder.parentId
					? { parent: await this.pack(folder.parentId, { detail: true }) }
					: {}),
			};
		};

		return {
			id: folder.id,
			createdAt: folder.createdAt.toISOString(),
			name: folder.name,
			parentId: folder.parentId,
			...(await getDetail()),
		};
	}
}
