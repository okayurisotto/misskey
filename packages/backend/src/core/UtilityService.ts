import { URL } from 'node:url';
import { toASCII } from 'punycode';
import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

@Injectable()
export class UtilityService {
	constructor(private readonly configLoaderService: ConfigLoaderService) {}

	public getFullApAccount(username: string, host: string | null): string {
		return host
			? `${username}@${this.toPuny(host)}`
			: `${username}@${this.toPuny(this.configLoaderService.data.host)}`;
	}

	public isSelfHost(host: string | null): boolean {
		if (host == null) return true;
		return (
			this.toPuny(this.configLoaderService.data.host) === this.toPuny(host)
		);
	}

	public isBlockedHost(blockedHosts: string[], host: string | null): boolean {
		if (host == null) return false;
		return blockedHosts.some((x) => `.${host.toLowerCase()}`.endsWith(`.${x}`));
	}

	public extractDbHost(uri: string): string {
		const url = new URL(uri);
		return this.toPuny(url.hostname);
	}

	public toPuny(host: string): string {
		return toASCII(host.toLowerCase());
	}
}
