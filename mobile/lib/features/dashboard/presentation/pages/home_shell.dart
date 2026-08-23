import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/brand_logo.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.navigationShell, this.scaffoldKey});
  final StatefulNavigationShell navigationShell;
  final GlobalKey<ScaffoldState>? scaffoldKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final isCreator = user?.isInfluencer == true;
    final isBrand = user?.isOwner == true || user?.role == 'agent';
    final isProduction = user?.role == 'production';
    final isAdmin = user?.isAdmin == true;

    return Scaffold(
      key: scaffoldKey,
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: navigationShell.goBranch,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.work_outline_rounded), selectedIcon: Icon(Icons.work_rounded), label: 'Campaigns'),
          NavigationDestination(icon: Icon(Icons.insights_outlined), selectedIcon: Icon(Icons.insights_rounded), label: 'Analytics'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble), label: 'Messages'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
      drawer: Drawer(
        backgroundColor: Cr8Colors.surface,
        child: SafeArea(
          child: ListView(
            children: [
              DrawerHeader(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const BrandLogo(variant: BrandLogoVariant.mark, height: 40),
                    const SizedBox(height: 10),
                    Text(user?.displayName ?? '', style: Theme.of(context).textTheme.bodyMedium),
                    Text(user?.role.toUpperCase() ?? '', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Cr8Colors.accent)),
                  ],
                ),
              ),
              if (isCreator) ...[
                _item(context, Icons.dynamic_feed_outlined, 'Feed', '/feed'),
                _item(context, Icons.storefront_outlined, 'Brands', '/marketplace?tab=brands'),
                _item(context, Icons.work_outline_rounded, 'Campaigns', '/marketplace?tab=campaigns'),
                _item(context, Icons.handshake_outlined, 'Hire / Production', '/marketplace?tab=hire'),
              ] else if (isBrand) ...[
                _item(context, Icons.groups_outlined, 'Influencers', '/marketplace?tab=creators'),
                _item(context, Icons.handshake_outlined, 'Hire / Production', '/marketplace?tab=hire'),
                _item(context, Icons.mail_outline, 'Invitations', '/invitations'),
                _item(context, Icons.assignment_outlined, 'Hire Requests', '/hire-requests'),
              ] else if (isProduction) ...[
                _item(context, Icons.assignment_outlined, 'Hire Requests', '/hire-requests'),
                _item(context, Icons.work_outline_rounded, 'Campaigns', '/marketplace'),
              ] else ...[
                _item(context, Icons.dynamic_feed_outlined, 'Feed', '/feed'),
                _item(context, Icons.work_outline_rounded, 'Campaigns', '/marketplace'),
              ],
              _item(context, Icons.search_rounded, 'Search', '/search'),
              _item(context, Icons.favorite_border, 'Wishlist', '/wishlist'),
              _item(context, Icons.account_balance_wallet_outlined, 'Wallet', '/wallet'),
              _item(context, Icons.receipt_long_outlined, 'Billing', '/billing'),
              _item(context, Icons.verified_user_outlined, 'Social Audit', '/social-audit'),
              _item(context, Icons.support_agent_outlined, 'Support', '/support'),
              _item(context, Icons.notifications_outlined, 'Notifications', '/notifications'),
              _item(context, Icons.settings_outlined, 'Settings', '/settings'),
              if (isAdmin)
                _item(context, Icons.admin_panel_settings_outlined, 'Admin', '/admin'),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.logout_rounded, color: Cr8Colors.accent),
                title: const Text('Sign Out'),
                onTap: () async {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) context.go('/');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Widget _item(BuildContext context, IconData icon, String title, String path) {
    return ListTile(
      leading: Icon(icon, color: Colors.white70),
      title: Text(title),
      onTap: () {
        Navigator.pop(context);
        if (path.startsWith('/marketplace')) {
          context.go(path);
        } else {
          context.push(path);
        }
      },
    );
  }
}
