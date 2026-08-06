import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../constants/app_constants.dart';

/// Cross-platform session persistence (Android / iOS / Web / desktop).
/// Token lives in secure storage (Keychain / EncryptedSharedPreferences / localStorage).
class SessionStorage {
  SessionStorage({
    FlutterSecureStorage? secure,
    SharedPreferences? prefs,
  })  : _secure = secure ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
              mOptions: MacOsOptions(accessibility: KeychainAccessibility.first_unlock),
              webOptions: WebOptions(
                dbName: 'cr8_secure',
                publicKey: 'cr8_secure_key',
              ),
            ),
        _prefs = prefs;

  final FlutterSecureStorage _secure;
  SharedPreferences? _prefs;

  Future<SharedPreferences> get _p async =>
      _prefs ??= await SharedPreferences.getInstance();

  /// Persist JWT for the next cold start (all platforms).
  Future<void> saveToken(String token) async {
    await _secure.write(key: AppConstants.tokenKey, value: token);
    // Mirror for reliability if secure storage is unavailable on some OEM builds.
    final p = await _p;
    await p.setString('${AppConstants.tokenKey}_mirror', token);
  }

  Future<String?> readToken() async {
    try {
      final t = await _secure.read(key: AppConstants.tokenKey);
      if (t != null && t.isNotEmpty) return t;
    } catch (e) {
      debugPrint('secure token read failed: $e');
    }
    final p = await _p;
    return p.getString('${AppConstants.tokenKey}_mirror');
  }

  Future<void> clearToken() async {
    try {
      await _secure.delete(key: AppConstants.tokenKey);
    } catch (_) {}
    final p = await _p;
    await p.remove('${AppConstants.tokenKey}_mirror');
  }

  Future<void> saveUser(Map<String, dynamic> user) async {
    final p = await _p;
    await p.setString(AppConstants.userKey, jsonEncode(user));
  }

  Future<Map<String, dynamic>?> readUser() async {
    final p = await _p;
    final raw = p.getString(AppConstants.userKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> clearUser() async {
    final p = await _p;
    await p.remove(AppConstants.userKey);
  }

  Future<void> setRememberMe(bool v) async {
    final p = await _p;
    await p.setBool(AppConstants.rememberMeKey, v);
  }

  Future<bool> rememberMe() async {
    final p = await _p;
    return p.getBool(AppConstants.rememberMeKey) ?? true;
  }

  Future<void> saveTheme(String theme) async {
    final p = await _p;
    await p.setString(AppConstants.themeKey, theme);
  }

  Future<String> theme() async {
    final p = await _p;
    return p.getString(AppConstants.themeKey) ?? 'dark';
  }

  Future<void> saveHighContrast(bool v) async {
    final p = await _p;
    await p.setBool(AppConstants.highContrastKey, v);
  }

  Future<bool> highContrast() async {
    final p = await _p;
    return p.getBool(AppConstants.highContrastKey) ?? false;
  }

  Future<void> saveFontScale(double v) async {
    final p = await _p;
    await p.setDouble(AppConstants.fontScaleKey, v);
  }

  Future<double> fontScale() async {
    final p = await _p;
    return p.getDouble(AppConstants.fontScaleKey) ?? 1.0;
  }

  Future<void> clearSession() async {
    await clearToken();
    await clearUser();
  }
}
