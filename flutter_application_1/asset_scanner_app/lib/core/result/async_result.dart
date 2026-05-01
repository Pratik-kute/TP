import 'package:freezed_annotation/freezed_annotation.dart';

import '../errors/app_error.dart';

part 'async_result.freezed.dart';

/// A typed result for screens that load data asynchronously.
///
/// Riverpod's [AsyncValue] does most of this, but [AsyncResult] keeps the
/// "we have stale data and are refreshing" case explicit, which the UX spec
/// uses on Asset Details (refresh shows a top progress strip while keeping
/// the previous content interactive).
@freezed
sealed class AsyncResult<T> with _$AsyncResult<T> {
  const AsyncResult._();

  const factory AsyncResult.idle() = AsyncResultIdle<T>;
  const factory AsyncResult.loading() = AsyncResultLoading<T>;
  const factory AsyncResult.refreshing(T previous) = AsyncResultRefreshing<T>;
  const factory AsyncResult.data(T value) = AsyncResultData<T>;
  const factory AsyncResult.error(AppError error, {T? previous}) =
      AsyncResultError<T>;

  bool get isLoading => this is AsyncResultLoading<T>;
  bool get isRefreshing => this is AsyncResultRefreshing<T>;

  T? get valueOrNull => switch (this) {
        AsyncResultData<T>(:final value) => value,
        AsyncResultRefreshing<T>(:final previous) => previous,
        AsyncResultError<T>(:final previous) => previous,
        _ => null,
      };

  AppError? get errorOrNull => switch (this) {
        AsyncResultError<T>(:final error) => error,
        _ => null,
      };
}
