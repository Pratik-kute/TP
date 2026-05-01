import 'package:freezed_annotation/freezed_annotation.dart';

part 'asset.freezed.dart';
part 'asset.g.dart';

enum AssetStatus {
  @JsonValue('available')
  available,
  @JsonValue('allocated')
  allocated,
  @JsonValue('in_use')
  inUse,
  @JsonValue('under_maintenance')
  underMaintenance,
  @JsonValue('retired')
  retired,
  @JsonValue('disposed')
  disposed,
  @JsonValue('dead')
  dead,
}

enum PermittedAction {
  @JsonValue('add_photo')
  addPhoto,
  @JsonValue('log_maintenance')
  logMaintenance,
  @JsonValue('raise_repair')
  raiseRepair,
  @JsonValue('update_repair')
  updateRepair,
  @JsonValue('mark_recovery')
  markRecovery,
  @JsonValue('verify_audit')
  verifyAudit,
}

@freezed
class AssetCategory with _$AssetCategory {
  const factory AssetCategory({
    required String id,
    required String name,
  }) = _AssetCategory;

  factory AssetCategory.fromJson(Map<String, dynamic> json) =>
      _$AssetCategoryFromJson(json);
}

@freezed
class AssetLocation with _$AssetLocation {
  const factory AssetLocation({
    required String id,
    required String name,
  }) = _AssetLocation;

  factory AssetLocation.fromJson(Map<String, dynamic> json) =>
      _$AssetLocationFromJson(json);
}

@freezed
class AssetUser with _$AssetUser {
  const factory AssetUser({
    required String id,
    required String fullName,
  }) = _AssetUser;

  factory AssetUser.fromJson(Map<String, dynamic> json) =>
      _$AssetUserFromJson(json);
}

@freezed
class AssetPhoto with _$AssetPhoto {
  const factory AssetPhoto({
    required String id,
    required String url,
    required DateTime uploadedAt,
  }) = _AssetPhoto;

  factory AssetPhoto.fromJson(Map<String, dynamic> json) =>
      _$AssetPhotoFromJson(json);
}

@freezed
class AuditContext with _$AuditContext {
  const factory AuditContext({
    required String cycleId,
    required String cycleName,
    AssetLocation? expectedLocation,
    AssetUser? expectedAssignee,
    String?
        existingVerificationResult, // 'verified_match' | 'verified_with_issues'
  }) = _AuditContext;

  factory AuditContext.fromJson(Map<String, dynamic> json) =>
      _$AuditContextFromJson(json);
}

@freezed
class Asset with _$Asset {
  const factory Asset({
    required String id,
    required String assetCode,
    required String name,
    required AssetCategory category,
    String? serialNumber,
    required AssetStatus status,
    AssetLocation? currentLocation,
    AssetUser? assignedToUser,
    DateTime? lastVerifiedAt,
    @Default(<AssetPhoto>[]) List<AssetPhoto> recentPhotos,
  }) = _Asset;

  factory Asset.fromJson(Map<String, dynamic> json) => _$AssetFromJson(json);
}

/// The full lookup response. Mirrors TRD §6.3.
@freezed
class AssetLookupResult with _$AssetLookupResult {
  const factory AssetLookupResult({
    required Asset asset,
    @Default(<PermittedAction>[]) List<PermittedAction> permittedActions,
    AuditContext? auditContext,
    @Default(0) int openRepairCount,
    @Default(0) int overdueMaintenanceCount,
  }) = _AssetLookupResult;

  factory AssetLookupResult.fromJson(Map<String, dynamic> json) =>
      _$AssetLookupResultFromJson(json);
}

@freezed
class PaginatedAssets with _$PaginatedAssets {
  const factory PaginatedAssets({
    required List<Asset> assets,
    required int totalCount,
    required int currentPage,
    required int totalPages,
  }) = _PaginatedAssets;

  factory PaginatedAssets.fromJson(Map<String, dynamic> json) =>
      _$PaginatedAssetsFromJson(json);
}
