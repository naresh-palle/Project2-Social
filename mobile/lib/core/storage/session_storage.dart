import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../constants/app_constants.dart';

class SessionStorage {
  SessionStorage({
    FlutterSecureStorage? secure,
    SharedPreferences? prefs,
  })  : _secure = secure ?? const FlutterSecureStorage(),
        _prefs = prefs;

  final FlutterSecureStorage _secure;
  SharedPreferences? _prefs;

  Future<SharedPreferences> get _p async =>
      _prefs ??= await SharedPreferences.getInstance();

  Future<void> saveToken(String token) =>
      _secure.write(key: AppConstants.tokenKey, value: token);

  Future<String?> readToken() => _secure.read(key: AppConstants.tokenKey);

  Future<void> clearToken() => _secure.delete(key: AppConstants.tokenKey);

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
    return p.getBool(AppConstants.rememberMeKey) ?? false;
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
