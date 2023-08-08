import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
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
	private readonly logger: Logger;

	constructor (
		private readonly queueLoggerService: QueueLoggerService,
		private readonly idService: IdService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('import-antennas');
	}

	@bindThis
	public async process(job: Bull.Job<DBAntennaImportJobData>): Promise<void> {
		const now = new Date();
		try {
			for (const antenna of job.data.antenna) {
				if (antenna.keywords.length === 0 || antenna.keywords[0].every(x => x === '')) continue;
				if (!validate.safeParse(antenna).success) {
					this.logger.warn('Validation Failed');
					continue;
				}
				const result = await this.prismaService.client.antenna.create({
					data: {
						id: this.idService.genId(),
						createdAt: now,
						lastUsedAt: now,
						userId: job.data.user.id,
						name: antenna.name,
						src: antenna.src === 'list' && antenna.userListAccts ? 'users' : antenna.src,
						userListId: null,
						keywords: antenna.keywords,
						excludeKeywords: antenna.excludeKeywords,
						users: (antenna.src === 'list' && antenna.userListAccts !== null ? antenna.userListAccts : antenna.users).filter(Boolean),
						caseSensitive: antenna.caseSensitive,
						withReplies: antenna.withReplies,
						withFile: antenna.withFile,
						notify: antenna.notify,
					},
				});
				this.logger.succ('Antenna created: ' + result.id);
				this.globalEventService.publishInternalEvent('antennaCreated', result);
			}
		} catch (err: any) {
			this.logger.error(err);
		}
	}
}
