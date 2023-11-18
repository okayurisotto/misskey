import { Injectable } from '@nestjs/common';
import type { RemoteUser } from '@/models/entities/User.js';
import { DriveFilePublicUrlGenerationService } from '@/core/entities/DriveFilePublicUrlGenerationService.js';
import { ApImageResolveService } from './ApImageResolveService.js';

@Injectable()
export class ApPersonAvatarAndBannerResolveService {
	constructor(
		private readonly apImageResolveService: ApImageResolveService,
		private readonly driveFilePublicUrlGenerationService: DriveFilePublicUrlGenerationService,
	) {}

	public async resolve(
		user: RemoteUser,
		icon: any,
		image: any,
	): Promise<
		Pick<
			RemoteUser,
			| 'avatarId'
			| 'bannerId'
			| 'avatarUrl'
			| 'bannerUrl'
			| 'avatarBlurhash'
			| 'bannerBlurhash'
		>
	> {
		const [avatar, banner] = await Promise.all(
			[icon, image].map((img) => {
				if (img == null) return null;
				if (user == null)
					throw new Error('failed to create user: user is null');
				return this.apImageResolveService.resolve(user, img).catch(() => null);
			}),
		);

		return {
			avatarId: avatar?.id ?? null,
			bannerId: banner?.id ?? null,
			avatarUrl: avatar
				? this.driveFilePublicUrlGenerationService.generate(avatar, 'avatar')
				: null,
			bannerUrl: banner
				? this.driveFilePublicUrlGenerationService.generate(banner)
				: null,
			avatarBlurhash: avatar?.blurhash ?? null,
			bannerBlurhash: banner?.blurhash ?? null,
		};
	}
}
