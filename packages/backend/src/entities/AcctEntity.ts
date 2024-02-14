import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { MetaService } from '@/core/MetaService.js';
import { HostEntity } from '@/entities/HostEntity.js';
import type { Prisma } from '@prisma/client';

export class AcctEntity {
	public readonly username;
	public readonly host;

	constructor(
		data: {
			username: string;
			host: string | null;
		},
		deps: {
			configLoaderService: ConfigLoaderService;
			metaService: MetaService;
		},
	) {
		this.username = data.username;
		this.host = new HostEntity(data.host, deps);
	}

	public is(acct: AcctEntity): boolean {
		return (
			this.username.toLowerCase() === acct.username.toLowerCase() &&
			this.host.is(acct.host)
		);
	}

	public isLocal(): boolean {
		return this.host.isSelf();
	}

	public isRemote(): boolean {
		return !this.isLocal();
	}

	public formatLong(): string {
		return `${this.username}@${this.host.toASCII()}`;
	}

	public whereUser(): Prisma.UserWhereInput {
		return {
			AND: [
				this.host.whereUser(),
				{ usernameLower: this.username.toLowerCase() },
			],
		};
	}
}
