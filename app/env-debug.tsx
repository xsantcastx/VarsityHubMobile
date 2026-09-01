import { Redirect } from 'expo-router';
import { getEnvValue } from '@/config/env';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getApiBaseUrl } from '../apiclient/http';

export default function EnvDebugScreen() {
  const envVars = {
    EXPO_PUBLIC_API_URL: getEnvValue('EXPO_PUBLIC_API_URL'),
    EXPO_PUBLIC_USE_LOCAL_API: getEnvValue('EXPO_PUBLIC_USE_LOCAL_API'),
    EXPO_PUBLIC_FORCE_REMOTE_API: getEnvValue('EXPO_PUBLIC_FORCE_REMOTE_API'),
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: getEnvValue('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: getEnvValue('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'),
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: getEnvValue('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
    EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID: getEnvValue('EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID'),
  };

  const apiBaseUrl = getApiBaseUrl();

  if (!__DEV__) return <Redirect href="/(tabs)" />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Environment Variables Debug</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Base URL (computed):</Text>
        <Text style={styles.value}>{apiBaseUrl}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Environment Variables:</Text>
        {Object.entries(envVars).map(([key, value]) => (
          <View key={key} style={styles.envVar}>
            <Text style={styles.key}>{key}:</Text>
            <Text style={styles.value}>{value || 'undefined'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Process Info:</Text>
        <Text style={styles.value}>typeof process: {typeof process}</Text>
        <Text style={styles.value}>
          process.env exists: {!!(typeof process !== 'undefined' && process.env)}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  envVar: {
    marginBottom: 8,
  },
  key: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontFamily: 'monospace',
    marginTop: 2,
  },
});
