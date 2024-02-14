import { URL } from 'node:url';
import { toASCII } from 'punycode';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilityService {
	public extractDbHost(uri: string): string {
		const url = new URL(uri);
		return toASCII(url.hostname);
	}
}
