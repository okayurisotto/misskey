import { Injectable } from '@nestjs/common';
import { MfmService } from '@/core/MfmService.js';
import { isPropertyValue } from '../type.js';
import type { IObject } from '../type.js';

type Field = Record<'name' | 'value', string>;

@Injectable()
export class ApPersonAttachmentsAnalyzeService {
	constructor(private readonly mfmService: MfmService) {}

	// TODO: `attachments`が`IObject`だった場合、返り値が`[]`になるようだが構わないのか？
	public analyze(attachments: IObject | IObject[] | undefined): Field[] {
		const fields: Field[] = [];

		if (Array.isArray(attachments)) {
			for (const attachment of attachments.filter(isPropertyValue)) {
				fields.push({
					name: attachment.name,
					value: this.mfmService.fromHtml(attachment.value),
				});
			}
		}

		return fields;
	}
}
