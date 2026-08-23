import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
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
                    Text('flugr', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontStyle: FontStyle.italic)),
                    Text(user?.displayName ?? '', style: Theme.of(context).textTheme.bodyMedium),
                    Text(user?.role.toUpperCase() ?? '', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Cr8Colors.accent)),
                  ],
                ),
              ),
              ListTile(leading: const Icon(Icons.dynamic_feed_outlined), title: const Text('Feed'), onTap: () { Navigator.pop(context); context.push('/feed'); }),
              ListTile(leading: const Icon(Icons.search), title: const Text('Search'), onTap: () { Navigator.pop(context); context.push('/search'); }),
              ListTile(
                leading: const Icon(Icons.work_outline_rounded),
                title: const Text('Campaigns'),
                onTap: () {
                  Navigator.pop(context);
                  context.go('/marketplace');
                },
              ),
              if (!isCreator)
                ListTile(leading: const Icon(Icons.storefront), title: const Text('Marketplace'), onTap: () { Navigator.pop(context); context.push('/marketplace'); }),
              ListTile(leading: const Icon(Icons.favorite_border), title: const Text('Wishlist'), onTap: () { Navigator.pop(context); context.push('/wishlist'); }),
              ListTile(leading: const Icon(Icons.account_balance_wallet_outlined), title: const Text('Wallet'), onTap: () { Navigator.pop(context); context.push('/wallet'); }),
              ListTile(leading: const Icon(Icons.verified_user_outlined), title: const Text('Social Audit'), onTap: () { Navigator.pop(context); context.push('/social-audit'); }),
              if (isBrand || isProduction || user?.isAdmin == true)
                ListTile(leading: const Icon(Icons.handshake_outlined), title: const Text('Hire Requests'), onTap: () { Navigator.pop(context); context.push('/hire-requests'); }),
              if (!isCreator)
                ListTile(leading: const Icon(Icons.mail_outline), title: const Text('Invitations'), onTap: () { Navigator.pop(context); context.push('/invitations'); }),
              ListTile(leading: const Icon(Icons.support_agent_outlined), title: const Text('Support'), onTap: () { Navigator.pop(context); context.push('/support'); }),
              ListTile(leading: const Icon(Icons.notifications_outlined), title: const Text('Notifications'), onTap: () { Navigator.pop(context); context.push('/notifications'); }),
              ListTile(leading: const Icon(Icons.settings_outlined), title: const Text('Settings'), onTap: () { Navigator.pop(context); context.push('/settings'); }),
              if (user?.isAdmin == true)
                ListTile(leading: const Icon(Icons.admin_panel_settings), title: const Text('Admin'), onTap: () { Navigator.pop(context); context.push('/admin'); }),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.logout, color: Cr8Colors.accent),
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
}
