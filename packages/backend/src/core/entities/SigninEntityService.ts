import { Injectable } from '@nestjs/common';
import type { Signin } from '@prisma/client';

@Injectable()
export class SigninEntityService {
	public pack(src: Signin): Signin {
		return src;
	}
}
