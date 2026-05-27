import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type EditScreenLoadingProps = {
  title: string;
  message: string;
  backgroundColor: string;
  tintColor: string;
  textColor: string;
};

type EditScreenHeaderProps = {
  title: string;
  textColor: string;
  topPadding: number;
  onBack: () => void;
};

type EditScreenSubmitButtonProps = {
  label: string;
  tintColor: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

type EditTextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  textColor: string;
  mutedTextColor: string;
  surfaceColor: string;
  borderColor: string;
  maxLength?: number;
};

export function EditScreenLoading({
  title,
  message,
  backgroundColor,
  tintColor,
  textColor,
}: EditScreenLoadingProps) {
  return (
    <View style={[editScreenSharedStyles.loadingContainer, { backgroundColor }]}>
      <Stack.Screen options={{ title, headerShown: false }} />
      <ActivityIndicator size="large" color={tintColor} />
      <Text style={[editScreenSharedStyles.loadingText, { color: textColor }]}>{message}</Text>
    </View>
  );
}

export function EditScreenHeader({ title, textColor, topPadding, onBack }: EditScreenHeaderProps) {
  return (
    <View style={[editScreenSharedStyles.header, { paddingTop: topPadding }]}>
      <Pressable style={editScreenSharedStyles.backButton} onPress={onBack}>
        <MaterialIcons name="arrow-back" size={24} color={textColor} />
      </Pressable>
      <Text style={[editScreenSharedStyles.headerTitle, { color: textColor }]}>{title}</Text>
      <View style={{ width: 32 }} />
    </View>
  );
}

export function EditScreenSubmitButton({
  label,
  tintColor,
  disabled = false,
  loading = false,
  onPress,
}: EditScreenSubmitButtonProps) {
  return (
    <View style={editScreenSharedStyles.submitSection}>
      <Pressable
        style={[
          editScreenSharedStyles.submitButton,
          { backgroundColor: tintColor },
          disabled && editScreenSharedStyles.submitButtonDisabled,
        ]}
        onPress={onPress}
        disabled={disabled}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <MaterialIcons name="check-circle" size={20} color="#fff" />
            <Text style={editScreenSharedStyles.submitButtonText}>{label}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export function EditTextField({
  label,
  value,
  onChangeText,
  placeholder,
  textColor,
  mutedTextColor,
  surfaceColor,
  borderColor,
  maxLength,
}: EditTextFieldProps) {
  return (
    <View style={editScreenSharedStyles.inputGroup}>
      <Text style={[editScreenSharedStyles.inputLabel, { color: textColor }]}>{label}</Text>
      <TextInput
        style={[
          editScreenSharedStyles.textInput,
          {
            backgroundColor: surfaceColor,
            borderColor,
            color: textColor,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={mutedTextColor}
        maxLength={maxLength}
      />
    </View>
  );
}

export const editScreenSharedStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  charCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  fieldHint: {
    fontSize: 13,
    marginTop: 6,
    fontStyle: 'italic',
  },
  submitSection: {
    paddingHorizontal: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
