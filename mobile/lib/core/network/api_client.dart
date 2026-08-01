import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/app_constants.dart';
import '../errors/app_failure.dart';
import '../storage/session_storage.dart';

final sessionStorageProvider = Provider<SessionStorage>((_) => SessionStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(storage: ref.watch(sessionStorageProvider));
});

class ApiClient {
  ApiClient({required SessionStorage storage, Dio? dio})
      : _storage = storage,
        _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: AppConstants.apiBase,
                connectTimeout: const Duration(seconds: 30),
                receiveTimeout: const Duration(seconds: 45),
                headers: {'Content-Type': 'application/json'},
              ),
            ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.readToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (e, handler) {
          handler.next(e);
        },
      ),
    );
  }

  final Dio _dio;
  final SessionStorage _storage;

  Dio get raw => _dio;

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? query,
    Options? options,
  }) =>
      _wrap(() => _dio.get<T>(path, queryParameters: query, options: options));

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? query,
    Options? options,
  }) =>
      _wrap(() => _dio.post<T>(path, data: data, queryParameters: query, options: options));

  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Options? options,
  }) =>
      _wrap(() => _dio.patch<T>(path, data: data, options: options));

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Options? options,
  }) =>
      _wrap(() => _dio.delete<T>(path, data: data, options: options));

  Future<Response> upload(
    String path,
    FormData formData, {
    ProgressCallback? onSendProgress,
  }) =>
      _wrap(
        () => _dio.post(
          path,
          data: formData,
          onSendProgress: onSendProgress,
          options: Options(contentType: 'multipart/form-data'),
        ),
      );

  Future<Response<T>> _wrap<T>(Future<Response<T>> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      final detail = e.response?.data is Map
          ? (e.response!.data as Map)['detail']
          : e.response?.data;
      throw AppFailure(
        detail != null ? formatApiError(detail) : (e.message ?? 'Network error'),
        statusCode: e.response?.statusCode,
      );
    }
  }
}
