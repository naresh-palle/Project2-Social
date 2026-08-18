import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/network/api_client.dart';
import 'core/router/app_router.dart';
import 'core/storage/offline_cache.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/appearance_prefs.dart';
import 'features/auth/presentation/providers/auth_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await OfflineCache.init();
  runApp(const ProviderScope(child: Cr8App()));
}

class Cr8App extends ConsumerStatefulWidget {
  const Cr8App({super.key});

  @override
  ConsumerState<Cr8App> createState() => _Cr8AppState();
}

class _Cr8AppState extends ConsumerState<Cr8App> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final storage = ref.read(sessionStorageProvider);
    final t = await storage.theme();
    final hc = await storage.highContrast();
    final fs = await storage.fontScale();
    if (!mounted) return;
    ref.read(appearancePrefsProvider.notifier).state = AppearancePrefs(
      theme: t.isEmpty ? 'dark' : t,
      highContrast: hc,
      fontScale: fs,
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final repo = ref.read(authRepositoryProvider);
    if (state == AppLifecycleState.resumed) {
      repo.presence(online: true);
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      repo.presence(online: false);
    }
  }

  ThemeMode _mapTheme(String t) {
    if (t == 'light') return ThemeMode.light;
    if (t == 'system') return ThemeMode.system;
    return ThemeMode.dark;
  }

  @override
  Widget build(BuildContext context) {
    // Keep auth provider alive so bootstrap + presence run.
    ref.watch(authProvider);
    final appearance = ref.watch(appearancePrefsProvider);
    final router = ref.watch(goRouterProvider);
    return MaterialApp.router(
      title: 'flugr',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(highContrast: appearance.highContrast, fontScale: appearance.fontScale),
      darkTheme: AppTheme.dark(highContrast: appearance.highContrast, fontScale: appearance.fontScale),
      themeMode: _mapTheme(appearance.theme),
      routerConfig: router,
    );
  }
}
