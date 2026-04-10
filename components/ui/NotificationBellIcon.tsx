import { IconSymbol } from '@/components/ui/IconSymbol';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
// @ts-ignore
import { Notification } from '@/api/entities';

export default function NotificationBellIcon({ color }: { color: string }) {
  const [unread, setUnread] = useState<number>(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const page: any = await (Notification.listPage ? Notification.listPage(null, 50, false) : { items: [] });
        if (!alive) return;
        const count = (page?.items || []).filter((n: any) => !n.read_at).length;
        setUnread(count);
      } catch (err) {
        if (__DEV__) console.warn('[NotificationBellIcon] Failed to load unread count:', (err as Error)?.message);
      }
    };
    void load();
    const id = setInterval(() => void load(), 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const badge = unread > 0 ? (
    <View style={{ position: 'absolute', right: -4, top: -2, backgroundColor: '#EF4444', minWidth: 14, height: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
      <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>{unread > 9 ? '9+' : String(unread)}</Text>
    </View>
  ) : null;

  return (
    <View style={{
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
      <IconSymbol size={28} name="bell.fill" color={color} />
      {badge}
    </View>
  );
}
