import 'package:flutter_test/flutter_test.dart';
import 'package:cr8_mobile/core/router/app_router.dart';
import 'package:cr8_mobile/features/auth/domain/entities/user_entity.dart';

void main() {
  test('guests have no post-auth home', () {
    expect(postAuthHome(null), '/');
  });

  test('logged-in users open dashboard by default', () {
    final user = UserEntity.fromJson({
      'id': 'u1',
      'email': 'a@b.c',
      'role': 'influencer',
      'onboarding_status': 'completed',
    });
    expect(postAuthHome(user), '/dashboard');
  });

  test('null/empty onboarding still goes to dashboard (returning users)', () {
    final user = UserEntity.fromJson({
      'id': 'u1',
      'email': 'a@b.c',
      'role': 'owner',
    });
    expect(postAuthHome(user), '/dashboard');
  });

  test('explicit pending onboarding routes to wizard', () {
    final user = UserEntity.fromJson({
      'id': 'u1',
      'email': 'a@b.c',
      'role': 'influencer',
      'onboarding_status': 'pending',
    });
    expect(postAuthHome(user), '/onboarding/influencer');
  });
}
