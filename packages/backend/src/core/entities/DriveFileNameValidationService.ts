import { Injectable } from '@nestjs/common';

@Injectable()
export class DriveFileNameValidationService {
	/**
	 * `name`として渡された文字列がファイル名として妥当かどうか判定する。
	 *
	 * @param name ファイル名
	 * @returns
	 */
	public validate(name: string): boolean {
		if (name.trim().length === 0) return false;
		if (name.length > 200) return false;
		if (name.includes('\\')) return false;
		if (name.includes('/')) return false;
		if (name.includes('..')) return false;

		return true;
	}
}
