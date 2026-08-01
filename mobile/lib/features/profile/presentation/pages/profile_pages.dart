import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    if (user == null) return const LoadingScaffold();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(icon: const Icon(Icons.edit), onPressed: () => context.push('/profile/edit')),
          IconButton(icon: const Icon(Icons.settings), onPressed: () => context.push('/settings')),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (user.coverPhoto != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Image.network(user.coverPhoto!, height: 140, width: double.infinity, fit: BoxFit.cover),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              CircleAvatar(radius: 40, backgroundImage: user.avatar != null ? NetworkImage(user.avatar!) : null, child: user.avatar == null ? Text(user.displayName.isNotEmpty ? user.displayName[0] : '?') : null),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Flexible(child: Text(user.displayName, style: Theme.of(context).textTheme.headlineSmall)),
                      if (user.verified) const Padding(padding: EdgeInsets.only(left: 6), child: Icon(Icons.verified, color: Cr8Colors.success, size: 18)),
                    ]),
                    Text(user.displayHandle, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Cr8Colors.accent)),
                    Text(user.role.toUpperCase(), style: Theme.of(context).textTheme.labelSmall),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(user.bio ?? 'No bio yet.'),
          const SizedBox(height: 8),
          Text('${user.city ?? ''} ${user.website ?? ''}'),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: () => context.push('/u/${user.id}'), child: const Text('View as public')),
        ],
      ),
    );
  }
}

class ProfileEditPage extends ConsumerStatefulWidget {
  const ProfileEditPage({super.key});
  @override
  ConsumerState<ProfileEditPage> createState() => _ProfileEditPageState();
}

class _ProfileEditPageState extends ConsumerState<ProfileEditPage> {
  late final TextEditingController name;
  late final TextEditingController bio;
  late final TextEditingController handle;
  late final TextEditingController city;
  late final TextEditingController website;
  late final TextEditingController company;
  bool isPrivate = false;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    final u = ref.read(authProvider).user;
    name = TextEditingController(text: u?.name ?? '');
    bio = TextEditingController(text: u?.bio ?? '');
    handle = TextEditingController(text: u?.handle ?? '');
    city = TextEditingController(text: u?.city ?? '');
    website = TextEditingController(text: u?.website ?? '');
    company = TextEditingController(text: u?.company ?? '');
    isPrivate = u?.isPrivate ?? false;
  }

  @override
  void dispose() {
    name.dispose(); bio.dispose(); handle.dispose(); city.dispose(); website.dispose(); company.dispose();
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null) return;
    setState(() => busy = true);
    try {
      final up = await ref.read(cr8ApiProvider).uploadMedia(file.path, file.name);
      var url = up['url']?.toString() ?? '';
      if (url.startsWith('/')) {
        url = AppConstants.apiBase.replaceAll(RegExp(r'/api$'), '') + url;
      }
      await ref.read(authProvider.notifier).updateProfile({'avatar': url});
      if (mounted) showCr8Snack(context, 'Avatar updated');
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      await ref.read(authProvider.notifier).updateProfile({
        'name': name.text.trim(),
        'bio': bio.text.trim(),
        'handle': handle.text.trim(),
        'city': city.text.trim(),
        'website': website.text.trim(),
        'company': company.text.trim(),
        'is_private': isPrivate,
      });
      if (mounted) {
        showCr8Snack(context, 'Profile saved');
        context.pop();
      }
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Cr8Button(label: 'Upload avatar', onPressed: _pickAvatar, outlined: true, loading: busy),
          TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
          TextField(controller: handle, decoration: const InputDecoration(labelText: 'Handle')),
          TextField(controller: bio, maxLines: 3, decoration: const InputDecoration(labelText: 'Bio')),
          TextField(controller: city, decoration: const InputDecoration(labelText: 'City')),
          TextField(controller: website, decoration: const InputDecoration(labelText: 'Website')),
          TextField(controller: company, decoration: const InputDecoration(labelText: 'Company')),
          SwitchListTile(title: const Text('Private profile'), value: isPrivate, onChanged: (v) => setState(() => isPrivate = v)),
          Cr8Button(label: 'Save', onPressed: _save, loading: busy),
        ],
      ),
    );
  }
}

class PublicProfilePage extends ConsumerStatefulWidget {
  const PublicProfilePage({super.key, required this.userId});
  final String userId;
  @override
  ConsumerState<PublicProfilePage> createState() => _PublicProfilePageState();
}

class _PublicProfilePageState extends ConsumerState<PublicProfilePage> {
  Map<String, dynamic>? profile;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      profile = await ref.read(cr8ApiProvider).publicProfile(widget.userId);
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading || profile == null) return const LoadingScaffold();
    final p = profile!;
    final following = p['is_following'] == true;
    final pending = p['follow_pending'] == true;
    return Scaffold(
      appBar: AppBar(title: Text('${p['name'] ?? 'Profile'}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          CircleAvatar(radius: 40, backgroundImage: p['avatar'] != null ? NetworkImage('${p['avatar']}') : null),
          Text('${p['name']}', style: Theme.of(context).textTheme.headlineSmall),
          Text('${p['handle'] ?? p['username'] ?? ''}'),
          Text('${p['followers_count'] ?? 0} followers · ${p['following_count'] ?? 0} following'),
          if (p['is_private'] == true && !following) const Text('This profile is private.'),
          if (p['bio'] != null) Text('${p['bio']}'),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: ElevatedButton(
                onPressed: () async {
                  final api = ref.read(cr8ApiProvider);
                  if (following || pending) {
                    await api.unfollow(widget.userId);
                  } else {
                    await api.follow(widget.userId);
                  }
                  _load();
                },
                child: Text(following ? 'Unfollow' : pending ? 'Requested' : 'Follow'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton(
                onPressed: () async {
                  final convo = await ref.read(cr8ApiProvider).openDm(widget.userId);
                  if (context.mounted) context.push('/messages/${convo['id']}');
                },
                child: const Text('Message'),
              ),
            ),
          ]),
          TextButton(
            onPressed: () async {
              await ref.read(cr8ApiProvider).report(targetType: 'user', targetId: widget.userId, reason: 'Inappropriate');
              if (mounted) showCr8Snack(context, 'Reported');
            },
            child: const Text('Report'),
          ),
        ],
      ),
    );
  }
}
