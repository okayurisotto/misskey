import { PrimaryColumn, Entity, JoinColumn, Column, ManyToOne, Index } from 'typeorm';
import { id } from '../id.js';
import { User } from './User.js';

@Entity()
export class UserSecurityKey {
	@PrimaryColumn('varchar', {
		comment: 'Variable-length id given to navigator.credentials.get()',
	})
	public id: string;

	@Index()
	@Column(id())
	public userId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Index()
	@Column('varchar', {
		comment:
			'Variable-length public key used to verify attestations (hex-encoded).',
	})
	public publicKey: string;

	@Column('timestamp with time zone', {
		comment:
			'The date of the last time the UserSecurityKey was successfully validated.',
	})
	public lastUsed: Date;

	@Column('varchar', {
		comment: 'User-defined name for this key',
		length: 30,
	})
	public name: string;
}
