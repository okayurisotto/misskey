import { Injectable } from '@nestjs/common';
import { truncate } from '@/misc/truncate.js';
import { AP_NAME_MAX_LENGTH, AP_SUMMARY_MAX_LENGTH } from '@/const.js';
import { isActor } from '../type.js';
import { ApHostPunycodeService } from './ApHostPunycodeService.js';
import type { IActor, IObject } from '../type.js';

@Injectable()
export class ApActorValidateService {
	constructor(private readonly apHostPunycodeService: ApHostPunycodeService) {}

	/**
	 * Validate and convert to actor object
	 * @param x Fetched object
	 * @param uri Fetch target URI
	 */
	public validate(x: IObject, uri: string): IActor {
		const expectHost = this.apHostPunycodeService.punyHost(uri);

		if (!isActor(x)) {
			throw new Error(`invalid Actor type '${x.type}'`);
		}

		if (!(typeof x.id === 'string' && x.id.length > 0)) {
			throw new Error('invalid Actor: wrong id');
		}

		if (!(typeof x.inbox === 'string' && x.inbox.length > 0)) {
			throw new Error('invalid Actor: wrong inbox');
		}

		if (
			!(
				typeof x.preferredUsername === 'string' &&
				x.preferredUsername.length > 0 &&
				x.preferredUsername.length <= 128 &&
				/^\w([\w-.]*\w)?$/.test(x.preferredUsername)
			)
		) {
			throw new Error('invalid Actor: wrong username');
		}

		// These fields are only informational, and some AP software allows these
		// fields to be very long. If they are too long, we cut them off. This way
		// we can at least see these users and their activities.
		if (x.name) {
			if (!(typeof x.name === 'string' && x.name.length > 0)) {
				throw new Error('invalid Actor: wrong name');
			}
			x.name = truncate(x.name, AP_NAME_MAX_LENGTH);
		} else if (x.name === '') {
			// Mastodon emits empty string when the name is not set.
			x.name = undefined;
		}
		if (x.summary) {
			if (!(typeof x.summary === 'string' && x.summary.length > 0)) {
				throw new Error('invalid Actor: wrong summary');
			}
			x.summary = truncate(x.summary, AP_SUMMARY_MAX_LENGTH);
		}

		const idHost = this.apHostPunycodeService.punyHost(x.id);
		if (idHost !== expectHost) {
			throw new Error('invalid Actor: id has different host');
		}

		if (x.publicKey) {
			if (typeof x.publicKey.id !== 'string') {
				throw new Error('invalid Actor: publicKey.id is not a string');
			}

			const publicKeyIdHost = this.apHostPunycodeService.punyHost(
				x.publicKey.id,
			);
			if (publicKeyIdHost !== expectHost) {
				throw new Error('invalid Actor: publicKey.id has different host');
			}
		}

		return x;
	}
}
