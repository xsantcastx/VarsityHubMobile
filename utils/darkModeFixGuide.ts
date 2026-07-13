/**
 * This is a temporary utility to help find files that need dark mode fixes
 * Usage examples for manual fixes:
 *
 * 1. Replace hardcoded background colors:
 *    backgroundColor: 'white' → { backgroundColor: Colors[colorScheme].background }
 *    backgroundColor: '#F8FAFC' → { backgroundColor: Colors[colorScheme].surface }
 *
 * 2. Replace hardcoded text colors:
 *    color: 'black' → { color: Colors[colorScheme].text }
 *    color: '#6B7280' → { color: Colors[colorScheme].mutedText }
 *
 * 3. Replace hardcoded border colors:
 *    borderColor: '#E5E7EB' → { borderColor: Colors[colorScheme].border }
 *
 * 4. Add color scheme hook to components:
 *    import { useColorScheme } from '@/hooks/useColorScheme';
 *    import { Colors } from '@/constants/Colors';
 *    const colorScheme = useColorScheme();
 *
 * Common patterns found in the app:
 * - backgroundColor: 'white'
 * - backgroundColor: '#F8FAFC', '#F1F5F9', '#F3F4F6'
 * - color: 'black', '#111827'
 * - color: '#6B7280', '#9CA3AF' (muted text)
 * - borderColor: '#E5E7EB', '#E2E8F0'
 */

export const darkModeFixGuide = `
DARK MODE IMPLEMENTATION GUIDE

Key screens - status:
- Settings: ✅ FIXED
- Feed: ✅ FIXED
- Profile: ✅ FIXED
- Create modal: ✅ FIXED
- Sign in/up: ✅ FIXED
- Event detail, mobile-community: ✅ FIXED
- Payment cancel, subscription paywall: ✅ FIXED
- Admin ads: ✅ FIXED
- ImageEditor, RsvpSheet, QuickAddGameModal, ReachMapPreview: ✅ FIXED
- Game details screens: 🔄 some remain
- Onboarding: 🔄 some steps remain

Quick fix template:
1. Import theme hooks (useColorScheme, Colors)
2. Add colorScheme variable
3. Replace static styles with Colors[colorScheme].*
4. Test both light and dark modes
`;

if (__DEV__) console.log('Dark mode fix guide loaded');
