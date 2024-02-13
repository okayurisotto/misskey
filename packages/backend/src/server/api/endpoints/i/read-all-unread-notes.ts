import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'write:account',
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Remove documents
			await this.prismaService.client.noteUnread.deleteMany({
				where: { userId: me.id },
			});

			// 全て既読になったイベントを発行
			this.globalEventService.publishMainStream(me.id, 'readAllUnreadMentions');
			this.globalEventService.publishMainStream(
				me.id,
				'readAllUnreadSpecifiedNotes',
			);
		});
	}
}
