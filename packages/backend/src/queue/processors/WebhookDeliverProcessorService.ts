import { Injectable } from '@nestjs/common';
import * as Bull from 'bullmq';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { StatusError } from '@/misc/status-error.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type { WebhookDeliverJobData } from '../types.js';

@Injectable()
export class WebhookDeliverProcessorService {
	private readonly logger;

	constructor(
		private readonly configLoaderService: ConfigLoaderService,

		private readonly httpRequestService: HttpRequestService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('webhook');
	}

	public async process(job: Bull.Job<WebhookDeliverJobData>): Promise<string> {
		try {
			this.logger.debug(`delivering ${job.data.webhookId}`);

			const res = await this.httpRequestService.send(job.data.to, {
				method: 'POST',
				headers: {
					'User-Agent': 'Misskey-Hooks',
					'X-Misskey-Host': this.configLoaderService.data.host,
					'X-Misskey-Hook-Id': job.data.webhookId,
					'X-Misskey-Hook-Secret': job.data.secret,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					hookId: job.data.webhookId,
					userId: job.data.userId,
					eventId: job.data.eventId,
					createdAt: job.data.createdAt,
					type: job.data.type,
					body: job.data.content,
				}),
			});

			await this.prismaService.client.webhook.update({
				where: { id: job.data.webhookId },
				data: {
					latestSentAt: new Date(),
					latestStatus: res.status,
				},
			});

			return 'Success';
		} catch (res) {
			await this.prismaService.client.webhook.update({
				where: { id: job.data.webhookId },
				data: {
					latestSentAt: new Date(),
					latestStatus: res instanceof StatusError ? res.statusCode : 1,
				},
			});

			if (res instanceof StatusError) {
				// 4xx
				if (res.isClientError) {
					throw new Bull.UnrecoverableError(`${res.statusCode} ${res.statusMessage}`);
				}

				// 5xx etc.
				throw new Error(`${res.statusCode} ${res.statusMessage}`);
			} else {
				// DNS error, socket error, timeout ...
				throw res;
			}
		}
	}
}
