import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import {
	destinationAccountForbids,
	rootForbidden,
	noSuchUser___________,
	uriNull,
	localUriNull,
	alreadyMoved,
} from '@/server/api/errors.js';

import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ApiError } from '@/server/api/error.js';

import { ApiLoggerService } from '@/server/api/ApiLoggerService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { LocalAccountMovingService } from '@/core/LocalAccountMovingService.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';

import { AcctFactory } from '@/factories/AcctFactory.js';
import { ApPersonResolveService } from '@/core/activitypub/models/ApPersonResolveService.js';
import { ApPersonUpdateService } from '@/core/activitypub/models/ApPersonUpdateService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';

const res = z.record(z.string(), z.unknown());
export const meta = {
	tags: ['users'],
	secure: true,
	requireCredential: true,
	prohibitMoved: true,
	limit: {
		duration: ms('1day'),
		max: 5,
	},
	res,
	errors: {
		destinationAccountForbids: destinationAccountForbids,
		rootForbidden: rootForbidden,
		noSuchUser: noSuchUser___________,
		uriNull: uriNull,
		localUriNull: localUriNull,
		alreadyMoved: alreadyMoved,
	},
} as const;

export const paramDef = z.object({
	moveToAccount: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly remoteUserResolveService: RemoteUserResolveService,
		private readonly apiLoggerService: ApiLoggerService,
		private readonly getterService: GetterService,
		private readonly localAccountMovingService: LocalAccountMovingService,
		private readonly apPersonResolveService: ApPersonResolveService,
		private readonly apPersonUpdateService: ApPersonUpdateService,
		private readonly userEntityUtilService: UserEntityUtilService,
		private readonly acctFactory: AcctFactory,
	) {
		super(meta, paramDef, async (ps, me) => {
			// check parameter
			if (!ps.moveToAccount) throw new ApiError(meta.errors.noSuchUser);
			// abort if user is the root
			if (me.isRoot) throw new ApiError(meta.errors.rootForbidden);
			// abort if user has already moved
			if (me.movedToUri) throw new ApiError(meta.errors.alreadyMoved);

			// parse user's input into the destination account
			const acct = this.acctFactory.parse(ps.moveToAccount);
			// retrieve the destination account
			let moveTo = await this.remoteUserResolveService
				.resolveUser(acct.username, acct.host.toASCII())
				.catch((e) => {
					this.apiLoggerService.logger.warn(
						`failed to resolve remote user: ${e}`,
					);
					throw new ApiError(meta.errors.noSuchUser);
				});
			const destination = await this.getterService.getUser(moveTo.id);
			const newUri = this.userEntityUtilService.getUserUri(destination);

			// update local db
			await this.apPersonUpdateService.update(newUri);
			// retrieve updated user
			moveTo = await this.apPersonResolveService.resolve(newUri);

			// make sure that the user has indicated the old account as an alias
			const fromUrl = this.userEntityUtilService.genLocalUserUri(me.id);
			let allowed = false;
			if (moveTo.alsoKnownAs) {
				for (const knownAs of moveTo.alsoKnownAs.split(',')) {
					if (knownAs.includes(fromUrl)) {
						allowed = true;
						break;
					}
				}
			}

			// abort if unintended
			if (!allowed || moveTo.movedToUri) {
				throw new ApiError(meta.errors.destinationAccountForbids);
			}

			return await this.localAccountMovingService.move(me, moveTo);
		});
	}
}
