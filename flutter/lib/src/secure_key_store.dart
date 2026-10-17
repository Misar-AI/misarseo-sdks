import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _kApiKeyStorageKey = 'misarseo_api_key';

/// Persists the MisarSEO API key in the platform keystore (Keychain on
/// iOS/macOS, Keystore-backed storage on Android) instead of in source or
/// shared preferences.
class SecureKeyStore {
  final FlutterSecureStorage _storage;

  const SecureKeyStore({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  /// Persists [apiKey] in the device secure keystore.
  Future<void> saveApiKey(String apiKey) => _storage.write(key: _kApiKeyStorageKey, value: apiKey);

  /// Returns the stored API key, or `null` if none has been saved.
  Future<String?> loadApiKey() => _storage.read(key: _kApiKeyStorageKey);

  /// Deletes the stored API key.
  Future<void> deleteApiKey() => _storage.delete(key: _kApiKeyStorageKey);
}
