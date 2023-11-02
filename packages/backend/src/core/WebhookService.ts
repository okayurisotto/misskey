import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { StreamMessages } from '@/server/api/stream/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { webhook } from '@prisma/client';

@Injectable()
export class WebhookService implements OnApplicationShutdown {
	private webhooksFetched = false;
	private webhooks: webhook[] = [];

	constructor(
		@Inject(DI.redisForSub)
		private redisForSub: Redis.Redis,

		private readonly prismaService: PrismaService,
	) {
		//this.onMessage = this.onMessage.bind(this);
		this.redisForSub.on('message', this.onMessage);
	}

	@bindThis
	public async getActiveWebhooks(): Promise<webhook[]> {
		if (!this.webhooksFetched) {
			this.webhooks = await this.prismaService.client.webhook.findMany({
				where: { active: true },
			});
			this.webhooksFetched = true;
		}

		return this.webhooks;
	}

	@bindThis
	private async onMessage(_: string, data: string): Promise<void> {
		const obj = JSON.parse(data);

		if (obj.channel === 'internal') {
			const { type, body } = obj.message as StreamMessages['internal']['payload'];
			switch (type) {
				case 'webhookCreated':
					if (body.active) {
						this.webhooks.push({
							...body,
							createdAt: new Date(body.createdAt),
							latestSentAt: body.latestSentAt ? new Date(body.latestSentAt) : null,
						});
					}
					break;
				case 'webhookUpdated':
					if (body.active) {
						const i = this.webhooks.findIndex(a => a.id === body.id);
						if (i > -1) {
							this.webhooks[i] = {
								...body,
								createdAt: new Date(body.createdAt),
								latestSentAt: body.latestSentAt ? new Date(body.latestSentAt) : null,
							};
						} else {
							this.webhooks.push({
								...body,
								createdAt: new Date(body.createdAt),
								latestSentAt: body.latestSentAt ? new Date(body.latestSentAt) : null,
							});
						}
					} else {
						this.webhooks = this.webhooks.filter(a => a.id !== body.id);
					}
					break;
				case 'webhookDeleted':
					this.webhooks = this.webhooks.filter(a => a.id !== body.id);
					break;
				default:
					break;
			}
		}
	}

	@bindThis
	public dispose(): void {
		this.redisForSub.off('message', this.onMessage);
	}

	@bindThis
	public onApplicationShutdown(): void {
		this.dispose();
	}
}
