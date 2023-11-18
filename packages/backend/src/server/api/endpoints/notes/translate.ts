import { URLSearchParams } from 'node:url';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchNote__________________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { NoteVisibilityService } from '@/core/entities/NoteVisibilityService.js';
import { ApiError } from '../../error.js';

const res = z.union([
	z.number(),
	z.object({
		sourceLang: z.string(),
		text: z.string(),
	}),
]);
export const meta = {
	tags: ['notes'],
	requireCredential: false,
	res,
	errors: { noSuchNote: noSuchNote__________________ },
} as const;

export const paramDef = z.object({
	noteId: MisskeyIdSchema,
	targetLang: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly getterService: GetterService,
		private readonly metaService: MetaService,
		private readonly httpRequestService: HttpRequestService,
		private readonly noteVisibilityService: NoteVisibilityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			if (
				!(await this.noteVisibilityService.isVisibleForMe(
					note,
					me ? me.id : null,
				))
			) {
				return 204; // TODO: 良い感じのエラー返す
			}

			if (note.text == null) {
				return 204;
			}

			const instance = await this.metaService.fetch();

			if (instance.deeplAuthKey == null) {
				return 204; // TODO: 良い感じのエラー返す
			}

			let targetLang = ps.targetLang;
			if (targetLang.includes('-')) targetLang = targetLang.split('-')[0];

			const params = new URLSearchParams();
			params.append('auth_key', instance.deeplAuthKey);
			params.append('text', note.text);
			params.append('target_lang', targetLang);

			const endpoint = instance.deeplIsPro
				? 'https://api.deepl.com/v2/translate'
				: 'https://api-free.deepl.com/v2/translate';

			const res_ = await this.httpRequestService.send(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json, */*',
				},
				body: params.toString(),
			});

			const json = (await res_.json()) as {
				translations: {
					detected_source_language: string;
					text: string;
				}[];
			};

			return {
				sourceLang: json.translations[0].detected_source_language,
				text: json.translations[0].text,
			};
		});
	}
}
