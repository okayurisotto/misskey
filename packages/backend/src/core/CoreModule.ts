import { Module } from '@nestjs/common';
import { AcctFactory } from '@/factories/AcctFactory.js';
import { HostFactory } from '@/factories/HostFactory.js';
import { HostFilterFactory } from '@/factories/HostFilterFactory.js';
import { AbuseUserReportFetchingService } from './entities/AbuseUserReportFetchingService.js';
import { AccountMovingPostProcessService } from './AccountMovingPostProcessService.js';
import { AccountUpdateService } from './AccountUpdateService.js';
import { AchievementService } from './AchievementService.js';
import { AdEntityService } from './entities/AdEntityService.js';
import { AiService } from './AiService.js';
import { AlsoKnownAsValidationService } from './AlsoKnownAsValidationService.js';
import { AnnouncementEntityService } from './entities/AnnouncementEntityService.js';
import { AntennaEntityService } from './entities/AntennaEntityService.js';
import { AntennaService } from './AntennaService.js';
import { ApActorValidateService } from './activitypub/models/ApActorValidateService.js';
import { ApAudienceParseService } from './activitypub/ApAudienceParseService.js';
import { ApDbResolverService } from './activitypub/ApDbResolverService.js';
import { ApDeliverManagerService } from './activitypub/ApDeliverManagerService.js';
import { ApHostPunycodeService } from './activitypub/models/ApHostPunycodeService.js';
import { ApImageResolveService } from './activitypub/models/ApImageResolveService.js';
import { ApInboxService } from './activitypub/ApInboxService.js';
import { ApLoggerService } from './activitypub/ApLoggerService.js';
import { ApMentionService } from './activitypub/models/ApMentionService.js';
import { ApMfmService } from './activitypub/ApMfmService.js';
import { ApNoteService } from './activitypub/models/ApNoteService.js';
import { AppEntityService } from './entities/AppEntityService.js';
import { ApPersonAttachmentsAnalyzeService } from './activitypub/models/ApPersonAttachmentsAnalyzeService.js';
import { ApPersonAvatarAndBannerResolveService } from './activitypub/models/ApPersonAvatarAndBannerResolveService.js';
import { ApPersonCreateService } from './activitypub/models/ApPersonCreateService.js';
import { ApPersonFeaturedUpdateService } from './activitypub/models/ApPersonFeaturedUpdateService.js';
import { ApPersonFetchService } from './activitypub/models/ApPersonFetchService.js';
import { ApPersonResolveService } from './activitypub/models/ApPersonResolveService.js';
import { ApPersonUpdateService } from './activitypub/models/ApPersonUpdateService.js';
import { AppLockService } from './AppLockService.js';
import { ApQuestionExtractService } from './activitypub/models/ApQuestionService.js';
import { ApRendererService } from './activitypub/ApRendererService.js';
import { ApRequestService } from './activitypub/ApRequestService.js';
import { ApResolverService } from './activitypub/ApResolverService.js';
import { AuthSessionEntityService } from './entities/AuthSessionEntityService.js';
import { BlockingEntityService } from './entities/BlockingEntityService.js';
import { CaptchaService } from './CaptchaService.js';
import { ChannelEntityService } from './entities/ChannelEntityService.js';
import { ChartLoggerService } from './chart/ChartLoggerService.js';
import { ChartManagementService } from './chart/ChartManagementService.js';
import { ClipEntityService } from './entities/ClipEntityService.js';
import { CreateSystemUserService } from './CreateSystemUserService.js';
import { CustomEmojiPopulateService } from './CustomEmojiPopulateService.js';
import { DeleteAccountService } from './DeleteAccountService.js';
import { DownloadService } from './DownloadService.js';
import { DriveFileAddFromUrlService } from './DriveFileAddFromUrlService.js';
import { DriveFileAddService } from './DriveFileAddService.js';
import { DriveFileDeleteService } from './DriveFileDeleteService.js';
import { DriveFileEntityPackService } from './entities/DriveFileEntityPackService.js';
import { DriveFileSaveService } from './DriveFileSaveService.js';
import { DriveFolderEntityService } from './entities/DriveFolderEntityService.js';
import { EmailService } from './EmailService.js';
import { EmojiEntityService } from './entities/EmojiEntityService.js';
import { FederatedInstanceService } from './FederatedInstanceService.js';
import { FetchInstanceMetadataService } from './FetchInstanceMetadataService.js';
import { FileInfoService } from './FileInfoService.js';
import { FlashEntityService } from './entities/FlashEntityService.js';
import { FlashLikeEntityService } from './entities/FlashLikeEntityService.js';
import { FollowingEntityService } from './entities/FollowingEntityService.js';
import { FollowRequestEntityService } from './entities/FollowRequestEntityService.js';
import { GalleryLikeEntityService } from './entities/GalleryLikeEntityService.js';
import { GalleryPostEntityService } from './entities/GalleryPostEntityService.js';
import { GlobalEventService } from './GlobalEventService.js';
import { HashtagEntityService } from './entities/HashtagEntityService.js';
import { HashtagService } from './HashtagService.js';
import { HttpRequestService } from './HttpRequestService.js';
import { IdService } from './IdService.js';
import { ImageProcessingService } from './ImageProcessingService.js';
import { InstanceActorService } from './InstanceActorService.js';
import { InstanceEntityService } from './entities/InstanceEntityService.js';
import { InternalStorageService } from './InternalStorageService.js';
import { InviteCodeEntityService } from './entities/InviteCodeEntityService.js';
import { LdSignatureService } from './activitypub/LdSignatureService.js';
import { LocalAccountMovingService } from './LocalAccountMovingService.js';
import { MetaService } from './MetaService.js';
import { MfmService } from './MfmService.js';
import { ModerationLogEntityService } from './entities/ModerationLogEntityService.js';
import { ModerationLogService } from './ModerationLogService.js';
import { MutingEntityService } from './entities/MutingEntityService.js';
import { NoteCreateService } from './NoteCreateService.js';
import { NoteDeleteService } from './NoteDeleteService.js';
import { NoteEntityPackService } from './entities/NoteEntityPackService.js';
import { NoteFavoriteEntityService } from './entities/NoteFavoriteEntityService.js';
import { NotePiningService } from './NotePiningService.js';
import { NoteReactionEntityService } from './entities/NoteReactionEntityService.js';
import { NoteReadService } from './NoteReadService.js';
import { NotificationEntityService } from './entities/NotificationEntityService.js';
import { NotificationService } from './NotificationService.js';
import { ObjectStorageFileDeleteService } from './ObjectStorageFileDeleteService.js';
import { PageEntityService } from './entities/PageEntityService.js';
import { PageLikeEntityService } from './entities/PageLikeEntityService.js';
import { PollService } from './PollService.js';
import { PrismaQueryService } from './PrismaQueryService.js';
import { PrismaService } from './PrismaService.js';
import { ProxyAccountService } from './ProxyAccountService.js';
import { PushNotificationService } from './PushNotificationService.js';
import { QueueModule } from './QueueModule.js';
import { QueueService } from './QueueService.js';
import { ReactionCreateService } from './ReactionCreateService.js';
import { RelayService } from './RelayService.js';
import { RemoteLoggerService } from './RemoteLoggerService.js';
import { RemoteUserResolveService } from './RemoteUserResolveService.js';
import { RenoteMutingEntityService } from './entities/RenoteMutingEntityService.js';
import { RoleEntityService } from './entities/RoleEntityService.js';
import { RoleService } from './RoleService.js';
import { S3Service } from './S3Service.js';
import { SearchService } from './SearchService.js';
import { SigninEntityService } from './entities/SigninEntityService.js';
import { SignupService } from './SignupService.js';
import { TwoFactorAuthenticationService } from './TwoFactorAuthenticationService.js';
import { UserBlockingCheckService } from './UserBlockingCheckService.js';
import { UserBlockingCopyingService } from './UserBlockingCopyingService.js';
import { UserBlockingCreateService } from './UserBlockingCreateService.js';
import { UserBlockingDeleteService } from './UserBlockingDeleteService.js';
import { UserEntityService } from './entities/UserEntityService.js';
import { UserFollowingCreateProcessService } from './UserFollowingCreateProcessService.js';
import { UserFollowingCreateService } from './UserFollowingCreateService.js';
import { UserFollowingDeleteService } from './UserFollowingDeleteService.js';
import { UserFollowingDeletionPublishService } from './UserFollowingDeletionPublishService.js';
import { UserFollowingRejectionRecieveService } from './UserFollowingRejectionReceiveService.js';
import { UserFollowRequestAcceptAllService } from './UserFollowRequestAcceptAllService.js';
import { UserFollowRequestAcceptService } from './UserFollowRequestAcceptService.js';
import { UserFollowRequestCancelService } from './UserFollowRequestCancelService.js';
import { UserFollowRequestCreateService } from './UserFollowRequestCreateService.js';
import { UserFollowRequestDeleteService } from './UserFollowRequestDeleteService.js';
import { UserFollowRequestRejectService } from './UserFollowRequestRejectService.js';
import { UserKeypairService } from './UserKeypairService.js';
import { UserListEntityService } from './entities/UserListEntityService.js';
import { UserListMovingUserService } from './UserListMovingUserService.js';
import { UserListService } from './UserListService.js';
import { UserMutingCopyingService } from './UserMutingCopyingService.js';
import { UserMutingService } from './UserMutingService.js';
import { UserSuspendService } from './UserSuspendService.js';
import { UtilityService } from './UtilityService.js';
import { VideoProcessingService } from './VideoProcessingService.js';
import { WebfingerService } from './WebfingerService.js';
import { WebhookService } from './WebhookService.js';
import ActiveUsersChart from './chart/charts/active-users.js';
import ApRequestChart from './chart/charts/ap-request.js';
import DriveChart from './chart/charts/drive.js';
import FederationChart from './chart/charts/federation.js';
import InstanceChart from './chart/charts/instance.js';
import NotesChart from './chart/charts/notes.js';
import PerUserDriveChart from './chart/charts/per-user-drive.js';
import PerUserFollowingChart from './chart/charts/per-user-following.js';
import PerUserNotesChart from './chart/charts/per-user-notes.js';
import PerUserPvChart from './chart/charts/per-user-pv.js';
import PerUserReactionsChart from './chart/charts/per-user-reactions.js';
import UsersChart from './chart/charts/users.js';
import { DriveFileNameValidationService } from './entities/DriveFileNameValidationService.js';
import { DriveFileProxiedUrlGenerationService } from './entities/DriveFileProxiedUrlGenerationService.js';
import { DriveFilePublicUrlGenerationService } from './entities/DriveFilePublicUrlGenerationService.js';
import { DriveUsageCalcService } from './entities/DriveUsageCalcService.js';
import { CustomEmojiAddService } from './CustomEmojiAddService.js';
import { CustomEmojiAliasService } from './CustomEmojiAliasService.js';
import { CustomEmojiCategoryService } from './CustomEmojiCategoryService.js';
import { CustomEmojiDeleteService } from './CustomEmojiDeleteService.js';
import { CustomEmojiLicenseService } from './CustomEmojiLicenseService.js';
import { CustomEmojiStringParseService } from './CustomEmojiStringParseService.js';
import { CustomEmojiUpdateService } from './CustomEmojiUpdateService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import { BadgeRoleService } from './BadgeRoleService.js';
import { RoleConditionEvalService } from './RoleConditionEvalService.js';
import { ApImageCreateService } from './activitypub/models/ApImageCreateService.js';
import { ApNoteFetchService } from './activitypub/models/ApNoteFetchService.js';
import { RoleUtilService } from './RoleUtilService.js';
import { ApNoteEmojiExtractService } from './activitypub/models/ApNoteEmojiExtractService.js';
import { ReactionDeleteService } from './ReactionDeleteService.js';
import { ReactionDecodeService } from './ReactionDecodeService.js';
import { LegacyReactionConvertService } from './LegacyReactionConvertService.js';
import { NoteVisibilityService } from './entities/NoteVisibilityService.js';
import { RenoteCountService } from './entities/RenoteCountService.js';
import { ApQuestionUpdateService } from './activitypub/models/ApQuestionUpdateService.js';
import { ApNoteIdResolverService } from './activitypub/ApNoteIdResolverService.js';
import { ApUserIdResolverService } from './activitypub/ApUserIdResolverService.js';
import { ApUriParseService } from './activitypub/ApUriParseService.js';
import { UserEntityPackLiteService } from './entities/UserEntityPackLiteService.js';
import { AbuseUserReportResolutionService } from './entities/AbuseUserReportResolutionService.js';
import { AbuseUserReportCreationNotificationService } from './entities/AbuseUserReportCreationNotificationService.js';
import { AbuseUserReportCreationService } from './entities/AbuseUserReportCreationService.js';
import type { Provider } from '@nestjs/common';

//#region 文字列ベースでのinjection用（循環参照対応のため）
const $ApNoteService: Provider = {
	provide: 'ApNoteService',
	useExisting: ApNoteService,
};
//#endregion

@Module({
	imports: [QueueModule],
	providers: [
		AbuseUserReportCreationService,
		AbuseUserReportCreationNotificationService,
		AbuseUserReportFetchingService,
		AbuseUserReportResolutionService,
		AccountMovingPostProcessService,
		AccountUpdateService,
		AchievementService,
		ActiveUsersChart,
		AdEntityService,
		AiService,
		AlsoKnownAsValidationService,
		AnnouncementEntityService,
		AntennaEntityService,
		AntennaService,
		ApActorValidateService,
		ApAudienceParseService,
		ApDbResolverService,
		ApDeliverManagerService,
		ApHostPunycodeService,
		ApImageCreateService,
		ApImageResolveService,
		ApInboxService,
		ApLoggerService,
		ApMentionService,
		ApMfmService,
		ApNoteEmojiExtractService,
		ApNoteFetchService,
		ApNoteIdResolverService,
		ApNoteService,
		AppEntityService,
		ApPersonAttachmentsAnalyzeService,
		ApPersonAvatarAndBannerResolveService,
		ApPersonCreateService,
		ApPersonFeaturedUpdateService,
		ApPersonFetchService,
		ApPersonResolveService,
		ApPersonUpdateService,
		AppLockService,
		ApQuestionExtractService,
		ApQuestionUpdateService,
		ApRendererService,
		ApRequestChart,
		ApRequestService,
		ApResolverService,
		ApUriParseService,
		ApUserIdResolverService,
		AuthSessionEntityService,
		BadgeRoleService,
		BlockingEntityService,
		CaptchaService,
		ChannelEntityService,
		ChartLoggerService,
		ChartManagementService,
		ClipEntityService,
		CreateSystemUserService,
		CustomEmojiAddService,
		CustomEmojiAliasService,
		CustomEmojiCategoryService,
		CustomEmojiDeleteService,
		CustomEmojiLicenseService,
		CustomEmojiPopulateService,
		CustomEmojiStringParseService,
		CustomEmojiUpdateService,
		DeleteAccountService,
		DownloadService,
		DriveChart,
		DriveFileAddFromUrlService,
		DriveFileAddService,
		DriveFileDeleteService,
		DriveFileEntityPackService,
		DriveFileNameValidationService,
		DriveFileProxiedUrlGenerationService,
		DriveFilePublicUrlGenerationService,
		DriveFileSaveService,
		DriveFolderEntityService,
		DriveUsageCalcService,
		EmailService,
		EmojiEntityService,
		FederatedInstanceService,
		FederationChart,
		FetchInstanceMetadataService,
		FileInfoService,
		FlashEntityService,
		FlashLikeEntityService,
		FollowingEntityService,
		FollowRequestEntityService,
		GalleryLikeEntityService,
		GalleryPostEntityService,
		GlobalEventService,
		HashtagEntityService,
		HashtagService,
		HttpRequestService,
		IdService,
		ImageProcessingService,
		InstanceActorService,
		InstanceChart,
		InstanceEntityService,
		InternalStorageService,
		InviteCodeEntityService,
		LdSignatureService,
		LegacyReactionConvertService,
		LocalAccountMovingService,
		MetaService,
		MfmService,
		ModerationLogEntityService,
		ModerationLogService,
		MutingEntityService,
		NoteCreateService,
		NoteDeleteService,
		NoteEntityPackService,
		NoteFavoriteEntityService,
		NotePiningService,
		NoteReactionEntityService,
		NoteReadService,
		NotesChart,
		NoteVisibilityService,
		NotificationEntityService,
		NotificationService,
		ObjectStorageFileDeleteService,
		PageEntityService,
		PageLikeEntityService,
		PerUserDriveChart,
		PerUserFollowingChart,
		PerUserNotesChart,
		PerUserPvChart,
		PerUserReactionsChart,
		PollService,
		PrismaQueryService,
		PrismaService,
		ProxyAccountService,
		PushNotificationService,
		QueueService,
		ReactionCreateService,
		ReactionDecodeService,
		ReactionDeleteService,
		RelayService,
		RemoteLoggerService,
		RemoteUserResolveService,
		RenoteCountService,
		RenoteMutingEntityService,
		RoleConditionEvalService,
		RoleEntityService,
		RoleService,
		RoleUtilService,
		S3Service,
		SearchService,
		SigninEntityService,
		SignupService,
		TwoFactorAuthenticationService,
		UserBlockingCheckService,
		UserBlockingCopyingService,
		UserBlockingCreateService,
		UserBlockingDeleteService,
		UserEntityPackLiteService,
		UserEntityService,
		UserEntityUtilService,
		UserFollowingCreateProcessService,
		UserFollowingCreateService,
		UserFollowingDeleteService,
		UserFollowingDeletionPublishService,
		UserFollowingRejectionRecieveService,
		UserFollowRequestAcceptAllService,
		UserFollowRequestAcceptService,
		UserFollowRequestCancelService,
		UserFollowRequestCreateService,
		UserFollowRequestDeleteService,
		UserFollowRequestRejectService,
		UserKeypairService,
		UserListEntityService,
		UserListMovingUserService,
		UserListService,
		UserMutingCopyingService,
		UserMutingService,
		UsersChart,
		UserSuspendService,
		UtilityService,
		VideoProcessingService,
		WebfingerService,
		WebhookService,

		AcctFactory,
		HostFactory,
		HostFilterFactory,

		//#region 文字列ベースでのinjection用（循環参照対応のため）
		$ApNoteService,
		//#endregion
	],
	exports: [
		AbuseUserReportCreationService,
		AbuseUserReportCreationNotificationService,
		AbuseUserReportFetchingService,
		AbuseUserReportResolutionService,
		AccountMovingPostProcessService,
		AccountUpdateService,
		AchievementService,
		ActiveUsersChart,
		AdEntityService,
		AiService,
		AlsoKnownAsValidationService,
		AnnouncementEntityService,
		AntennaEntityService,
		AntennaService,
		ApActorValidateService,
		ApAudienceParseService,
		ApDbResolverService,
		ApDeliverManagerService,
		ApHostPunycodeService,
		ApImageCreateService,
		ApImageResolveService,
		ApInboxService,
		ApLoggerService,
		ApMentionService,
		ApMfmService,
		ApNoteEmojiExtractService,
		ApNoteFetchService,
		ApNoteIdResolverService,
		ApNoteService,
		AppEntityService,
		ApPersonAttachmentsAnalyzeService,
		ApPersonAvatarAndBannerResolveService,
		ApPersonCreateService,
		ApPersonFeaturedUpdateService,
		ApPersonFetchService,
		ApPersonResolveService,
		ApPersonUpdateService,
		AppLockService,
		ApQuestionExtractService,
		ApQuestionUpdateService,
		ApRendererService,
		ApRequestChart,
		ApRequestService,
		ApResolverService,
		ApUriParseService,
		ApUserIdResolverService,
		AuthSessionEntityService,
		BadgeRoleService,
		BlockingEntityService,
		CaptchaService,
		ChannelEntityService,
		ChartManagementService,
		ClipEntityService,
		CreateSystemUserService,
		CustomEmojiAddService,
		CustomEmojiAliasService,
		CustomEmojiCategoryService,
		CustomEmojiDeleteService,
		CustomEmojiLicenseService,
		CustomEmojiPopulateService,
		CustomEmojiStringParseService,
		CustomEmojiUpdateService,
		DeleteAccountService,
		DownloadService,
		DriveChart,
		DriveFileAddFromUrlService,
		DriveFileAddService,
		DriveFileDeleteService,
		DriveFileEntityPackService,
		DriveFileNameValidationService,
		DriveFileProxiedUrlGenerationService,
		DriveFilePublicUrlGenerationService,
		DriveFileSaveService,
		DriveFolderEntityService,
		DriveUsageCalcService,
		EmailService,
		EmojiEntityService,
		FederatedInstanceService,
		FederationChart,
		FetchInstanceMetadataService,
		FileInfoService,
		FlashEntityService,
		FlashLikeEntityService,
		FollowingEntityService,
		FollowRequestEntityService,
		GalleryLikeEntityService,
		GalleryPostEntityService,
		GlobalEventService,
		HashtagEntityService,
		HashtagService,
		HttpRequestService,
		IdService,
		ImageProcessingService,
		InstanceActorService,
		InstanceChart,
		InstanceEntityService,
		InternalStorageService,
		InviteCodeEntityService,
		LdSignatureService,
		LegacyReactionConvertService,
		LocalAccountMovingService,
		MetaService,
		MfmService,
		ModerationLogEntityService,
		ModerationLogService,
		MutingEntityService,
		NoteCreateService,
		NoteDeleteService,
		NoteEntityPackService,
		NoteFavoriteEntityService,
		NotePiningService,
		NoteReactionEntityService,
		NoteReadService,
		NotesChart,
		NoteVisibilityService,
		NotificationEntityService,
		NotificationService,
		ObjectStorageFileDeleteService,
		PageEntityService,
		PageLikeEntityService,
		PerUserDriveChart,
		PerUserFollowingChart,
		PerUserNotesChart,
		PerUserPvChart,
		PerUserReactionsChart,
		PollService,
		PrismaQueryService,
		PrismaService,
		ProxyAccountService,
		PushNotificationService,
		QueueModule,
		QueueService,
		ReactionCreateService,
		ReactionDecodeService,
		ReactionDeleteService,
		RelayService,
		RemoteLoggerService,
		RemoteUserResolveService,
		RenoteCountService,
		RenoteMutingEntityService,
		RoleEntityService,
		RoleService,
		RoleUtilService,
		S3Service,
		SearchService,
		SigninEntityService,
		SignupService,
		TwoFactorAuthenticationService,
		UserBlockingCheckService,
		UserBlockingCopyingService,
		UserBlockingCreateService,
		UserBlockingDeleteService,
		UserEntityPackLiteService,
		UserEntityService,
		UserEntityUtilService,
		UserFollowingCreateProcessService,
		UserFollowingCreateService,
		UserFollowingDeleteService,
		UserFollowingDeletionPublishService,
		UserFollowingRejectionRecieveService,
		UserFollowRequestAcceptAllService,
		UserFollowRequestAcceptService,
		UserFollowRequestCancelService,
		UserFollowRequestCreateService,
		UserFollowRequestDeleteService,
		UserFollowRequestRejectService,
		UserKeypairService,
		UserListEntityService,
		UserListMovingUserService,
		UserListService,
		UserMutingCopyingService,
		UserMutingService,
		UsersChart,
		UserSuspendService,
		UtilityService,
		VideoProcessingService,
		WebfingerService,
		WebhookService,

		AcctFactory,
		HostFactory,
		HostFilterFactory,
	],
})
export class CoreModule {}
