import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class CreatorDetailPage extends ConsumerStatefulWidget {
  const CreatorDetailPage({super.key, required this.id});
  final String id;
  @override
  ConsumerState<CreatorDetailPage> createState() => _CreatorDetailPageState();
}

class _CreatorDetailPageState extends ConsumerState<CreatorDetailPage> {
  Map<String, dynamic>? creator;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      creator = await ref.read(cr8ApiProvider).creator(widget.id);
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    if (loading || creator == null) return const LoadingScaffold();
    final c = creator!;
    return Scaffold(
      appBar: AppBar(title: Text('${c['name']}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (c['avatar'] != null) Center(child: CircleAvatar(radius: 48, backgroundImage: NetworkImage('${c['avatar']}'))),
          const SizedBox(height: 12),
          Text('${c['name']}', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
          Text('${c['handle'] ?? ''}', textAlign: TextAlign.center, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Cr8Colors.accent)),
          if (c['verified'] == true) const Center(child: Icon(Icons.verified, color: Cr8Colors.success)),
          const SizedBox(height: 12),
          Text('${c['bio'] ?? ''}'),
          Text('City: ${c['city'] ?? '—'} · Followers metric: ${c['followers'] ?? '—'}'),
          const SizedBox(height: 16),
          if (user?.isCreator != true)
            Cr8Button(
              label: 'Message',
              onPressed: () async {
                final convo = await ref.read(cr8ApiProvider).openDm(widget.id);
                if (context.mounted) context.push('/messages/${convo['id']}');
              },
            ),
          OutlinedButton(
            onPressed: () => context.push('/u/${widget.id}'),
            child: const Text('Open public profile'),
          ),
        ],
      ),
    );
  }
}
