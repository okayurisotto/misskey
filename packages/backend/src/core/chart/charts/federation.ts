import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppLockService } from '@/core/AppLockService.js';
import { DI } from '@/di-symbols.js';
import { MetaService } from '@/core/MetaService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
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
		@Inject(DI.db)
		private readonly db: DataSource,

		private readonly metaService: MetaService,
		private readonly appLockService: AppLockService,
		private readonly chartLoggerService: ChartLoggerService,
		private readonly prismaService: PrismaService,
	) {
		super(db, (k) => appLockService.getChartInsertLock(k), chartLoggerService.logger, name, schema);
	}

	protected async tickMajor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		const meta = await this.metaService.fetch();

		const suspendedInstances = (await this.prismaService.client.instance.findMany({
			where: { isSuspended: true },
			select: { host: true },
		})).map((host) => host.host);

		const followerHosts = (await this.prismaService.client.following.findMany({
			where: { followerHost: { not: null } },
			select: { followerHost: true },
		})).map((host) => host.followerHost).filter((v): v is string => v !== null);

		const followeeHosts = (await this.prismaService.client.following.findMany({
			where: { followeeHost: { not: null } },
			select: { followeeHost: true },
		})).map((host) => host.followeeHost).filter((v): v is string => v !== null);

		const pubInstances = (await this.prismaService.client.following.findMany({
			where: { followerHost: { not: null } },
			select: { followerHost: true },
		})).map((host) => host.followerHost).filter((v): v is string => v !== null);

		const [sub, pub, pubsub, subActive, pubActive] = await Promise.all([
			this.prismaService.client.following.findMany({
				where: {
					AND: [
						{ followeeHost: { not: null } },
						(meta.blockedHosts.length === 0 ? {} : {
							followeeHost: {
								mode: 'insensitive',
								notIn: meta.blockedHosts.flatMap((host) => [host, `%.${host}%`]),
							}
						}),
						{ followeeHost: { notIn: suspendedInstances } },
					],
				},
				distinct: 'followeeHost',
			}).then((result) => result.length),
			this.prismaService.client.following.findMany({
				where: {
					AND: [
						{ followerHost: { not: null } },
						(meta.blockedHosts.length === 0 ? {} : {
							followerHost: {
								mode: 'insensitive',
								notIn: meta.blockedHosts.flatMap((host) => [host, `%.${host}%`]),
							}
						}),
						{ followerHost: { notIn: suspendedInstances } },
					],
				},
				distinct: 'followerHost',
			}).then((result) => result.length),
			this.prismaService.client.following.findMany({
				where: {
					AND: [
						{ followeeHost: { not: null } },
						(meta.blockedHosts.length === 0 ? {} : {
							followeeHost: {
								mode: 'insensitive',
								notIn: meta.blockedHosts.flatMap((host) => [host, `%.${host}%`]),
							}
						}),
						{ followeeHost: { notIn: suspendedInstances } },
						{ followeeHost: { in: followerHosts } },
					],
				},
				distinct: 'followeeHost',
			}).then((result) => result.length),
			this.prismaService.client.instance.count({
				where: {
					AND: [
						{ host: { in: followeeHosts } },
						(meta.blockedHosts.length === 0 ? {} : {
							host: {
								mode: 'insensitive',
								notIn: meta.blockedHosts.flatMap((host) => [host, `%.${host}%`]),
							}
						}),
						{ isSuspended: false },
						{ isNotResponding: false },
					],
				},
			}),
			this.prismaService.client.instance.count({
				where: {
					AND: [
						{ host: { in: pubInstances } },
						(meta.blockedHosts.length === 0 ? {} : {
							host: {
								mode: 'insensitive',
								notIn: meta.blockedHosts.flatMap((host) => [host, `%.${host}%`]),
							}
						}),
						{ isSuspended: false },
						{ isNotResponding: false },
					],
				},
			}),
		]);

		return {
			'sub': sub,
			'pub': pub,
			'pubsub': pubsub,
			'subActive': subActive,
			'pubActive': pubActive,
		};
	}

	@bindThis
	public async deliverd(host: string, succeeded: boolean): Promise<void> {
		this.commit(succeeded ? { 'deliveredInstances': [host] } : { 'stalled': [host] });
	}

	@bindThis
	public async inbox(host: string): Promise<void> {
		this.commit({ 'inboxInstances': [host] });
	}
}
