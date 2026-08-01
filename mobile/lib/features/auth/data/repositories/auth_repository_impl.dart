import '../../../../core/errors/app_failure.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/storage/session_storage.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._api, this._storage);

  final ApiClient _api;
  final SessionStorage _storage;
  UserEntity? _user;

  @override
  UserEntity? get currentUser => _user;

  Future<void> _persist(String token, Map<String, dynamic> userJson) async {
    await _storage.saveToken(token);
    await _storage.saveUser(userJson);
    _user = UserEntity.fromJson(userJson);
  }

  @override
  Future<UserEntity?> restoreSession() async {
    final token = await _storage.readToken();
    if (token == null) {
      _user = null;
      return null;
    }
    final cached = await _storage.readUser();
    if (cached != null) _user = UserEntity.fromJson(cached);
    try {
      final res = await _api.get('/auth/me');
      final data = Map<String, dynamic>.from(res.data as Map);
      await _storage.saveUser(data);
      _user = UserEntity.fromJson(data);
      return _user;
    } on AppFailure catch (e) {
      if (e.statusCode == 401) {
        await _storage.clearSession();
        _user = null;
        return null;
      }
      return _user;
    }
  }

  @override
  Future<({UserEntity user, bool requires2fa})> login({
    required String identifier,
    required String password,
    bool rememberMe = false,
    String? totpCode,
  }) async {
    final res = await _api.post('/auth/login', data: {
      'identifier': identifier,
      'password': password,
      'remember_me': rememberMe,
      if (totpCode != null && totpCode.isNotEmpty) 'totp_code': totpCode,
    });
    final data = Map<String, dynamic>.from(res.data as Map);
    if (data['requires_2fa'] == true) {
      return (user: _user ?? const UserEntity(id: '', email: '', role: ''), requires2fa: true);
    }
    await _storage.setRememberMe(rememberMe);
    await _persist(data['token'] as String, Map<String, dynamic>.from(data['user'] as Map));
    return (user: _user!, requires2fa: false);
  }

  @override
  Future<UserEntity> googleLogin(String credential) async {
    final res = await _api.post('/auth/google-login', data: {'credential': credential});
    final data = Map<String, dynamic>.from(res.data as Map);
    await _persist(data['token'] as String, Map<String, dynamic>.from(data['user'] as Map));
    return _user!;
  }

  @override
  Future<UserEntity> appleLogin(String identityToken, {bool rememberMe = false}) async {
    final res = await _api.post('/auth/apple-login', data: {
      'identity_token': identityToken,
      'remember_me': rememberMe,
    });
    final data = Map<String, dynamic>.from(res.data as Map);
    await _storage.setRememberMe(rememberMe);
    await _persist(data['token'] as String, Map<String, dynamic>.from(data['user'] as Map));
    return _user!;
  }

  @override
  Future<void> sendMobileOtp(String mobile) async {
    await _api.post('/auth/mobile/send-otp', data: {'mobile': mobile});
  }

  @override
  Future<UserEntity> mobileOtpLogin({required String mobile, required String code}) async {
    final res = await _api.post('/auth/mobile/verify-otp', data: {'mobile': mobile, 'code': code});
    final data = Map<String, dynamic>.from(res.data as Map);
    if (data['token'] == null) {
      throw AppFailure('No account found for this mobile number. Please register first.');
    }
    await _persist(data['token'] as String, Map<String, dynamic>.from(data['user'] as Map));
    return _user!;
  }

  @override
  Future<UserEntity> mobileRegister(Map<String, dynamic> payload) async {
    final res = await _api.post('/auth/mobile-register', data: payload);
    final data = Map<String, dynamic>.from(res.data as Map);
    await _persist(data['token'] as String, Map<String, dynamic>.from(data['user'] as Map));
    return _user!;
  }

  @override
  Future<void> forgotPassword(String email) async {
    await _api.post('/auth/forgot-password', data: {'email': email});
  }

  @override
  Future<void> resetPassword({required String token, required String newPassword}) async {
    await _api.post('/auth/reset-password', data: {'token': token, 'new_password': newPassword});
  }

  @override
  Future<UserEntity> me() async {
    final res = await _api.get('/auth/me');
    final data = Map<String, dynamic>.from(res.data as Map);
    await _storage.saveUser(data);
    _user = UserEntity.fromJson(data);
    return _user!;
  }

  @override
  Future<UserEntity> updateMe(Map<String, dynamic> patch) async {
    final res = await _api.patch('/auth/me', data: patch);
    final data = Map<String, dynamic>.from(res.data as Map);
    await _storage.saveUser(data);
    _user = UserEntity.fromJson(data);
    return _user!;
  }

  @override
  Future<void> changePassword({required String current, required String next}) async {
    await _api.post('/auth/change-password', data: {
      'current_password': current,
      'new_password': next,
    });
  }

  @override
  Future<void> presence({required bool online}) async {
    try {
      await _api.post('/auth/presence', data: {'online': online});
    } catch (_) {}
  }

  @override
  Future<void> logout() async {
    await presence(online: false);
    await _storage.clearSession();
    _user = null;
  }
}
