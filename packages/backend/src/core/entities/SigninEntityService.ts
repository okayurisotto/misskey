import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import type { signin } from '@prisma/client';

@Injectable()
export class SigninEntityService {
	constructor() {}

	@bindThis
	public async pack(src: signin) {
		return src;
	}
}
