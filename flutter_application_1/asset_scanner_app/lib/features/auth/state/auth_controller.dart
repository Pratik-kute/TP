import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_error.dart';
import '../data/auth_repository.dart';
import '../domain/user.dart';

final authControllerProvider =
    AsyncNotifierProvider<AuthController, User?>(AuthController.new);

class AuthController extends AsyncNotifier<User?> {
  late final AuthRepository _repo;

  @override
  Future<User?> build() async {
    _repo = ref.read(authRepositoryProvider);
    return _repo.currentUser();
  }

  Future<void> login({required String email, required String password}) async {
    state = const AsyncLoading<User?>();
    try {
      final user = await _repo.login(email: email, password: password);
      state = AsyncData<User?>(user);
    } on AppError catch (e, st) {
      state = AsyncError<User?>(e, st);
      rethrow;
    } catch (e, st) {
      state = AsyncError<User?>(AppError.unknown(), st);
      rethrow;
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const AsyncData<User?>(null);
  }
}
