import { Injectable } from '@nestjs/common';
import { UtilityService } from '@/core/UtilityService.js';

const PARSE_EMOJI_STR_REGEXP = /^(\w+)(?:@([\w.-]+))?$/;

@Injectable()
export class CustomEmojiStringParseService {
	constructor(private readonly utilityService: UtilityService) {}

	private normalizeHost(
		src: string,
		noteUserHost: string | null,
	): string | null {
		if (src === '.') return null;
		if (this.utilityService.isSelfHost(src)) return null;
		if (noteUserHost === null) return null;
		return this.utilityService.toPuny(noteUserHost);
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
