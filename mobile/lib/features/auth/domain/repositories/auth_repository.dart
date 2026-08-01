import '../entities/user_entity.dart';

abstract class AuthRepository {
  Future<UserEntity?> restoreSession();
  Future<({UserEntity user, bool requires2fa})> login({
    required String identifier,
    required String password,
    bool rememberMe = false,
    String? totpCode,
  });
  Future<UserEntity> googleLogin(String credential);
  Future<UserEntity> appleLogin(String identityToken, {bool rememberMe = false});
  Future<UserEntity> mobileOtpLogin({required String mobile, required String code});
  Future<void> sendMobileOtp(String mobile);
  Future<UserEntity> mobileRegister(Map<String, dynamic> payload);
  Future<void> forgotPassword(String email);
  Future<void> resetPassword({required String token, required String newPassword});
  Future<UserEntity> me();
  Future<UserEntity> updateMe(Map<String, dynamic> patch);
  Future<void> changePassword({required String current, required String next});
  Future<void> presence({required bool online});
  Future<void> logout();
  UserEntity? get currentUser;
}
