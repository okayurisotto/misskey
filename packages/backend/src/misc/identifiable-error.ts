/**
 * ID付きエラー
 */
export class IdentifiableError extends Error {
	public override message: string;
	public id: string;

	constructor(id: string, message?: string) {
		super(message);
		this.message = message ?? '';
		this.id = id;
	}
}
