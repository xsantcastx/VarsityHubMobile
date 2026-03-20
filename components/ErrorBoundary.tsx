import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { Component, ErrorInfo, ReactNode, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { captureException } from '@/utils/sentry';
import { Colors } from '@/constants/Colors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch React errors and display fallback UI
 * Prevents app crashes and provides recovery options
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Always send to Sentry (utility function handles dev/prod filtering)
    captureException(error, {
      tags: { component: 'ErrorBoundary' },
      extra: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI - wrapped in functional component for dark mode
      return <ErrorBoundaryFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

// Functional component wrapper for dark mode support
function ErrorBoundaryFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const [recovering, setRecovering] = useState(false);

  const handleSignOutAndRestart = async () => {
    setRecovering(true);
    try {
      // Full storage clear prevents repeat crashes from stale persisted state.
      await AsyncStorage.clear();
      await Updates.reloadAsync();
    } catch {
      // Fallback: route to sign-in if native reload is unavailable.
      router.replace('/sign-in');
      onReset();
    } finally {
      setRecovering(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Oops! Something went wrong</Text>
        {__DEV__ && !!error?.message ? (
          <Text style={[styles.debugMessage, { color: colors.mutedText }]}>{error.message}</Text>
        ) : null}
        <Text style={[styles.message, { color: colors.mutedText }]}>
          Please restart the app or try again.
        </Text>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.tint }]} 
          onPress={onReset}
          disabled={recovering}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, { borderColor: colors.destructive }]}
          onPress={handleSignOutAndRestart}
          disabled={recovering}
        >
          {recovering ? (
            <ActivityIndicator color={colors.destructive} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.destructive }]}>Sign Out & Restart</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  debugMessage: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 180,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
