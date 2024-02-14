import { Injectable } from '@nestjs/common';
import { HostFactory } from '@/factories/HostFactory.js';

@Injectable()
export class ApHostPunycodeService {
	constructor(private readonly hostFactory: HostFactory) {}

	public punyHost(url: string): string {
		const urlObj = new URL(url);
		const host = `${this.hostFactory.create(urlObj.hostname).toASCII()}${
			urlObj.port.length > 0 ? ':' + urlObj.port : ''
		}`;
		return host;
	}
}
