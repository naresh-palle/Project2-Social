import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class WalletPage extends ConsumerStatefulWidget {
  const WalletPage({super.key});
  @override
  ConsumerState<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends ConsumerState<WalletPage> {
  Map<String, dynamic>? wallet;
  final amount = TextEditingController();
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    amount.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      wallet = await ref.read(cr8ApiProvider).wallet();
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = ref.watch(authProvider).user?.isOwner == true;
    final txs = (wallet?['transactions'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Wallet')),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text('₹${wallet?['balance'] ?? 0}', style: Theme.of(context).textTheme.displaySmall?.copyWith(color: Cr8Colors.accent)),
                const Text('Available balance'),
                const SizedBox(height: 16),
                TextField(controller: amount, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount')),
                const SizedBox(height: 8),
                Cr8Button(
                  label: isOwner ? 'Deposit' : 'Withdraw',
                  onPressed: () async {
                    final v = int.tryParse(amount.text) ?? 0;
                    try {
                      if (isOwner) {
                        await ref.read(cr8ApiProvider).deposit(v);
                      } else {
                        await ref.read(cr8ApiProvider).withdraw(v);
                      }
                      amount.clear();
                      _load();
                    } catch (e) {
                      if (mounted) showCr8Snack(context, e.toString(), error: true);
                    }
                  },
                ),
                const SizedBox(height: 16),
                const Cr8SectionLabel('Transactions'),
                ...txs.map((t) => ListTile(
                      title: Text('${t['kind'] ?? t['note'] ?? 'tx'}'),
                      trailing: Text('₹${t['amount']}'),
                      subtitle: Text('${t['created_at'] ?? ''}'),
                    )),
              ],
            ),
    );
  }
}
