import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/material.dart';

import 'package:cr8_mobile/core/errors/app_failure.dart';
import 'package:cr8_mobile/features/auth/domain/entities/user_entity.dart';
import 'package:cr8_mobile/core/widgets/app_widgets.dart';

void main() {
  test('formatApiError flattens FastAPI detail payloads', () {
    expect(formatApiError('Nope'), 'Nope');
    expect(
      formatApiError([
        {'msg': 'email required'},
        {'msg': 'password short'},
      ]),
      'email required\npassword short',
    );
  });

  test('UserEntity maps role helpers', () {
    final creator = UserEntity.fromJson({
      'id': '1',
      'email': 'a@b.c',
      'role': 'influencer',
      'name': 'Ada',
      'handle': 'ada',
    });
    expect(creator.isInfluencer, isTrue);
    expect(creator.displayHandle, '@ada');
    expect(creator.displayName, 'Ada');
  });

  testWidgets('Cr8Button renders label', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: Cr8Button(label: 'Sign In', onPressed: null),
          ),
        ),
      ),
    );
    expect(find.text('SIGN IN'), findsOneWidget);
  });
}
