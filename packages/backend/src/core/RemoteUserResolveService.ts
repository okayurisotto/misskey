import { URL } from 'node:url';
import { Injectable } from '@nestjs/common';
import chalk from 'chalk';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import type Logger from '@/misc/logger.js';
import { UtilityService } from '@/core/UtilityService.js';
import { ILink, WebfingerService } from '@/core/WebfingerService.js';
import { RemoteLoggerService } from '@/core/RemoteLoggerService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { ApPersonCreateService } from './activitypub/models/ApPersonCreateService.js';
import { ApPersonUpdateService } from './activitypub/models/ApPersonUpdateService.js';
import { ApUriParseService } from './activitypub/ApUriParseService.js';
import { ApUserIdResolverService } from './activitypub/ApUserIdResolverService.js';

@Injectable()
export class RemoteUserResolveService {
	private readonly logger;

	constructor(
		private readonly apPersonCreateService: ApPersonCreateService,
		private readonly apPersonUpdateService: ApPersonUpdateService,
		private readonly apUriParseService: ApUriParseService,
		private readonly apUserIdResolverService: ApUserIdResolverService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly prismaService: PrismaService,
		private readonly remoteLoggerService: RemoteLoggerService,
		private readonly utilityService: UtilityService,
		private readonly webfingerService: WebfingerService,
	) {
		this.logger =
			this.remoteLoggerService.logger.createSubLogger('resolve-user');
	}

	public async resolveUser(
		username: string,
		host_: string | null,
	): Promise<LocalUser | RemoteUser> {
		const usernameLower = username.toLowerCase();

		if (host_ === null) {
			this.logger.info(`return local user: ${usernameLower}`);
			const user = await this.prismaService.client.user.findFirst({
				where: { usernameLower, host: null },
			});
			if (user === null) throw new Error('user not found');
			return user as LocalUser;
		}

		const host = this.utilityService.toPuny(host_);

		if (this.configLoaderService.data.host === host) {
			this.logger.info(`return local user: ${usernameLower}`);
			return (await this.prismaService.client.user
				.findFirst({
					where: { usernameLower, host: null },
				})
				.then((u) => {
					if (u == null) {
						throw new Error('user not found');
					} else {
						return u;
					}
				})) as LocalUser;
		}

		const user = (await this.prismaService.client.user.findFirst({
			where: { usernameLower, host },
		})) as RemoteUser | null;

		const acctLower = `${usernameLower}@${host}`;

		if (user == null) {
			const self = await this.resolveSelf(acctLower);

			if (self.href.startsWith(this.configLoaderService.data.url)) {
				const local = this.apUriParseService.parse(self.href);
				if (local.local && local.type === 'users') {
					// the LR points to local
					return (await this.apUserIdResolverService
						.getUserFromApId(self.href)
						.then((u) => {
							if (u == null) {
								throw new Error('local user not found');
							} else {
								return u;
							}
						})) as LocalUser;
				}
			}

			this.logger.succ(`return new remote user: ${chalk.magenta(acctLower)}`);
			return await this.apPersonCreateService.create(self.href);
		}

		// ユーザー情報が古い場合は、WebFingerからやりなおして返す
		if (
			user.lastFetchedAt == null ||
			Date.now() - user.lastFetchedAt.getTime() > 1000 * 60 * 60 * 24
		) {
			// 繋がらないインスタンスに何回も試行するのを防ぐ, 後続の同様処理の連続試行を防ぐ ため 試行前にも更新する
			await this.prismaService.client.user.update({
				where: { id: user.id },
				data: { lastFetchedAt: new Date() },
			});

			this.logger.info(`try resync: ${acctLower}`);
			const self = await this.resolveSelf(acctLower);

			if (user.uri !== self.href) {
				// if uri mismatch, Fix (user@host <=> AP's Person id(RemoteUser.uri)) mapping.
				this.logger.info(`uri missmatch: ${acctLower}`);
				this.logger.info(
					`recovery missmatch uri for (username=${username}, host=${host}) from ${user.uri} to ${self.href}`,
				);

				// validate uri
				const uri = new URL(self.href);
				if (uri.hostname !== host) {
					throw new Error('Invalid uri');
				}

				await this.prismaService.client.user.update({
					where: { usernameLower_host: { usernameLower, host } },
					data: { uri: self.href },
				});
			} else {
				this.logger.info(`uri is fine: ${acctLower}`);
			}

			await this.apPersonUpdateService.update(self.href);

			this.logger.info(`return resynced remote user: ${acctLower}`);
			return await this.prismaService.client.user
				.findFirst({ where: { uri: self.href } })
				.then((u) => {
					if (u == null) {
						throw new Error('user not found');
					} else {
						return u as LocalUser | RemoteUser;
					}
				});
		}

		this.logger.info(`return existing remote user: ${acctLower}`);
		return user;
	}

	private async resolveSelf(acctLower: string): Promise<ILink> {
		this.logger.info(`WebFinger for ${chalk.yellow(acctLower)}`);
		const finger = await this.webfingerService
			.webfinger(acctLower)
			.catch((err) => {
				this.logger.error(
					`Failed to WebFinger for ${chalk.yellow(acctLower)}: ${
						err.statusCode ?? err.message
					}`,
				);
				throw new Error(
					`Failed to WebFinger for ${acctLower}: ${
						err.statusCode ?? err.message
					}`,
				);
			});
		const self = finger.links.find(
			(link) => link.rel != null && link.rel.toLowerCase() === 'self',
		);
		if (!self) {
			this.logger.error(
				`Failed to WebFinger for ${chalk.yellow(
					acctLower,
				)}: self link not found`,
			);
			throw new Error('self link not found');
		}
		return self;
	}
}
