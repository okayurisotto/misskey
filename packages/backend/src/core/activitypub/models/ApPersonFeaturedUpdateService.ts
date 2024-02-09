import { Injectable } from '@nestjs/common';
import promiseLimit from 'promise-limit';
import { ModuleRef } from '@nestjs/core';
import type Logger from '@/misc/logger.js';
import { IdService } from '@/core/IdService.js';
import { toArray } from '@/misc/prelude/array.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';
import {
	getApType,
	isCollection,
	isCollectionOrOrderedCollection,
} from '../type.js';
import { ApLoggerService } from '../ApLoggerService.js';
import { ApResolverService, type Resolver } from '../ApResolverService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { ApNoteService } from './ApNoteService.js';
import type { Note, user } from '@prisma/client';

@Injectable()
export class ApPersonFeaturedUpdateService implements OnModuleInit {
	private readonly logger;

	private apNoteService: ApNoteService;

	constructor(
		private readonly moduleRef: ModuleRef,

		private readonly apLoggerService: ApLoggerService,
		private readonly apResolverService: ApResolverService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {
		this.logger = this.apLoggerService.logger;
	}

	public onModuleInit(): void {
		this.apNoteService = this.moduleRef.get('ApNoteService');
	}

	public async update(userId: string, resolver?: Resolver): Promise<void> {
		const user = await this.prismaService.client.user.findUniqueOrThrow({
			where: { id: userId },
		});
		if (!this.userEntityUtilService.isRemoteUser(user)) return;
		if (!user.featured) return;

		this.logger.info(`Updating the featured: ${user.uri}`);

		const _resolver = resolver ?? this.apResolverService.createResolver();

		// Resolve to (Ordered)Collection Object
		const collection = await _resolver.resolveCollection(user.featured);
		if (!isCollectionOrOrderedCollection(collection))
			throw new Error('Object is not Collection or OrderedCollection');

		// Resolve to Object(may be Note) arrays
		const unresolvedItems = isCollection(collection)
			? collection.items
			: collection.orderedItems;
		const items = await Promise.all(
			toArray(unresolvedItems).map((x) => _resolver.resolve(x)),
		);

		// Resolve and regist Notes
		const limit = promiseLimit<Note | null>(2);
		const featuredNotes = await Promise.all(
			items
				.filter((item) => getApType(item) === 'Note') // TODO: Noteでなくてもいいかも
				.slice(0, 5)
				.map((item) =>
					limit(() =>
						this.apNoteService.resolveNote(item, {
							resolver: _resolver,
							sentFrom: new URL(user.uri),
						}),
					),
				),
		);

		await this.prismaService.client.$transaction(async (client) => {
			await client.user_note_pining.deleteMany({ where: { userId: user.id } });

			// とりあえずidを別の時間で生成して順番を維持
			let td = 0;
			for (const note of featuredNotes.filter(
				(note): note is Note => note != null,
			)) {
				td -= 1000;
				client.user_note_pining.create({
					data: {
						id: this.idService.genId(new Date(Date.now() + td)),
						createdAt: new Date(),
						userId: user.id,
						noteId: note.id,
					},
				});
			}
		});
	}
}
