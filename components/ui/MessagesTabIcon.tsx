import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
// @ts-ignore
import { Message } from '@/api/entities';

export default function MessagesTabIcon({ color }: { color: string }) {
  const [unread, setUnread] = useState<number>(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const list: any[] = await (Message.list ? Message.list('-created_date', 200) : []);
        if (!alive) return;
        const count = (list || []).filter((m: any) => !m.read).length;
        setUnread(count);
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const badge = unread > 0 ? (
    <View style={{ position: 'absolute', right: -4, top: -2, backgroundColor: '#EF4444', minWidth: 14, height: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
      <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>{unread > 9 ? '9+' : String(unread)}</Text>
    </View>
  ) : null;

  return (
    <View style={{
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
      backgroundColor: 'rgba(255,255,255,0.2)'
    }}>
      <View style={{ width: 28, height: 28 }}>
        <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />
        {badge}
      </View>
    </View>
  );
}
