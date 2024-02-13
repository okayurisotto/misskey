import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { MeiliSearchService } from '@/core/MeiliSearchService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type { Index } from 'meilisearch';
import type { Note, User } from '@prisma/client';

type K = string;
type V = string | number | boolean;
type Q =
	| { op: '='; k: K; v: V }
	| { op: '!='; k: K; v: V }
	| { op: '>'; k: K; v: number }
	| { op: '<'; k: K; v: number }
	| { op: '>='; k: K; v: number }
	| { op: '<='; k: K; v: number }
	| { op: 'and'; qs: Q[] }
	| { op: 'or'; qs: Q[] }
	| { op: 'not'; q: Q };

const compileValue = (value: V): string => {
	if (typeof value === 'string') {
		return `'${value}'`; // TODO: escape
	} else if (typeof value === 'number') {
		return value.toString();
	} else if (typeof value === 'boolean') {
		return value.toString();
	} else {
		return value satisfies never;
	}
};

const compileQuery = (q: Q): string => {
	switch (q.op) {
		case '=':
			return `(${q.k} = ${compileValue(q.v)})`;
		case '!=':
			return `(${q.k} != ${compileValue(q.v)})`;
		case '>':
			return `(${q.k} > ${compileValue(q.v)})`;
		case '<':
			return `(${q.k} < ${compileValue(q.v)})`;
		case '>=':
			return `(${q.k} >= ${compileValue(q.v)})`;
		case '<=':
			return `(${q.k} <= ${compileValue(q.v)})`;
		case 'and':
			return q.qs.length === 0
				? ''
				: `(${q.qs.map((_q) => compileQuery(_q)).join(' AND ')})`;
		case 'or':
			return q.qs.length === 0
				? ''
				: `(${q.qs.map((_q) => compileQuery(_q)).join(' OR ')})`;
		case 'not':
			return `(NOT ${compileQuery(q.q)})`;
		default:
			return q satisfies never;
	}
};

@Injectable()
export class SearchService implements OnApplicationBootstrap {
	private meilisearchIndexScope: 'local' | 'global' | string[] = 'local';
	private meilisearchNoteIndex: Index | null = null;

	constructor(
		private readonly configLoaderService: ConfigLoaderService,

		private readonly meiliSearchService: MeiliSearchService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {}

	public async onApplicationBootstrap(): Promise<void> {
		if (
			this.configLoaderService.data.meilisearch &&
			this.meiliSearchService.instance
		) {
			this.meilisearchNoteIndex = this.meiliSearchService.instance.index(
				`${this.configLoaderService.data.meilisearch.index}---notes`,
			);
			await this.meilisearchNoteIndex.updateSettings({
				searchableAttributes: ['text', 'cw'],
				sortableAttributes: ['createdAt'],
				filterableAttributes: [
					'createdAt',
					'userId',
					'userHost',
					'channelId',
					'tags',
				],
				typoTolerance: { enabled: false },
				pagination: { maxTotalHits: 10000 },
			});
		}

		if (this.configLoaderService.data.meilisearch?.scope) {
			this.meilisearchIndexScope =
				this.configLoaderService.data.meilisearch.scope;
		}
	}

	public async indexNote(note: Note): Promise<void> {
		if (note.text == null && note.cw == null) return;
		if (!['home', 'public'].includes(note.visibility)) return;
		if (this.meilisearchNoteIndex === null) return;

		switch (this.meilisearchIndexScope) {
			case 'global':
				break;

			case 'local':
				if (note.userHost == null) break;
				return;

			default: {
				if (note.userHost == null) break;
				if (this.meilisearchIndexScope.includes(note.userHost)) break;
				return;
			}
		}

		await this.meilisearchNoteIndex.addDocuments(
			[
				{
					id: note.id,
					createdAt: note.createdAt.getTime(),
					userId: note.userId,
					userHost: note.userHost,
					channelId: note.channelId,
					cw: note.cw,
					text: note.text,
					tags: note.tags,
				},
			],
			{ primaryKey: 'id' },
		);
	}

	public async unindexNote(note: Note): Promise<void> {
		if (!['home', 'public'].includes(note.visibility)) return;
		if (this.meilisearchNoteIndex === null) return;

		await this.meilisearchNoteIndex.deleteDocument(note.id);
	}

	public async searchNote(
		q: string,
		me: User | null,
		opts: {
			userId?: Note['userId'] | null;
			channelId?: Note['channelId'] | null;
			host?: string | null;
		},
		pagination: {
			untilId?: Note['id'];
			sinceId?: Note['id'];
			limit?: number;
		},
	): Promise<Note[]> {
		if (this.meilisearchNoteIndex) {
			const filter: Q = { op: 'and', qs: [] };

			if (pagination.untilId) {
				filter.qs.push({
					op: '<',
					k: 'createdAt',
					v: this.idService.parse(pagination.untilId).date.getTime(),
				});
			}

			if (pagination.sinceId) {
				filter.qs.push({
					op: '>',
					k: 'createdAt',
					v: this.idService.parse(pagination.sinceId).date.getTime(),
				});
			}

			if (opts.userId) {
				filter.qs.push({ op: '=', k: 'userId', v: opts.userId });
			}

			if (opts.channelId) {
				filter.qs.push({ op: '=', k: 'channelId', v: opts.channelId });
			}

			if (opts.host) {
				if (opts.host === '.') {
					// TODO: Meilisearchが2023/05/07現在値がNULLかどうかのクエリが書けない
				} else {
					filter.qs.push({ op: '=', k: 'userHost', v: opts.host });
				}
			}

			const res = await this.meilisearchNoteIndex.search(q, {
				sort: ['createdAt:desc'],
				matchingStrategy: 'all',
				attributesToRetrieve: ['id', 'createdAt'],
				filter: compileQuery(filter),
				limit: pagination.limit,
			});
			if (res.hits.length === 0) return [];

			const notes = await this.prismaService.client.note.findMany({
				where: { id: { in: res.hits.map((x) => x['id']) } },
			});

			return notes.sort((a, b) => (a.id > b.id ? -1 : 1));
		} else {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: pagination.sinceId,
				untilId: pagination.untilId,
			});

			return await this.prismaService.client.note.findMany({
				where: {
					AND: [
						{ text: { contains: q, mode: 'insensitive' } },
						{ userId: opts.userId ?? undefined },
						{ channelId: opts.channelId ?? undefined },
						paginationQuery.where,
						this.prismaQueryService.getVisibilityWhereForNote(me?.id ?? null),
						await this.prismaQueryService.getMutingWhereForNote(me?.id ?? null),
						this.prismaQueryService.getBlockedWhereForNote(me?.id ?? null),
					],
				},
				orderBy: paginationQuery.orderBy,
				take: pagination.limit,
			});
		}
	}
}
