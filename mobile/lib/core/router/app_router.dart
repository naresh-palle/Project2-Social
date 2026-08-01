import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/admin/presentation/pages/admin_page.dart';
import '../../features/auth/presentation/pages/forgot_reset_pages.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/onboarding_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/campaigns/presentation/pages/campaign_detail_page.dart';
import '../../features/dashboard/presentation/pages/dashboard_page.dart';
import '../../features/dashboard/presentation/pages/home_shell.dart';
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

final _rootKey = GlobalKey<NavigatorState>();
final scaffoldKeyProvider = Provider<GlobalKey<ScaffoldState>>((_) => GlobalKey<ScaffoldState>());

final goRouterProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);
  final scaffoldKey = ref.watch(scaffoldKeyProvider);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/dashboard',
    refreshListenable: _AuthListenable(ref),
    redirect: (context, state) {
      final loading = auth.loading;
      final loggedIn = auth.isAuthenticated;
      final loc = state.matchedLocation;
      final public = loc == '/' ||
          loc == '/login' ||
          loc.startsWith('/register') ||
          loc == '/forgot-password' ||
          loc.startsWith('/reset-password') ||
          loc.startsWith('/legal');

      if (loading) return null;
      if (!loggedIn && !public) return '/login';
      if (loggedIn && (loc == '/login' || loc == '/')) {
        final status = auth.user?.onboardingStatus;
        if (status == null || status == 'pending' || status == '') {
          return '/onboarding/${auth.user?.role ?? 'influencer'}';
        }
        return '/dashboard';
      }
      return null;
    },
    routes: [
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
            GoRoute(path: '/feed', builder: (_, __) => const FeedPage()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/search', builder: (_, __) => const SearchPage()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/messages', builder: (_, __) => const ConversationsPage()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
          ]),
        ],
      ),
      GoRoute(path: '/marketplace', builder: (_, __) => const MarketplacePage()),
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

class _LandingPage extends StatelessWidget {
  const _LandingPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('CR8', style: Theme.of(context).textTheme.displayLarge?.copyWith(fontStyle: FontStyle.italic)),
              const Text('Studio'),
              const Spacer(),
              Text('Connect brands with creators.', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 24),
              Cr8Button(label: 'Sign In', onPressed: () => context.go('/login')),
              const SizedBox(height: 12),
              Cr8Button(label: 'Join Studio', onPressed: () => context.go('/register'), outlined: true),
            ],
          ),
        ),
      ),
    );
  }
}
