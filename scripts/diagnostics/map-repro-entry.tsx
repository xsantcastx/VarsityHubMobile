/** Standalone DEV bundle; never imported by Expo Router or the production entry.
 * Open /scripts/diagnostics/map-repro-entry.bundle?platform=ios&dev=true&minify=false
 * through Expo Dev Launcher's `url` parameter. All fixtures are synthetic.
 */
import '@expo/metro-runtime';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { registerRootComponent } from 'expo';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EventMap, { type EventMapData } from '../../components/EventMap';

const Stack = createNativeStackNavigator();
const navigation = createNavigationContainerRef<any>();
const Fixtures = createContext<EventMapData[]>([]);
const baseline: EventMapData[] = Array.from({ length: 220 }, (_, i) => ({
  id: `synthetic-${i}`,
  title: `Synthetic fixture ${i}`,
  type: i % 2 ? 'game' : 'event',
  date: '2026-09-12T20:00:00Z',
  latitude: 35 + (i % 20) * 0.18,
  longitude: -100 + Math.floor(i / 20) * 0.18,
  sport: i % 2 ? 'football' : 'basketball',
  league_level: i % 3 ? 'college' : 'major',
}));

function MapScreen() {
  const events = useContext(Fixtures);
  return (
    <EventMap
      events={events}
      showUserLocation={false}
      autoFitPins={false}
      initialRegion={{ latitude: 37, longitude: -99, latitudeDelta: 10, longitudeDelta: 10 }}
      onEventPress={id => {
        console.info('[map-repro] pin-selected', id);
        navigation.navigate('Detail', { id });
      }}
    />
  );
}
function DetailScreen({ route }: any) {
  return (
    <View>
      <Text>{route.params?.id ?? 'Synthetic detail'}</Text>
    </View>
  );
}
function Harness() {
  const [step, setStep] = useState(-1);
  const phase = step % 10;
  const events = useMemo(() => {
    if (step < 0 || phase === 0 || phase === 6) return [];
    if (phase === 2)
      return baseline.filter(
        event => event.sport === 'football' && event.league_level === 'college'
      );
    if (phase === 3) return baseline.map(event => ({ ...event, latitude: 37, longitude: -99 }));
    if (phase === 4) return [...baseline].reverse();
    if (phase === 5) return baseline.slice(80);
    return baseline;
  }, [step, phase]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      console.info('[map-repro] app-state', state)
    );
    const start = setTimeout(() => {
      setStep(0);
    }, 5000);
    return () => {
      clearTimeout(start);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (step < 0) return;
    console.info(
      '[map-repro] phase',
      JSON.stringify({
        step,
        cycle: Math.floor(step / 10) + 1,
        phase,
        markers: events.length,
        time: Date.now(),
      })
    );
    if (phase === 8 && navigation.isReady()) navigation.navigate('Detail', { id: 'synthetic-1' });
    if (phase === 9 && navigation.canGoBack()) navigation.goBack();
    if (step >= 299) {
      console.info('[map-repro] COMPLETE 30 cycles');
      return;
    }
    const timer = setTimeout(() => setStep(step + 1), 800);
    return () => clearTimeout(timer);
  }, [step, phase, events.length]);
  if (!__DEV__) return null;
  return (
    <Fixtures.Provider value={events}>
      <View style={{ flex: 1 }}>
        <Text style={{ paddingTop: 55, backgroundColor: 'white', color: 'black' }}>
          Native map reproduction: {step >= 299 ? 'COMPLETE' : `step ${step}`}
        </Text>
        <NavigationContainer ref={navigation}>
          <Stack.Navigator>
            <Stack.Screen name="Map" component={MapScreen} />
            <Stack.Screen name="Detail" component={DetailScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </Fixtures.Provider>
  );
}
registerRootComponent(Harness);
