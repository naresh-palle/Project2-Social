import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(
    ref.watch(apiClientProvider),
    ref.watch(sessionStorageProvider),
  );
});

class AuthState {
  const AuthState({
    this.user,
    this.loading = true,
    this.error,
    this.requires2fa = false,
  });
  final UserEntity? user;
  final bool loading;
  final String? error;
  final bool requires2fa;

  bool get isAuthenticated => user != null && user!.id.isNotEmpty;

  AuthState copyWith({
    UserEntity? user,
    bool? loading,
    String? error,
    bool? requires2fa,
    bool clearUser = false,
    bool clearError = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
      requires2fa: requires2fa ?? this.requires2fa,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._repo) : super(const AuthState()) {
    _bootstrap();
  }

  final AuthRepository _repo;
  Timer? _presence;

  Future<void> _bootstrap() async {
    state = state.copyWith(loading: true, clearError: true);
    final user = await _repo.restoreSession();
    state = state.copyWith(user: user, loading: false, clearUser: user == null);
    if (user != null) _startPresence();
  }

  void _startPresence() {
    _presence?.cancel();
    _repo.presence(online: true);
    _presence = Timer.periodic(AppConstants.presenceInterval, (_) {
      _repo.presence(online: true);
    });
  }

  Future<bool> login({
    required String identifier,
    required String password,
    bool rememberMe = false,
    String? totpCode,
  }) async {
    state = state.copyWith(loading: true, clearError: true, requires2fa: false);
    try {
      final r = await _repo.login(
        identifier: identifier,
        password: password,
        rememberMe: rememberMe,
        totpCode: totpCode,
      );
      if (r.requires2fa) {
        state = state.copyWith(loading: false, requires2fa: true);
        return false;
      }
      state = state.copyWith(user: r.user, loading: false, requires2fa: false);
      _startPresence();
      return true;
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
      return false;
    }
  }

  Future<bool> google(String credential) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final user = await _repo.googleLogin(credential);
      state = state.copyWith(user: user, loading: false);
      _startPresence();
      return true;
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
      return false;
    }
  }

  Future<bool> apple(String token, {bool rememberMe = false}) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final user = await _repo.appleLogin(token, rememberMe: rememberMe);
      state = state.copyWith(user: user, loading: false);
      _startPresence();
      return true;
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
      return false;
    }
  }

  Future<bool> otpLogin(String mobile, String code) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final user = await _repo.mobileOtpLogin(mobile: mobile, code: code);
      state = state.copyWith(user: user, loading: false);
      _startPresence();
      return true;
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
      return false;
    }
  }

  Future<bool> register(Map<String, dynamic> payload) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final user = await _repo.mobileRegister(payload);
      state = state.copyWith(user: user, loading: false);
      _startPresence();
      return true;
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
      return false;
    }
  }

  Future<void> refresh() async {
    try {
      final user = await _repo.me();
      state = state.copyWith(user: user);
    } catch (_) {}
  }

  Future<void> updateProfile(Map<String, dynamic> patch) async {
    final user = await _repo.updateMe(patch);
    state = state.copyWith(user: user);
  }

  Future<void> logout() async {
    _presence?.cancel();
    await _repo.logout();
    state = const AuthState(loading: false);
  }

  @override
  void dispose() {
    _presence?.cancel();
    super.dispose();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(authRepositoryProvider));
});
