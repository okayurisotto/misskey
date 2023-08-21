import { isNotNull } from './is-not-null.js';

export class EntityMap<
	K extends keyof E,
	E extends Record<string, unknown>,
> extends Map<E[K], E> {
	constructor(key: K, entities: (E | undefined | null)[]) {
		super(entities.filter(isNotNull).map((entity) => [entity[key], entity]));
	}

	public override get(key: E[K]): E {
		const result = super.get(key);
		if (result === undefined) {
			throw new Error(
				JSON.stringify({
					message:
						'Entity Not Found: There is no entity with the provided key in the EntityMap.',
					providedId: key,
				}),
			);
		}
		return result;
	}
}
