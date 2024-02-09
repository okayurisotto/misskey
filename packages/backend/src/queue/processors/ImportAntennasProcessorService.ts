import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { pick } from 'omick';
import { Prisma } from '@prisma/client';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { isNotNull } from '@/misc/is-not-null.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import { DBAntennaImportJobData } from '../types.js';
import type * as Bull from 'bullmq';

const validate = z.object({
	name: z.string().min(1).max(100),
	src: z.enum(['home', 'all', 'users', 'list']),
	userListAccts: z.array(z.string()).nullable().optional(),
	keywords: z.array(z.array(z.string())),
	excludeKeywords: z.array(z.array(z.string())),
	users: z.array(z.string()),
	caseSensitive: z.boolean(),
	withReplies: z.boolean(),
	withFile: z.boolean(),
	notify: z.boolean(),
});

@Injectable()
export class ImportAntennasProcessorService {
	private readonly logger;

	constructor(
		private readonly queueLoggerService: QueueLoggerService,
		private readonly idService: IdService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('import-antennas');
	}

	public async process(job: Bull.Job<DBAntennaImportJobData>): Promise<void> {
		const now = new Date();

		const antennas = await Promise.all(
			job.data.antenna.map(async (antenna) => {
				const result = await validate.safeParseAsync(antenna);
				if (result.success) {
					return result.data;
				} else {
					this.logger.warn('Validation Failed');
					return;
				}
			}),
		);

		const data = antennas
			.filter(isNotNull)
			.filter((antenna) => {
				if (antenna.keywords.length === 0) {
					return false;
				}
				if (antenna.keywords[0].every((keyword) => keyword === '')) {
					return false;
				}
				return true;
			})
			.map<Prisma.AntennaCreateManyInput>((antenna) => ({
				id: this.idService.genId(),
				createdAt: now,
				lastUsedAt: now,
				userId: job.data.user.id,
				userListId: null,
				...pick(antenna, [
					'name',
					'keywords',
					'excludeKeywords',
					'caseSensitive',
					'withReplies',
					'withFile',
					'notify',
				]),
				src:
					antenna.src === 'list' && antenna.userListAccts != null
						? 'users'
						: antenna.src,
				users:
					antenna.src === 'list' && antenna.userListAccts != null
						? antenna.userListAccts
						: antenna.users,
			}));

		await this.prismaService.client.antenna.createMany({ data });

		const results = await this.prismaService.client.antenna.findMany({
			where: { id: { in: data.map(({ id }) => id) } },
		});

		for (const result of results) {
			this.logger.succ('Antenna created: ' + result.id);
			this.globalEventService.publishInternalEvent('antennaCreated', result);
		}
	}
}
