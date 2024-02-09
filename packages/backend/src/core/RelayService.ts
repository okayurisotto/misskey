import { Injectable } from '@nestjs/common';
import type { LocalUser } from '@/models/entities/User.js';
import { IdService } from '@/core/IdService.js';
import { MemorySingleCacheF } from '@/misc/cache/MemorySingleCacheF.js';
import { QueueService } from '@/core/QueueService.js';
import { CreateSystemUserService } from '@/core/CreateSystemUserService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { deepClone } from '@/misc/clone.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { relay, user } from '@prisma/client';

const ACTOR_USERNAME = 'relay.actor' as const;

@Injectable()
export class RelayService {
	private readonly relaysCache = new MemorySingleCacheF<relay[]>(
		1000 * 60 * 10,
		async () => {
			return await this.prismaService.client.relay.findMany({
				where: { status: 'accepted' },
			});
		},
	);

	constructor(
		private readonly apRendererService: ApRendererService,
		private readonly createSystemUserService: CreateSystemUserService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
	) {}

	private async getRelayActor(): Promise<LocalUser> {
		const user = await this.prismaService.client.user.findFirst({
			where: {
				host: null,
				username: ACTOR_USERNAME,
			},
		});

		if (user) return user as LocalUser;

		const created =
			await this.createSystemUserService.createSystemUser(ACTOR_USERNAME);
		return created as LocalUser;
	}

	public async addRelay(inbox: string): Promise<relay> {
		const relay = await this.prismaService.client.relay.create({
			data: {
				id: this.idService.genId(),
				inbox,
				status: 'requesting',
			},
		});

		const relayActor = await this.getRelayActor();
		const follow = await this.apRendererService.renderFollowRelay(
			relay,
			relayActor,
		);
		const activity = this.apRendererService.addContext(follow);
		this.queueService.deliver(relayActor, activity, relay.inbox, false);

		return relay;
	}

	public async removeRelay(inbox: string): Promise<void> {
		const relay = await this.prismaService.client.relay.findUnique({
			where: { inbox },
		});

		if (relay == null) {
			throw new Error('relay not found');
		}

		const relayActor = await this.getRelayActor();
		const follow = this.apRendererService.renderFollowRelay(relay, relayActor);
		const undo = this.apRendererService.renderUndo(follow, relayActor);
		const activity = this.apRendererService.addContext(undo);
		this.queueService.deliver(relayActor, activity, relay.inbox, false);

		await this.prismaService.client.relay.delete({ where: { id: relay.id } });
	}

	public async listRelay(): Promise<relay[]> {
		const relays = await this.prismaService.client.relay.findMany();
		return relays;
	}

	public async relayAccepted(id: string): Promise<string> {
		await this.prismaService.client.relay.update({
			where: { id },
			data: { status: 'accepted' },
		});

		return 'relayAccepted';
	}

	public async relayRejected(id: string): Promise<string> {
		await this.prismaService.client.relay.update({
			where: { id },
			data: { status: 'rejected' },
		});

		return 'relayRejected';
	}

	public async deliverToRelays(
		user: { id: user['id']; host: null },
		activity: any,
	): Promise<void> {
		if (activity == null) return;

		const relays = await this.relaysCache.fetch();
		if (relays.length === 0) return;

		const copy = deepClone(activity);
		if (!copy.to) copy.to = ['https://www.w3.org/ns/activitystreams#Public'];

		const signed = await this.apRendererService.attachLdSignature(copy, user);

		for (const relay of relays) {
			this.queueService.deliver(user, signed, relay.inbox, false);
		}
	}
}
