import 'package:flutter_riverpod/flutter_riverpod.dart';

class AppearancePrefs {
  const AppearancePrefs({
    this.theme = 'dark',
    this.highContrast = false,
    this.fontScale = 1,
  });

  final String theme;
  final bool highContrast;
  final double fontScale;

  AppearancePrefs copyWith({String? theme, bool? highContrast, double? fontScale}) {
    return AppearancePrefs(
      theme: theme ?? this.theme,
      highContrast: highContrast ?? this.highContrast,
      fontScale: fontScale ?? this.fontScale,
    );
  }
}

final appearancePrefsProvider = StateProvider<AppearancePrefs>((ref) => const AppearancePrefs());
