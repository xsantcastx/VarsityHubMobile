import { User } from '@/api/entities';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface MentionUser {
  id: string;
  display_name: string;
  avatar_url?: string;
}

interface MentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  multiline?: boolean;
  style?: any;
  maxLength?: number;
}

export function MentionInput({ 
  value, 
  onChangeText, 
  placeholder,
  placeholderTextColor,
  multiline, 
  style,
  maxLength
}: MentionInputProps) {
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentMention, setCurrentMention] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<any>(null);

  const searchUsers = async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const data = await User.searchForMentions(query, 10);
      setSuggestions(data.users || []);
      setShowSuggestions((data.users || []).length > 0);
    } catch (error) {
      console.error('Failed to search users:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleTextChange = (text: string) => {
    onChangeText(text);
    
    // Get cursor position (for simplicity, use end of text)
    const cursorPos = text.length;
    const textBeforeCursor = text.substring(0, cursorPos);
    
    // Find the last @ symbol before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex >= 0) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if there's a space or newline in the mention text
      if (!/[\s\n]/.test(textAfterAt)) {
        setMentionStart(lastAtIndex);
        setCurrentMention(textAfterAt);
        
        // Clear previous timeout
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        
        // Debounce the search
        searchTimeoutRef.current = setTimeout(() => {
          searchUsers(textAfterAt);
        }, 300);
        return;
      }
    }
    
    // Not in a mention anymore
    setShowSuggestions(false);
    setSuggestions([]);
    setCurrentMention('');
    setMentionStart(-1);
  };

  const insertMention = (user: MentionUser) => {
    if (mentionStart === -1) return;
    
    const beforeMention = value.substring(0, mentionStart);
    const afterMention = value.substring(mentionStart + currentMention.length + 1);
    const newText = `${beforeMention}@${user.display_name} ${afterMention}`;
    
    onChangeText(newText);
    setShowSuggestions(false);
    setSuggestions([]);
    setCurrentMention('');
    setMentionStart(-1);
    
    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        multiline={multiline}
        style={[styles.input, style]}
        maxLength={maxLength}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsList}>
            {suggestions.slice(0, 4).map((item) => (
              <Pressable 
                key={item.id}
                style={styles.suggestionItem} 
                onPress={() => insertMention(item)}
              >
                <View style={styles.avatarContainer}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={16} color="#6B7280" />
                    </View>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.displayName}>@{item.display_name}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  input: {
    // Base styles will be inherited from parent
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1000,
    maxHeight: 200,
  },
  suggestionsList: {
    // Remove maxHeight since we're limiting to 4 items
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});

export default MentionInput;