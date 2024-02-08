import { Injectable } from '@nestjs/common';
import type { RemoteUser } from '@/models/entities/User.js';
import { ApImageCreateService } from './ApImageCreateService.js';
import type { IObject } from '../type.js';
import type { DriveFile } from '@prisma/client';

@Injectable()
export class ApImageResolveService {
	constructor(private readonly apImageCreateService: ApImageCreateService) {}

	/**
	 * Imageを解決します。
	 *
	 * Misskeyに対象のImageが登録されていればそれを返し、そうでなければ
	 * リモートサーバーからフェッチしてMisskeyに登録しそれを返します。
	 */
	public async resolve(
		actor: RemoteUser,
		value: string | IObject,
	): Promise<DriveFile> {
		// TODO

		// リモートサーバーからフェッチしてきて登録
		return await this.apImageCreateService.create(actor, value);
	}
}
