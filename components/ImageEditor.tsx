import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';

type Props = {
  visible: boolean;
  imageUri: string | null;
  onSave: (uri: string) => void;
  onClose: () => void;
};

type Sticker = { id: string; emoji: string; x: number; y: number; size: number };

export default function ImageEditor({ visible, imageUri, onSave, onClose }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const [baseUri, setBaseUri] = useState<string | null>(imageUri);
  const [filter, setFilter] = useState<string>('none');
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const viewShotRef = useRef<ViewShot | null>(null);
  const [imgSize, setImgSize] = useState<{w:number,h:number} | null>(null);
  const CANVAS_HEIGHT = 320;

  React.useEffect(() => {
    setBaseUri(imageUri);
    setFilter('none');
    setStickers([]);
    setImgSize(null);
  }, [imageUri, visible]);

  const addSticker = (emoji: string) => {
    const id = String(Date.now());
    const { width } = Dimensions.get('window');
    setStickers((s) => [...s, { id, emoji, x: width / 2 - 40, y: 160, size: 48 }]);
  };

  const updateSticker = (id: string, deltaX: number, deltaY: number) => {
    setStickers((s) => s.map(st => st.id === id ? { ...st, x: st.x + deltaX, y: st.y + deltaY } : st));
  };

  const removeSticker = (id: string) => setStickers((s) => s.filter(st => st.id !== id));

  const handleSave = async () => {
    if (!viewShotRef.current) return;
    try {
      const uri = await captureRef(viewShotRef.current, { format: 'png', quality: 0.95 });
      onSave(uri as string);
    } catch (e) {
      console.error('Failed to capture edited image', e);
    }
  };

  if (!visible) return null;

  const filters = [
    { id: 'none', label: 'None', overlay: 'transparent' },
    { id: 'warm', label: 'Warm', overlay: 'rgba(255,140,0,0.12)' },
    { id: 'cool', label: 'Cool', overlay: 'rgba(0,120,255,0.12)' },
    { id: 'dark', label: 'Moody', overlay: 'rgba(0,0,0,0.18)' },
    { id: 'light', label: 'Bright', overlay: 'rgba(255,255,255,0.12)' },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <View style={[styles.header, { borderBottomColor: Colors[colorScheme].border }] }>
          <Pressable onPress={onClose}><Text style={[styles.headerText, { color: Colors[colorScheme].tint }]}>Cancel</Text></Pressable>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Edit Image</Text>
          <Pressable onPress={handleSave}><Text style={[styles.headerText, { color: Colors[colorScheme].tint }]}>Save</Text></Pressable>
        </View>

        <ViewShot ref={(r) => { viewShotRef.current = r; }} style={styles.canvas} options={{ format: 'png', quality: 0.95 }}>
          <View style={[styles.canvasInner, { height: CANVAS_HEIGHT, backgroundColor: Colors[colorScheme].surface }] }>
            {baseUri ? (
              <MeasuredImage uri={baseUri} onSize={(w,h) => setImgSize({w,h})} maxW={Dimensions.get('window').width - 48} maxH={CANVAS_HEIGHT - 24} />
            ) : (
              <View style={styles.empty}><Text style={{ color: Colors[colorScheme].mutedText }}>No image</Text></View>
            )}
            {/* Filter overlay */}
            <View style={[styles.filterOverlay, { backgroundColor: (filters.find(f => f.id === filter) as any)?.overlay || 'transparent', height: CANVAS_HEIGHT }]} pointerEvents="none" />

            {/* Stickers */}
            {stickers.map((st) => (
              <DraggableSticker key={st.id} sticker={st} onMove={(dx, dy) => updateSticker(st.id, dx, dy)} onRemove={() => removeSticker(st.id)} />
            ))}
          </View>
        </ViewShot>

        <View style={styles.row}>{filters.map(f => (
          <Pressable key={f.id} style={[
            styles.filterBtn,
            f.id === filter && styles.filterBtnActive,
            { borderColor: Colors[colorScheme].border, backgroundColor: f.id === filter ? Colors[colorScheme].elevated : undefined }
          ]} onPress={() => setFilter(f.id)}>
            <Text style={[styles.filterText, { color: Colors[colorScheme].text }]}>{f.label}</Text>
          </Pressable>
        ))}</View>

        <View style={styles.row}>
          {['⭐','🔥','⚽','🏀','🎯'].map(e => (
            <Pressable key={e} style={styles.stickerBtn} onPress={() => addSticker(e)}>
              <Text style={{ fontSize: 24 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function MeasuredImage({ uri, onSize, maxW = 300, maxH = 240 }: { uri: string; onSize: (w:number,h:number)=>void; maxW?: number; maxH?: number }){
  const [size, setSize] = useState<{w:number,h:number}|null>(null);
  useEffect(()=>{
    let mounted = true;
    Image.getSize(uri, (w,h)=> { if (mounted) { setSize({w,h}); onSize(w,h); } }, (e) => { console.warn('getSize failed', e); });
    return () => { mounted = false; };
  },[uri]);

  if (!size) {
    return <View style={{ width: maxW, height: maxH, alignItems: 'center', justifyContent: 'center' }}><Text>Loading…</Text></View>;
  }

  const aspect = size.w / size.h;
  let imgW = maxW;
  let imgH = Math.round(imgW / aspect);
  if (imgH > maxH) {
    imgH = maxH;
    imgW = Math.round(imgH * aspect);
  }

  return (
    <Image source={{ uri }} style={{ width: imgW, height: imgH, borderRadius: 8 }} resizeMode="cover" />
  );
}

function DraggableSticker({ sticker, onMove, onRemove }: { sticker: Sticker; onMove: (dx: number, dy: number) => void; onRemove: () => void }) {
  const pan = useRef({ x: sticker.x, y: sticker.y });
  const [pos, setPos] = useState({ x: sticker.x, y: sticker.y });

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {},
    onPanResponderMove: (_evt, gestureState) => {
      setPos({ x: pan.current.x + gestureState.dx, y: pan.current.y + gestureState.dy });
    },
    onPanResponderRelease: (_e, gestureState) => {
      pan.current.x += gestureState.dx;
      pan.current.y += gestureState.dy;
      onMove(gestureState.dx, gestureState.dy);
    }
  })).current;

  return (
    <View style={[styles.sticker, { left: pos.x, top: pos.y }]} {...responder.panHandlers}>
      <Text style={{ fontSize: sticker.size }}>{sticker.emoji}</Text>
      <Pressable style={styles.removeBtn} onPress={onRemove}><Text style={{ fontSize: 12 }}>✕</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700' },
  canvas: { padding: 12 },
  canvasInner: { width: '100%', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8 },
  canvasImage: { width: '100%', height: 260, borderRadius: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', height: 260 },
  filterOverlay: { position: 'absolute', left: 0, right: 0, top: 0, borderRadius: 0 },
  row: { flexDirection: 'row', padding: 12, gap: 8, justifyContent: 'center' },
  filterBtn: { padding: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  filterBtnActive: { backgroundColor: '#EEE' },
  filterText: { fontSize: 14, fontWeight: '600' },
  stickerBtn: { padding: 8 },
  sticker: { position: 'absolute' , alignItems: 'center', justifyContent: 'center' },
  removeBtn: { position: 'absolute', right: -8, top: -8, backgroundColor: '#fff', borderRadius: 8, padding: 2 },
});
