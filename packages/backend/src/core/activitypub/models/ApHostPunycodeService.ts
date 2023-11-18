import { Injectable } from '@nestjs/common';
import { UtilityService } from '@/core/UtilityService.js';

@Injectable()
export class ApHostPunycodeService {
	constructor(private readonly utilityService: UtilityService) {}

	public punyHost(url: string): string {
		const urlObj = new URL(url);
		const host = `${this.utilityService.toPuny(urlObj.hostname)}${
			urlObj.port.length > 0 ? ':' + urlObj.port : ''
		}`;
		return host;
	}
}
