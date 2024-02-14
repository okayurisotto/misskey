import { toASCII, toUnicode } from 'punycode';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { MetaService } from '@/core/MetaService.js';
import { HostFilterEntity } from '@/entities/HostFilterEntity.js';
import type { Prisma } from '@prisma/client';

export class HostEntity {
	public readonly value;
	private readonly omitted;

	constructor(
		value: string | null,
		private readonly deps: Readonly<{
			configLoaderService: ConfigLoaderService;
			metaService: MetaService;
		}>,
	) {
		if (value === null) {
			this.value = this.deps.configLoaderService.data.host;
			this.omitted = true;
		} else {
			this.value = value.toLowerCase();
			this.omitted = false;
		}
	}

	public is(host: HostEntity): boolean {
		return this.value === host.value;
	}

	public isOmitted(): boolean {
		return this.omitted;
	}

	public isSelf(): boolean {
		return this.value === this.deps.configLoaderService.data.host;
	}

	public async isBlocked(): Promise<boolean> {
		const meta = await this.deps.metaService.fetch();

		return meta.blockedHosts
			.map((blockedHost) => new HostFilterEntity(blockedHost))
			.some((hostFilter) => hostFilter.test(this));
	}

	public toASCII(): string {
		return toASCII(this.value);
	}

	public toUnicode(): string {
		return toUnicode(this.value);
	}

	public whereUser(): Prisma.UserWhereInput {
		if (this.isSelf()) {
			return { host: null };
		} else {
			return { host: this.toASCII() };
		}
	}
}
