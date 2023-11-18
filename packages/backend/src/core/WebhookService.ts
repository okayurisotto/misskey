import { Injectable } from '@nestjs/common';
import { StreamMessages } from '@/server/api/stream/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RedisSubService } from '@/core/RedisSubService.js';
import { bindThis } from '@/decorators.js';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { webhook } from '@prisma/client';

@Injectable()
export class WebhookService implements OnApplicationShutdown {
	private webhooksFetched = false;
	private webhooks: webhook[] = [];

	constructor(
		private readonly redisForSub: RedisSubService,
		private readonly prismaService: PrismaService,
	) {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.redisForSub.on('message', this.onMessage);
	}

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
			const { type, body } =
				obj.message as StreamMessages['internal']['payload'];
			switch (type) {
				case 'webhookCreated':
					if (body.active) {
						this.webhooks.push({
							...body,
							createdAt: new Date(body.createdAt),
							latestSentAt: body.latestSentAt
								? new Date(body.latestSentAt)
								: null,
						});
					}
					break;
				case 'webhookUpdated':
					if (body.active) {
						const i = this.webhooks.findIndex((a) => a.id === body.id);
						if (i > -1) {
							this.webhooks[i] = {
								...body,
								createdAt: new Date(body.createdAt),
								latestSentAt: body.latestSentAt
									? new Date(body.latestSentAt)
									: null,
							};
						} else {
							this.webhooks.push({
								...body,
								createdAt: new Date(body.createdAt),
								latestSentAt: body.latestSentAt
									? new Date(body.latestSentAt)
									: null,
							});
						}
					} else {
						this.webhooks = this.webhooks.filter((a) => a.id !== body.id);
					}
					break;
				case 'webhookDeleted':
					this.webhooks = this.webhooks.filter((a) => a.id !== body.id);
					break;
				default:
					break;
			}
		}
	}

	public dispose(): void {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.redisForSub.off('message', this.onMessage);
	}

	public onApplicationShutdown(): void {
		this.dispose();
	}
}
