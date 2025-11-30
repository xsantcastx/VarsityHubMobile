import Constants from 'expo-constants';

const BASE_URL: string = (Constants?.expoConfig as any)?.extra?.appBaseUrl || process.env.EXPO_PUBLIC_APP_BASE_URL || 'https://varsityhub.com';

export const AppLinks = {
  post: (id: string) => `${BASE_URL}/posts/${id}`,
  highlight: (id: string) => `${BASE_URL}/highlights/${id}`,
  game: (id: string) => `${BASE_URL}/games/${id}`,
  team: (id: string) => `${BASE_URL}/teams/${id}`,
  user: (id: string) => `${BASE_URL}/users/${id}`,
  event: (id: string) => `${BASE_URL}/events/${id}`,
};

export default AppLinks;