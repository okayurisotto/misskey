import { PrimaryColumn, Entity, Column } from 'typeorm';

@Entity()
export class UsedUsername {
	@PrimaryColumn('varchar', {
		length: 128,
	})
	public username: string;

	@Column('timestamp with time zone')
	public createdAt: Date;
}
