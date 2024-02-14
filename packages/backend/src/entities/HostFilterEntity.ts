import { HostEntity } from './HostEntity.js';

export class HostFilterEntity {
	private readonly value;

	constructor(value: string) {
		this.value = value;
	}

	public test(host: HostEntity): boolean {
		return `.${this.value}`.endsWith(`.${host.value}`);
	}
}
