import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

const menuItems = [
  {
    label: 'Organization & Team',
    screen: '/settings/organization-team',
  },
  {
    label: 'Billing & Plan',
    screen: '/settings/billing',
  },
  {
    label: 'Favorites',
    screen: '/settings/favorites',
  },
  {
    label: 'Blocked Users',
    screen: '/settings/blocked-users',
  },
];

export default function SettingsMenuScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Settings</Text>
      {menuItems.map((item) => (
        <Pressable
          key={item.label}
          style={styles.menuItem}
          onPress={() => router.push(item.screen as any)}
        >
          <Text style={styles.menuText}>{item.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    color: '#222',
    alignSelf: 'center',
  },
  menuItem: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f7',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  menuText: {
    fontSize: 18,
    color: '#222',
    fontWeight: '500',
  },
});
