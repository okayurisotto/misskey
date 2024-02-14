import { Injectable } from '@nestjs/common';
import { HostFactory } from '@/factories/HostFactory.js';

const PARSE_EMOJI_STR_REGEXP = /^(\w+)(?:@([\w.-]+))?$/;

@Injectable()
export class CustomEmojiStringParseService {
	constructor(private readonly hostFactory: HostFactory) {}

	private normalizeHost(
		src: string,
		noteUserHost: string | null,
	): string | null {
		if (src === '.') return null;
		const host = this.hostFactory.create(src);
		if (host.isSelf()) return null;
		if (noteUserHost === null) return null;
		return host.toASCII();
	}

	public parse(
		emojiName: string,
		noteUserHost: string | null,
	): null | { name: string; host: string | null } {
		const matchResult = emojiName.match(PARSE_EMOJI_STR_REGEXP);
		if (matchResult === null) return null;

		const namePart = matchResult.at(1);
		if (namePart === undefined) throw new Error();

		const hostPart = matchResult.at(2);
		if (hostPart === undefined) throw new Error();

		return {
			name: namePart,
			host: this.normalizeHost(hostPart, noteUserHost),
		};
	}
}
