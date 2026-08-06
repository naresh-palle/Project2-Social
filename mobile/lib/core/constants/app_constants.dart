/// Shared API / storage / theme constants (parity with web `cr8_*` keys).
class AppConstants {
  AppConstants._();

  static const String appName = 'CR8 Studio';
  static const String defaultApiBase =
      'https://project2-social.onrender.com/api';

  /// Override: `flutter run --dart-define=API_BASE=https://.../api`
  static String get apiBase {
    const fromEnv = String.fromEnvironment('API_BASE');
    if (fromEnv.isNotEmpty) return fromEnv;
    return defaultApiBase;
  }

  static const String tokenKey = 'cr8_token';
  static const String userKey = 'cr8_user';
  static const String rememberMeKey = 'cr8_remember_me';
  static const String themeKey = 'cr8_theme';
  static const String highContrastKey = 'cr8_high_contrast';
  static const String fontScaleKey = 'cr8_font_scale';

  static const String googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue:
        '858111971322-uf792cb63b4u97u1fu494kngaajuaibr.apps.googleusercontent.com',
  );

  static const Duration idleTimeout = Duration(minutes: 30);
  static const Duration presenceInterval = Duration(seconds: 60);
  static const Duration messagePollInterval = Duration(seconds: 4);
}
