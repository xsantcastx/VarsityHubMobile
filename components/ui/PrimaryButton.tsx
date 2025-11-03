import React from 'react';
import { ActivityIndicator, ViewStyle } from 'react-native';
import Button from './button';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export default function PrimaryButton({ 
  label, 
  onPress, 
  disabled, 
  loading,
  style 
}: PrimaryButtonProps) {
  return (
    <Button 
      onPress={onPress} 
      disabled={disabled || loading}
      size="lg"
      style={{ width: '100%', ...style }}
    >
      {loading ? <ActivityIndicator color="white" /> : label}
    </Button>
  );
}
