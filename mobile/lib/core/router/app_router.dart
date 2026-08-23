import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/admin/presentation/pages/admin_page.dart';
import '../../features/auth/presentation/pages/forgot_reset_pages.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/onboarding_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/domain/entities/user_entity.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/campaigns/presentation/pages/campaign_detail_page.dart';
import '../../features/dashboard/presentation/pages/analytics_page.dart';
import '../../features/dashboard/presentation/pages/dashboard_page.dart';
import '../../features/dashboard/presentation/pages/home_shell.dart';
import '../../features/discovery/presentation/pages/extra_pages.dart';
import '../../features/feed/presentation/pages/feed_page.dart';
import '../../features/invitations/presentation/pages/invitations_page.dart';
import '../../features/marketplace/presentation/pages/creator_detail_page.dart';
import '../../features/marketplace/presentation/pages/marketplace_page.dart';
import '../../features/messages/presentation/pages/messages_pages.dart';
import '../../features/notifications/presentation/pages/notifications_page.dart';
import '../../features/profile/presentation/pages/profile_pages.dart';
import '../../features/search/presentation/pages/search_page.dart';
import '../../features/settings/presentation/pages/legal_page.dart';
import '../../features/settings/presentation/pages/settings_page.dart';
import '../../features/wallet/presentation/pages/wallet_page.dart';
import '../widgets/app_widgets.dart';
import '../widgets/studio_backdrop.dart';
import '../widgets/brand_logo.dart';
import '../theme/app_theme.dart';

final _rootKey = GlobalKey<NavigatorState>();
final scaffoldKeyProvider = Provider<GlobalKey<ScaffoldState>>((_) => GlobalKey<ScaffoldState>());

/// Where a signed-in user should land.
/// Only explicit `pending` onboarding redirects to the wizard; otherwise dashboard.
String postAuthHome(UserEntity? user) {
  if (user == null) return '/';
  final status = (user.onboardingStatus ?? '').trim().toLowerCase();
  if (status == 'pending') {
    return '/onboarding/${user.role.isEmpty ? 'influencer' : user.role}';
  }
  return '/dashboard';
}

final goRouterProvider = Provider<GoRouter>((ref) {
  // Do NOT watch auth here — recreating GoRouter resets navigation.
  final refresh = _AuthListenable(ref);
  final scaffoldKey = ref.read(scaffoldKeyProvider);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loc = state.matchedLocation;
      final public = loc == '/' ||
          loc == '/login' ||
          loc.startsWith('/register') ||
          loc == '/forgot-password' ||
          loc.startsWith('/reset-password') ||
          loc.startsWith('/legal') ||
          loc == '/splash';

      // Session restore in progress → branded splash (no homepage flash for logged-in users).
      if (auth.loading) {
        return loc == '/splash' ? null : '/splash';
      }

      // Bootstrap done.
      if (loc == '/splash') {
        return auth.isAuthenticated ? postAuthHome(auth.user) : '/';
      }

      if (!auth.isAuthenticated && !public) return '/';

      // Logged-in users hitting marketing/auth entry points → dashboard (every time).
      if (auth.isAuthenticated &&
          (loc == '/' || loc == '/login' || loc.startsWith('/register'))) {
        return postAuthHome(auth.user);
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const _AuthSplashPage()),
      GoRoute(path: '/', builder: (_, __) => const _LandingPage()),
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordPage()),
      GoRoute(
        path: '/reset-password',
        builder: (_, state) => ResetPasswordPage(token: state.uri.queryParameters['token'] ?? ''),
      ),
      GoRoute(path: '/register', builder: (_, __) => const RegisterSplashPage()),
      GoRoute(
        path: '/register/:role',
        builder: (_, state) => RegisterPage(role: state.pathParameters['role'] ?? 'influencer'),
      ),
      GoRoute(
        path: '/onboarding/:role',
        builder: (_, state) => OnboardingPage(role: state.pathParameters['role'] ?? 'influencer'),
      ),
      GoRoute(path: '/legal/:doc', builder: (_, state) => LegalPage(doc: state.pathParameters['doc'] ?? 'terms')),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return HomeShell(navigationShell: navigationShell, scaffoldKey: scaffoldKey);
        },
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/dashboard', builder: (_, __) => const DashboardPage()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/marketplace', builder: (_, __) => const MarketplacePage()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/analytics', builder: (_, __) => const AnalyticsPage()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/messages', builder: (_, __) => const ConversationsPage()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
          ]),
        ],
      ),
      GoRoute(path: '/feed', builder: (_, __) => const FeedPage()),
      GoRoute(path: '/search', builder: (_, __) => const SearchPage()),
      GoRoute(
        path: '/campaigns/map',
        redirect: (_, __) => '/marketplace',
      ),
      GoRoute(path: '/campaigns/new', builder: (_, __) => const NewCampaignPage()),
      GoRoute(
        path: '/campaigns/:id',
        builder: (_, state) => CampaignDetailPage(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/creators/:id',
        builder: (_, state) => CreatorDetailPage(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/brands/:id',
        builder: (_, state) => BrandDetailPage(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/production/:id',
        builder: (_, state) => ProductionDetailPage(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/messages/:id',
        builder: (_, state) => ChatPage(conversationId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/profile/edit', builder: (_, __) => const ProfileEditPage()),
      GoRoute(
        path: '/u/:userId',
        builder: (_, state) => PublicProfilePage(userId: state.pathParameters['userId']!),
      ),
      GoRoute(path: '/invitations', builder: (_, __) => const InvitationsPage()),
      GoRoute(path: '/wallet', builder: (_, __) => const WalletPage()),
      GoRoute(path: '/wishlist', builder: (_, __) => const WishlistPage()),
      GoRoute(path: '/leaderboard', builder: (_, __) => const LeaderboardPage()),
      GoRoute(path: '/referrals', builder: (_, __) => const ReferralsPage()),
      GoRoute(path: '/social-audit', builder: (_, __) => const SocialAuditPage()),
      GoRoute(path: '/hire-requests', builder: (_, __) => const HireRequestsPage()),
      GoRoute(path: '/support', builder: (_, __) => const SupportPage()),
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsPage()),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
      GoRoute(path: '/admin', builder: (_, __) => const AdminPage()),
    ],
  );
});

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(this.ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
  final Ref ref;
}

class _AuthSplashPage extends StatelessWidget {
  const _AuthSplashPage();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Color(0xFF0A0A0A),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            BrandLogo(variant: BrandLogoVariant.mark, height: 72),
            SizedBox(height: 28),
            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 2, color: Cr8Colors.accent),
            ),
          ],
        ),
      ),
    );
  }
}

class _LandingPage extends ConsumerStatefulWidget {
  const _LandingPage();

  @override
  ConsumerState<_LandingPage> createState() => _LandingPageState();
}

class _LandingPageState extends ConsumerState<_LandingPage> with SingleTickerProviderStateMixin {
  late final AnimationController _intro;

  @override
  void initState() {
    super.initState();
    _intro = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..forward();
  }

  @override
  void dispose() {
    _intro.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: StudioBackdrop(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FadeSlideIn(
                  animation: _intro,
                  begin: const Offset(0, -0.2),
                  interval: const Interval(0.15, 0.55, curve: Curves.easeOutCubic),
                  child: Row(
                    children: [
                      const BrandLogo(variant: BrandLogoVariant.mark, height: 32),
                      const Spacer(),
                      Text(
                        'MOBILE',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: Colors.white38,
                              letterSpacing: 2.2,
                            ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                FadeSlideIn(
                  animation: _intro,
                  interval: const Interval(0.25, 0.75, curve: Curves.easeOutCubic),
                  child: Text(
                    'FLUGR',
                    style: Theme.of(context).textTheme.displayLarge?.copyWith(
                          fontSize: 64,
                          height: 0.95,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 4,
                          color: Cr8Colors.accent,
                        ),
                  ),
                ),
                FadeSlideIn(
                  animation: _intro,
                  interval: const Interval(0.32, 0.8, curve: Curves.easeOutCubic),
                  child: Text(
                    'Creator marketplace',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(letterSpacing: 4, color: Colors.white70),
                  ),
                ),
                const Spacer(),
                FadeSlideIn(
                  animation: _intro,
                  interval: const Interval(0.4, 0.95, curve: Curves.easeOutCubic),
                  child: Text(
                    'Connect brands\nwith influencers.',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontStyle: FontStyle.italic,
                          height: 1.15,
                          color: Cr8Colors.text,
                        ),
                  ),
                ),
                const SizedBox(height: 12),
                FadeSlideIn(
                  animation: _intro,
                  interval: const Interval(0.48, 1, curve: Curves.easeOutCubic),
                  child: const Text(
                    'Marketplace, campaigns, and collaboration — one studio.',
                    style: TextStyle(color: Colors.white70, height: 1.4),
                  ),
                ),
                const SizedBox(height: 28),
                FadeSlideIn(
                  animation: _intro,
                  interval: const Interval(0.55, 1, curve: Curves.easeOutCubic),
                  child: Column(
                    children: [
                      Cr8Button(label: 'Sign In', onPressed: () => context.push('/login')),
                      const SizedBox(height: 12),
                      Cr8Button(label: 'Join Studio', onPressed: () => context.push('/register'), outlined: true),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          TextButton(
                            onPressed: () => context.push('/legal/terms'),
                            child: const Text('Terms', style: TextStyle(fontSize: 12, color: Colors.white54)),
                          ),
                          TextButton(
                            onPressed: () => context.push('/legal/privacy'),
                            child: const Text('Privacy', style: TextStyle(fontSize: 12, color: Colors.white54)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
