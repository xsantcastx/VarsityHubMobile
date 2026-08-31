import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  accountSuspendedHTML,
  addDays,
  reportDismissedHTML,
  reportResolvedHTML,
} from './ReportResolutionEmail';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

type EmailKind = 'resolved' | 'dismissed' | 'suspended';

export default function EmailPreview() {
  const [kind, setKind] = useState<EmailKind>('suspended');
  const now = useMemo(() => new Date(), []);
  const reinstate = useMemo(() => addDays(now, 45), [now]);

  const previewHTML = useMemo(() => {
    const variables = {
      reportId: 12345,
      violationType: 'Harassment',
      suspensionDate: now.toLocaleDateString(),
      reinstatementDate: reinstate.toLocaleDateString(),
      userName: 'John Doe',
      appealMailto:
        'mailto:customerservice@varsityhub.app?subject=' +
        encodeURIComponent('Appeal Suspension for Report #12345') +
        '&body=' +
        encodeURIComponent(
          `Hi VarsityHub Team,\n\nI am appealing the 45-day suspension for Report #12345.\n\nViolation Type: Harassment\nSuspension Date: ${now.toLocaleDateString()}\nReinstatement Date: ${reinstate.toLocaleDateString()}\n\nReason for Appeal:\n[User types their explanation here]\n\nThank you,\nJohn Doe\n`
        ),
    };
    switch (kind) {
      case 'resolved':
        return reportResolvedHTML(variables);
      case 'dismissed':
        return reportDismissedHTML(variables);
      case 'suspended':
      default:
        return accountSuspendedHTML(variables);
    }
  }, [kind, now, reinstate]);

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <ThemedText type="title">Email Preview</ThemedText>
      <ThemedText type="default">Kind: {kind}</ThemedText>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {(['resolved', 'dismissed', 'suspended'] as EmailKind[]).map(option => {
          const active = option === kind;
          return (
            <Pressable
              key={option}
              onPress={() => setKind(option)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? '#2563eb' : '#d1d5db',
                backgroundColor: active ? '#dbeafe' : 'transparent',
              }}
            >
              <ThemedText type="default" style={{ color: active ? '#1d4ed8' : '#374151' }}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedView
        style={{ marginTop: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 }}
      >
        <View style={{ pointerEvents: 'none' }}>
          {/* Render HTML minimally by showing text. In-app rendering engines may vary. */}
          <ThemedText type="default">{previewHTML}</ThemedText>
        </View>
      </ThemedView>
    </ScrollView>
  );
}
