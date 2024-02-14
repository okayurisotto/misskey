import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { AcctFactory } from '@/factories/AcctFactory.js';
import { StreamMessages } from '@/server/api/stream/types.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RedisService } from '@/core/RedisService.js';
import { RedisSubService } from '@/core/RedisSubService.js';
import { bindThis } from '@/decorators.js';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { Antenna, Note, User } from '@prisma/client';

@Injectable()
export class AntennaService implements OnApplicationShutdown {
	private antennasFetched = false;
	private antennas: Antenna[] = [];

	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
		private readonly redisClient: RedisService,
		private readonly redisForSub: RedisSubService,
		private readonly acctFactory: AcctFactory,
	) {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.redisForSub.on('message', this.onRedisMessage);
	}

	@bindThis
	private async onRedisMessage(_: string, data: string): Promise<void> {
		const obj = JSON.parse(data);

		if (obj.channel === 'internal') {
			const { type, body } =
				obj.message as StreamMessages['internal']['payload'];
			switch (type) {
				case 'antennaCreated':
					this.antennas.push({
						...body,
						createdAt: new Date(body.createdAt),
						lastUsedAt: new Date(body.lastUsedAt),
					});
					break;
				case 'antennaUpdated':
					this.antennas[this.antennas.findIndex((a) => a.id === body.id)] = {
						...body,
						createdAt: new Date(body.createdAt),
						lastUsedAt: new Date(body.lastUsedAt),
					};
					break;
				case 'antennaDeleted':
					this.antennas = this.antennas.filter((a) => a.id !== body.id);
					break;
				default:
					break;
			}
		}
	}

	public async addNoteToAntennas(
		note: Note,
		noteUser: { id: User['id']; username: string; host: string | null },
	): Promise<void> {
		const antennas = await this.getAntennas();
		const antennasWithMatchResult = await Promise.all(
			antennas.map((antenna) =>
				this.checkHitAntenna(antenna, note, noteUser).then(
					(hit) => [antenna, hit] as const,
				),
			),
		);
		const matchedAntennas = antennasWithMatchResult
			.filter(([, hit]) => hit)
			.map(([antenna]) => antenna);

		const redisPipeline = this.redisClient.pipeline();

		for (const antenna of matchedAntennas) {
			redisPipeline.xadd(
				`antennaTimeline:${antenna.id}`,
				'MAXLEN',
				'~',
				'200',
				'*',
				'note',
				note.id,
			);

			this.globalEventService.publishAntennaStream(antenna.id, 'note', note);
		}

		redisPipeline.exec();
	}

	// NOTE: フォローしているユーザーのノート、リストのユーザーのノート、グループのユーザーのノート指定はパフォーマンス上の理由で無効になっている

	public async checkHitAntenna(
		antenna: Antenna,
		note: Note | z.infer<typeof NoteSchema>,
		noteUser: { id: User['id']; username: string; host: string | null },
	): Promise<boolean> {
		if (note.visibility === 'specified') return false;
		if (note.visibility === 'followers') return false;

		if (!antenna.withReplies && note.replyId != null) return false;

		if (antenna.src === 'home') {
			// TODO
		} else if (antenna.src === 'list') {
			if (antenna.userListId === null) throw new Error();

			const listUsers = (
				await this.prismaService.client.user_list_joining.findMany({
					where: { userListId: antenna.userListId },
				})
			).map((x) => x.userId);

			if (!listUsers.includes(note.userId)) return false;
		} else if (antenna.src === 'users') {
			const accts = antenna.users.map((x) => {
				return this.acctFactory.parse(x);
			});

			const noteAcct = this.acctFactory.create(
				noteUser.username,
				noteUser.host,
			);

			if (accts.every((acct) => !acct.is(noteAcct))) {
				return false;
			}
		}

		const keywords = z
			.array(z.array(z.string()))
			.parse(antenna.keywords)
			// Clean up
			.map((xs) => xs.filter((x) => x !== ''))
			.filter((xs) => xs.length > 0);

		if (keywords.length > 0) {
			if (note.text == null && note.cw == null) return false;

			const _text = (note.text ?? '') + '\n' + (note.cw ?? '');

			const matched = keywords.some((and) =>
				and.every((keyword) =>
					antenna.caseSensitive
						? _text.includes(keyword)
						: _text.toLowerCase().includes(keyword.toLowerCase()),
				),
			);

			if (!matched) return false;
		}

		const excludeKeywords = z
			.array(z.array(z.string()))
			.parse(antenna.excludeKeywords)
			// Clean up
			.map((xs) => xs.filter((x) => x !== ''))
			.filter((xs) => xs.length > 0);

		if (excludeKeywords.length > 0) {
			if (note.text == null && note.cw == null) return false;

			const _text = (note.text ?? '') + '\n' + (note.cw ?? '');

			const matched = excludeKeywords.some((and) =>
				and.every((keyword) =>
					antenna.caseSensitive
						? _text.includes(keyword)
						: _text.toLowerCase().includes(keyword.toLowerCase()),
				),
			);

			if (matched) return false;
		}

		if (antenna.withFile) {
			if (note.fileIds && note.fileIds.length === 0) return false;
		}

		// TODO: eval expression

		return true;
	}

	public async getAntennas(): Promise<Antenna[]> {
		if (!this.antennasFetched) {
			this.antennas = await this.prismaService.client.antenna.findMany({
				where: { isActive: true },
			});
			this.antennasFetched = true;
		}

		return this.antennas;
	}

	public dispose(): void {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.redisForSub.off('message', this.onRedisMessage);
	}

	public onApplicationShutdown(): void {
		this.dispose();
	}
}
