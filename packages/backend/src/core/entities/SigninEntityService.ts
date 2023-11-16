import { Injectable } from '@nestjs/common';
import type { signin } from '@prisma/client';

@Injectable()
export class SigninEntityService {
	constructor() {}

	public pack(src: signin): signin {
		return src;
	}
}
