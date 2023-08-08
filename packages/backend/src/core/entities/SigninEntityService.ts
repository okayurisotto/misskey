import { Injectable } from '@nestjs/common';
import type { Signin } from '@/models/entities/Signin.js';
import { bindThis } from '@/decorators.js';
import type { T2P } from '@/types.js';
import type { signin } from '@prisma/client';

@Injectable()
export class SigninEntityService {
	constructor() {}

	@bindThis
	public async pack(src: T2P<Signin, signin>) {
		return src;
	}
}
