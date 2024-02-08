import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import { MetaService } from '@/core/MetaService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/federation.js';
import type { KVs } from '../core.js';

/**
 * フェデレーションに関するチャート
 */
@Injectable()
// eslint-disable-next-line import/no-default-export
export default class FederationChart extends Chart<typeof schema> {
	constructor(
		db: TypeORMService,
		appLockService: AppLockService,
		chartLoggerService: ChartLoggerService,

		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
	) {
		super(
			db,
			(k) => appLockService.getChartInsertLock(k),
			chartLoggerService.logger,
			name,
			schema,
		);
	}

	protected async tickMajor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		const meta = await this.metaService.fetch();

		const suspendedInstances = (
			await this.prismaService.client.instance.findMany({
				where: { isSuspended: true },
				select: { host: true },
			})
		).map((host) => host.host);

		const followerHosts = (
			await this.prismaService.client.following.findMany({
				where: { follower: { host: { not: null } } },
				select: { follower: { select: { host: true } } },
			})
		)
			.map((host) => host.follower.host)
			.filter((v): v is string => v !== null);

		const followeeHosts = (
			await this.prismaService.client.following.findMany({
				where: { followee: { host: { not: null } } },
				select: { followee: { select: { host: true } } },
			})
		)
			.map((host) => host.followee.host)
			.filter((v): v is string => v !== null);

		const pubInstances = (
			await this.prismaService.client.following.findMany({
				where: { follower: { host: { not: null } } },
				select: { follower: { select: { host: true } } },
			})
		)
			.map((host) => host.follower.host)
			.filter((v): v is string => v !== null);

		const [sub, pub, pubsub, subActive, pubActive] = await Promise.all([
			this.prismaService.client.following
				.findMany({
					where: {
						AND: [
							{ followee: { host: { not: null } } },
							meta.blockedHosts.length === 0
								? {}
								: {
										followee: {
											host: {
												mode: 'insensitive',
												notIn: meta.blockedHosts.flatMap((host) => [
													host,
													`%.${host}%`,
												]),
											},
										},
								  },
							{ followee: { host: { notIn: suspendedInstances } } },
						],
					},
					distinct: 'followeeHost',
				})
				.then((result) => result.length),
			this.prismaService.client.following
				.findMany({
					where: {
						AND: [
							{ follower: { host: { not: null } } },
							meta.blockedHosts.length === 0
								? {}
								: {
										follower: {
											host: {
												mode: 'insensitive',
												notIn: meta.blockedHosts.flatMap((host) => [
													host,
													`%.${host}%`,
												]),
											},
										},
								  },
							{ follower: { host: { notIn: suspendedInstances } } },
						],
					},
					distinct: 'followerHost',
				})
				.then((result) => result.length),
			this.prismaService.client.following
				.findMany({
					where: {
						AND: [
							{ followee: { host: { not: null } } },
							meta.blockedHosts.length === 0
								? {}
								: {
										followee: {
											host: {
												mode: 'insensitive',
												notIn: meta.blockedHosts.flatMap((host) => [
													host,
													`%.${host}%`,
												]),
											},
										},
								  },
							{ followee: { host: { notIn: suspendedInstances } } },
							{ followee: { host: { in: followerHosts } } },
						],
					},
					distinct: 'followeeHost',
				})
				.then((result) => result.length),
			this.prismaService.client.instance.count({
				where: {
					AND: [
						{ host: { in: followeeHosts } },
						meta.blockedHosts.length === 0
							? {}
							: {
									host: {
										mode: 'insensitive',
										notIn: meta.blockedHosts.flatMap((host) => [
											host,
											`%.${host}%`,
										]),
									},
							  },
						{ isSuspended: false },
						{ isNotResponding: false },
					],
				},
			}),
			this.prismaService.client.instance.count({
				where: {
					AND: [
						{ host: { in: pubInstances } },
						meta.blockedHosts.length === 0
							? {}
							: {
									host: {
										mode: 'insensitive',
										notIn: meta.blockedHosts.flatMap((host) => [
											host,
											`%.${host}%`,
										]),
									},
							  },
						{ isSuspended: false },
						{ isNotResponding: false },
					],
				},
			}),
		]);

		return {
			sub: sub,
			pub: pub,
			pubsub: pubsub,
			subActive: subActive,
			pubActive: pubActive,
		};
	}

	public async deliverd(host: string, succeeded: boolean): Promise<void> {
		this.commit(
			succeeded ? { deliveredInstances: [host] } : { stalled: [host] },
		);
	}

	public async inbox(host: string): Promise<void> {
		this.commit({ inboxInstances: [host] });
	}
}
