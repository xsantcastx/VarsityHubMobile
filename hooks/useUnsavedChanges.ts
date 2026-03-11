/**
 * Hook to track unsaved changes in forms and warn before leaving
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export interface UseUnsavedChangesOptions {
  /** Initial values to compare against */
  initialValues?: Record<string, any>;
  /** Message to show when user tries to leave */
  message?: string;
  /** Title for the alert */
  title?: string;
  /** Whether the hook is enabled */
  enabled?: boolean;
}

export interface UseUnsavedChangesReturn {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Mark the form as dirty manually */
  setDirty: (dirty: boolean) => void;
  /** Reset to clean state (call after save) */
  resetDirty: () => void;
  /** Check a value against initial and mark dirty if changed */
  trackChange: (key: string, value: any) => void;
  /** Confirm navigation with user if dirty */
  confirmLeave: (onConfirm: () => void) => void;
}

/**
 * Track unsaved changes in a form and warn user before leaving
 *
 * @example
 * ```tsx
 * const { isDirty, trackChange, resetDirty, confirmLeave } = useUnsavedChanges({
 *   initialValues: { name: user.name, bio: user.bio },
 *   message: 'You have unsaved changes. Discard them?',
 * });
 *
 * // Track changes
 * <Input
 *   value={name}
 *   onChangeText={(text) => { setName(text); trackChange('name', text); }}
 * />
 *
 * // On save success
 * await saveProfile();
 * resetDirty();
 *
 * // Custom back handling
 * const handleBack = () => {
 *   confirmLeave(() => navigation.goBack());
 * };
 * ```
 */
export function useUnsavedChanges(
  options: UseUnsavedChangesOptions = {}
): UseUnsavedChangesReturn {
  const {
    initialValues = {},
    message = 'You have unsaved changes. Are you sure you want to leave?',
    title = 'Discard changes?',
    enabled = true,
  } = options;

  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef<Record<string, any>>(initialValues);
  const currentRef = useRef<Record<string, any>>({ ...initialValues });
  const navigation = useNavigation();

  // Update initial values if they change
  const initialValuesKey = JSON.stringify(initialValues);
  useEffect(() => {
    initialRef.current = initialValues;
    currentRef.current = { ...initialValues };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- using serialized key to deep-compare initialValues
  }, [initialValuesKey]);

  // Track a value change
  const trackChange = useCallback((key: string, value: any) => {
    currentRef.current[key] = value;

    // Check if any value differs from initial
    const hasChanges = Object.keys(currentRef.current).some(k => {
      const initial = initialRef.current[k];
      const current = currentRef.current[k];

      // Deep compare for objects/arrays
      if (typeof initial === 'object' && typeof current === 'object') {
        return JSON.stringify(initial) !== JSON.stringify(current);
      }
      return initial !== current;
    });

    setIsDirty(hasChanges);
  }, []);

  // Reset dirty state (call after successful save)
  const resetDirty = useCallback(() => {
    initialRef.current = { ...currentRef.current };
    setIsDirty(false);
  }, []);

  // Manually set dirty state
  const setDirty = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  // Confirm navigation if dirty
  const confirmLeave = useCallback((onConfirm: () => void) => {
    if (!isDirty || !enabled) {
      onConfirm();
      return;
    }

    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setIsDirty(false);
            onConfirm();
          },
        },
      ],
      { cancelable: true }
    );
  }, [isDirty, enabled, title, message]);

  // Handle hardware back button (Android)
  useEffect(() => {
    if (!enabled) return;

    const handleBackPress = () => {
      if (isDirty) {
        Alert.alert(
          title,
          message,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                setIsDirty(false);
                if (navigation.canGoBack()) navigation.goBack();
              },
            },
          ],
          { cancelable: true }
        );
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [isDirty, enabled, title, message, navigation]);

  // Warn on navigation (gesture back, tab switch, etc.)
  useEffect(() => {
    if (!enabled || !isDirty) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      // Only block if dirty
      if (!isDirty) return;

      // Prevent default behavior of leaving the screen
      e.preventDefault();

      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setIsDirty(false);
              navigation.dispatch(e.data.action);
            },
          },
        ],
        { cancelable: true }
      );
    });

    return unsubscribe;
  }, [navigation, isDirty, enabled, title, message]);

  return {
    isDirty,
    setDirty,
    resetDirty,
    trackChange,
    confirmLeave,
  };
}

export default useUnsavedChanges;
