import { URL } from 'node:url';
import { toASCII } from 'punycode';
import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

@Injectable()
export class UtilityService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
	) {}

	@bindThis
	public getFullApAccount(username: string, host: string | null): string {
		return host ? `${username}@${this.toPuny(host)}` : `${username}@${this.toPuny(this.configLoaderService.data.host)}`;
	}

	@bindThis
	public isSelfHost(host: string | null): boolean {
		if (host == null) return true;
		return this.toPuny(this.configLoaderService.data.host) === this.toPuny(host);
	}

	@bindThis
	public isBlockedHost(blockedHosts: string[], host: string | null): boolean {
		if (host == null) return false;
		return blockedHosts.some(x => `.${host.toLowerCase()}`.endsWith(`.${x}`));
	}

	@bindThis
	public extractDbHost(uri: string): string {
		const url = new URL(uri);
		return this.toPuny(url.hostname);
	}

	@bindThis
	public toPuny(host: string): string {
		return toASCII(host.toLowerCase());
	}

	@bindThis
	public toPunyNullable(host: string | null | undefined): string | null {
		if (host == null) return null;
		return toASCII(host.toLowerCase());
	}
}
