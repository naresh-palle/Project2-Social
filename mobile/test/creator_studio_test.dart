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

  testWidgets('creator studio matches annotated home layout', (tester) async {
    final user = UserEntity.fromJson({
      'id': 'u1',
      'email': 'creator@cr8.studio',
      'role': 'influencer',
      'name': 'creatordemo',
      'username': 'creatordemo',
      'handle': 'creatordemo',
      'platform_metrics': {
        'instagram': {'handle': '@creator.demo1', 'followers': 12000, 'engagement': 4.2, 'views': 88000},
      },
    });

    await tester.binding.setSurfaceSize(const Size(400, 1800));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CreatorStudioView(
            user: user,
            stats: const {
              'acceptances': 3,
              'invitations': 2,
              'applications': 5,
              'earned': 48250,
            },
            wallet: const {'balance': 48250},
            campaigns: const [
              {'id': 'c1', 'title': 'Summer Drop', 'brand': 'ACME', 'budget': 15000},
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.textContaining('creatordemo'), findsWidgets);
    expect(find.text('Brand offers'), findsOneWidget);
    expect(find.textContaining('THIS MONTH'), findsOneWidget);
    expect(find.text('PITCHES'), findsOneWidget);
    expect(find.text('CAMPAIGNS'), findsOneWidget);
    expect(find.text('Overall analytics'), findsOneWidget);
    expect(find.text('TOTAL FOLLOWERS'), findsOneWidget);
    expect(find.text('ENGAGEMENT'), findsOneWidget);
    expect(find.text('TOTAL VIEWS'), findsOneWidget);
    expect(find.text('View campaigns'), findsOneWidget);
    expect(find.text('Invitations'), findsOneWidget);

    // Removed per annotated feedback
    expect(find.text('Performance'), findsNothing);
    expect(find.text('Recent activity'), findsNothing);
    expect(find.text('Create content'), findsNothing);
    expect(find.text('Withdraw'), findsOneWidget); // still on earnings CTA only
  });
}
