import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type PollOption = {
  id: string;
  text: string;
  votes: number;
};

type PollCardProps = {
  poll: {
    id: string;
    question: string;
    options: PollOption[];
    totalVotes: number;
    endsAt?: string;
    userVote?: string | null;
  };
  onVote?: (pollId: string, optionId: string) => Promise<any>;
};

export default function PollCard({ poll, onVote }: PollCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [selectedOption, setSelectedOption] = useState<string | null>(poll.userVote || null);
  const [options, setOptions] = useState<PollOption[]>(poll.options);
  const [totalVotes, setTotalVotes] = useState(poll.totalVotes || 0);
  const [voting, setVoting] = useState(false);

  const hasVoted = selectedOption !== null;
  // Polls stay open until midnight UTC the day after endsAt (covers all US timezones)
  const isExpired = (() => {
    if (!poll.endsAt) return false;
    const expiresDate = new Date(poll.endsAt);
    const endOfExpiryDay = new Date(
      Date.UTC(
        expiresDate.getUTCFullYear(),
        expiresDate.getUTCMonth(),
        expiresDate.getUTCDate() + 1
      )
    );
    return new Date() >= endOfExpiryDay;
  })();

  const handleVote = async (optionId: string) => {
    if (hasVoted || isExpired || voting) return;

    setVoting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (onVote) {
        const result = await onVote(poll.id, optionId);
        if (result?.options) {
          setOptions(result.options);
          setTotalVotes(result.totalVotes || 0);
        }
      } else {
        // Optimistic update if no API callback
        setOptions(prev =>
          prev.map(opt => (opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt))
        );
        setTotalVotes(prev => prev + 1);
      }
      setSelectedOption(optionId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit vote');
    } finally {
      setVoting(false);
    }
  };

  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border },
      ]}
    >
      {/* Poll Header */}
      <View style={styles.header}>
        <Ionicons name="bar-chart" size={20} color={Colors[colorScheme].tint} />
        <Text style={[styles.question, { color: Colors[colorScheme].text }]} numberOfLines={3}>
          {poll.question}
        </Text>
      </View>

      {/* Poll Options */}
      <View style={styles.optionsContainer}>
        {options.map(option => {
          const percentage = getPercentage(option.votes);
          const isSelected = selectedOption === option.id;
          const showResults = hasVoted || isExpired;

          return (
            <Pressable
              key={option.id}
              style={[
                styles.option,
                { borderColor: Colors[colorScheme].border },
                isSelected && styles.selectedOption,
              ]}
              onPress={() => handleVote(option.id)}
              disabled={hasVoted || isExpired || voting}
            >
              {showResults && (
                <LinearGradient
                  colors={isSelected ? ['#3B82F6', '#2563EB'] : ['#D1D5DB', '#D1D5DB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.resultBar, { width: `${percentage}%` }]}
                />
              )}

              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionText,
                    { color: Colors[colorScheme].text },
                    showResults && styles.optionTextBold,
                  ]}
                  numberOfLines={2}
                >
                  {option.text}
                </Text>

                {showResults && (
                  <View style={styles.resultInfo}>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#3B82F6"
                        style={styles.checkIcon}
                      />
                    )}
                    <Text
                      style={[
                        styles.percentage,
                        { color: isSelected ? '#3B82F6' : theme.mutedText },
                        isSelected && styles.percentageSelected,
                      ]}
                    >
                      {percentage}%
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Poll Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Ionicons name="people" size={14} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.footerText, { color: Colors[colorScheme].mutedText }]}>
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </Text>
        </View>

        {poll.endsAt && (
          <View style={styles.footerRight}>
            <Ionicons
              name={isExpired ? 'close-circle' : 'time'}
              size={14}
              color={isExpired ? '#EF4444' : Colors[colorScheme].mutedText}
            />
            <Text
              style={[
                styles.footerText,
                { color: isExpired ? '#EF4444' : Colors[colorScheme].mutedText },
              ]}
            >
              {isExpired ? 'Ended' : `Ends ${formatTimeRemaining(poll.endsAt)}`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function formatTimeRemaining(endsAt: string): string {
  const now = new Date();
  const end = new Date(endsAt);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return 'now';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `in ${days}d`;
  if (hours > 0) return `in ${hours}h`;
  return 'soon';
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 6px 12px rgba(15, 23, 42, 0.06)' }
      : {
          shadowColor: '#0f172a',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }),
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  question: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 10,
    marginBottom: 12,
  },
  option: {
    position: 'relative',
    borderWidth: 2,
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    overflow: 'hidden',
  },
  selectedOption: {
    borderColor: '#3B82F6',
  },
  resultBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
    opacity: 0.2,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  optionTextBold: {
    fontWeight: '700',
  },
  resultInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  checkIcon: {
    marginRight: 2,
  },
  percentage: {
    fontSize: 15,
    fontWeight: '800',
    minWidth: 40,
    textAlign: 'right',
  },
  percentageSelected: {
    color: '#3B82F6',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
