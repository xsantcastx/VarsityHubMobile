/** Standalone DEV-only native thumbnail probe. Never imported by the app entry.
 * Serve synthetic short.mp4 / normal.mp4 on localhost:8765, then open this
 * Metro entry through the installed development client. No Sentry events sent.
 */
import '@expo/metro-runtime';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { registerRootComponent } from 'expo';
import { createVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function probe() {
  const results: object[] = [];
  for (const name of ['short', 'normal']) {
    const uri = `${FileSystem.cacheDirectory}thumbnail-probe-${name}.mp4`;
    await FileSystem.downloadAsync(`http://localhost:8765/${name}.mp4`, uri, {
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    });
    const player = createVideoPlayer(uri);
    try {
      for (let i = 0; i < 100 && player.status !== 'readyToPlay'; i++) await pause(100);
      if (player.status !== 'readyToPlay') throw new Error(`Not ready: ${player.status}`);
      const duration = player.duration;
      for (const mode of ['inclusive-end', 'interior'] as const) {
        const times = Array.from({ length: 10 }, (_, i) =>
          mode === 'inclusive-end' ? (i / 9) * duration : (i / 10) * duration
        );
        try {
          const thumbs = await player.generateThumbnailsAsync(times, { maxHeight: 50 });
          results.push({ name, mode, duration, count: thumbs.length, ok: true });
        } catch (error) {
          results.push({ name, mode, duration, ok: false, message: String(error) });
        }
      }
    } finally {
      player.release();
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  }
  return results;
}

function Harness() {
  const [output, setOutput] = useState('Running native thumbnail probe');
  useEffect(() => {
    if (!__DEV__) return;
    void probe()
      .then(async results => {
        const body = JSON.stringify(results);
        console.info('[thumbnail-repro]', body);
        setOutput(`COMPLETE\n${body}`);
        await fetch('http://localhost:8765/results', { method: 'POST', body });
      })
      .catch(error => setOutput(`FAILED ${String(error)}`));
  }, []);
  if (!__DEV__) return null;
  return (
    <View style={{ flex: 1, padding: 50, backgroundColor: 'white' }}>
      <Text style={{ color: 'black' }}>{output}</Text>
    </View>
  );
}
registerRootComponent(Harness);
