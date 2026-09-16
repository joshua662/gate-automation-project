import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class ApiConstants {
  ApiConstants._(); // prevent instantiation

  static String get domain {
    final raw = dotenv.maybeGet('API_URL');
    if (raw != null && raw.isNotEmpty && !raw.contains('youripadress')) {
      return raw;
    }
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8000';
    }
    return 'http://127.0.0.1:8000';
  }
  static String get baseUrl => '$domain/api';
  static String get storageUrl => '$domain/storage';

  // Authenticaton
  static const String login = '/auth/login';
  static const String residentLogin = '/auth/resident/login';
  static const String logout = '/auth/logout';
  static const String user = '/auth/me';
  static const String updateProfile = '/auth/profile';
  static const String residentRegister = '/auth/resident/register';
  static const String securityGuardRegister = '/auth/security-guard/register';
  static const String forgotPassword = '/auth/forgot-password';

  // Resident Endpoints
  static const String gateStatus = '/gate/status';
  static const String myGateLogs = '/gate-log/my-logs';
  static const String notifications = '/notification';
  static const String markAllNotificationsRead = '/notification/read-all';
  static const String myUpdateRequests = '/update-request/my-requests';
  static const String submitUpdateRequest = '/update-request/submit';

  // User Endpoints
  static const String users = '/users';
  static String userShow(String slug) => '/users/$slug';
  static String userUpdate(int id) => '/users/$id';
  static String userDelete(int id) => '/users/$id';
  static String userRestore(int id) => '/users/$id/restore';

  // timeouts
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
