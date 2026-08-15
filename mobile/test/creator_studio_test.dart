import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:cr8_mobile/features/auth/domain/entities/user_entity.dart';
import 'package:cr8_mobile/features/dashboard/presentation/widgets/creator_studio.dart';

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  test('studio greeting follows time of day', () {
    expect(studioGreeting(DateTime(2026, 1, 1, 8)), 'Good morning');
    expect(studioGreeting(DateTime(2026, 1, 1, 15)), 'Good afternoon');
    expect(studioGreeting(DateTime(2026, 1, 1, 21)), 'Good evening');
  });

  test('compact and INR formatters', () {
    expect(formatCompact(950), '950');
    expect(formatCompact(124500), '125K');
    expect(formatInr(48250), contains('48,250'));
  });

  test('trend series has requested length', () {
    expect(buildTrend(base: 8000, days: 7, seed: 3).length, 7);
    expect(buildTrend(base: 8000, days: 30, seed: 3).length, 30);
  });

  testWidgets('creator studio shows hero, KPIs, and quick actions', (tester) async {
    final user = UserEntity.fromJson({
      'id': 'u1',
      'email': 'creator@cr8.studio',
      'role': 'influencer',
      'name': 'creatordemo',
      'username': 'creatordemo',
      'handle': 'creatordemo',
    });

    await tester.binding.setSurfaceSize(const Size(400, 1600));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CreatorStudioView(
            user: user,
            stats: const {
              'acceptances': 3,
              'invitations': 2,
              'earned': 48250,
              'contracted': 60000,
            },
            wallet: const {'balance': 48250},
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.textContaining('creatordemo'), findsWidgets);
    expect(find.textContaining('THIS MONTH'), findsOneWidget);
    expect(find.text('FOLLOWERS'), findsOneWidget);
    expect(find.text('ENGAGEMENT'), findsOneWidget);
    expect(find.text('ACTIVE CAMPAIGNS'), findsOneWidget);
    expect(find.text('PENDING PAYOUTS'), findsOneWidget);
    expect(find.text('Performance'), findsOneWidget);
    expect(find.text('Recent activity'), findsOneWidget);
    expect(find.text('Create content'), findsOneWidget);
    expect(find.text('View campaigns'), findsOneWidget);
  });
}
