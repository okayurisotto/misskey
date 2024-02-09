import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { QueueService } from '@/core/QueueService.js';
import type { IActivity } from '@/core/activitypub/type.js';
import { ThinUser } from '@/queue/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

interface IRecipe {
	type: string;
}

interface IFollowersRecipe extends IRecipe {
	type: 'Followers';
}

interface IDirectRecipe extends IRecipe {
	type: 'Direct';
	to: RemoteUser;
}

const isFollowers = (recipe: IRecipe): recipe is IFollowersRecipe =>
	recipe.type === 'Followers';

const isDirect = (recipe: IRecipe): recipe is IDirectRecipe =>
	recipe.type === 'Direct';

class DeliverManager {
	private readonly actor;
	private readonly activity: IActivity | null;
	private readonly recipes: IRecipe[] = [];

	/**
	 * Constructor
	 * @param prismaService
	 * @param queueService
	 * @param actor Actor
	 * @param activity Activity to deliver
	 */
	constructor(
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,

		actor: { id: user['id']; host: null },
		activity: IActivity | null,
	) {
		// 型で弾いてはいるが一応ローカルユーザーかチェック
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (actor.host != null) throw new Error('actor.host must be null');

		// パフォーマンス向上のためキューに突っ込むのはidのみに絞る
		this.actor = {
			id: actor.id,
		};
		this.activity = activity;
	}

	/**
	 * Add recipe for followers deliver
	 */
	public addFollowersRecipe(): void {
		const deliver: IFollowersRecipe = {
			type: 'Followers',
		};

		this.addRecipe(deliver);
	}

	/**
	 * Add recipe for direct deliver
	 * @param to To
	 */
	public addDirectRecipe(to: RemoteUser): void {
		const recipe: IDirectRecipe = {
			type: 'Direct',
			to,
		};

		this.addRecipe(recipe);
	}

	/**
	 * Add recipe
	 * @param recipe Recipe
	 */
	public addRecipe(recipe: IRecipe): void {
		this.recipes.push(recipe);
	}

	/**
	 * Execute delivers
	 */
	public async execute(): Promise<void> {
		// The value flags whether it is shared or not.
		// key: inbox URL, value: whether it is sharedInbox
		const inboxes = new Map<string, boolean>();

		// build inbox list
		// Process follower recipes first to avoid duplication when processing direct recipes later.
		if (this.recipes.some((r) => isFollowers(r))) {
			// followers deliver
			// TODO: SELECT DISTINCT ON ("followerSharedInbox") "followerSharedInbox" みたいな問い合わせにすればよりパフォーマンス向上できそう
			// ただ、sharedInboxがnullなリモートユーザーも稀におり、その対応ができなさそう？
			const followers = await this.prismaService.client.following.findMany({
				where: {
					followeeId: this.actor.id,
					follower: { host: { not: null } },
				},
				include: { follower: true },
			});

			for (const following of followers) {
				const inbox =
					following.follower.sharedInbox ?? following.follower.inbox;
				if (inbox === null) throw new Error('inbox is null');
				inboxes.set(inbox, following.follower.sharedInbox != null);
			}
		}

		for (const recipe of this.recipes.filter(isDirect)) {
			// check that shared inbox has not been added yet
			if (recipe.to.sharedInbox !== null && inboxes.has(recipe.to.sharedInbox))
				continue;

			// check that they actually have an inbox
			if (recipe.to.inbox === null) continue;

			inboxes.set(recipe.to.inbox, false);
		}

		// deliver
		this.queueService.deliverMany(this.actor, this.activity, inboxes);
	}
}

@Injectable()
export class ApDeliverManagerService {
	constructor(
		private readonly queueService: QueueService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * Deliver activity to followers
	 * @param actor
	 * @param activity Activity
	 */
	public async deliverToFollowers(
		actor: { id: LocalUser['id']; host: null },
		activity: IActivity,
	): Promise<void> {
		const manager = new DeliverManager(
			this.prismaService,
			this.queueService,
			actor,
			activity,
		);
		manager.addFollowersRecipe();
		await manager.execute();
	}

	/**
	 * Deliver activity to user
	 * @param actor
	 * @param activity Activity
	 * @param to Target user
	 */
	public async deliverToUser(
		actor: { id: LocalUser['id']; host: null },
		activity: IActivity,
		to: RemoteUser,
	): Promise<void> {
		const manager = new DeliverManager(
			this.prismaService,
			this.queueService,
			actor,
			activity,
		);
		manager.addDirectRecipe(to);
		await manager.execute();
	}

	public createDeliverManager(
		actor: { id: user['id']; host: null },
		activity: IActivity | null,
	): DeliverManager {
		return new DeliverManager(
			this.prismaService,
			this.queueService,
			actor,
			activity,
		);
	}
}
