import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text } from "react-native";

// 1. Define your stack params
type RootStackParamList = {
  Home: undefined;   // Home screen takes no params
  // Details: { id: string }; // example if you add another screen
};

// 2. Pass the type into the navigator
const Stack = createNativeStackNavigator<RootStackParamList>();


function Home() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Home Screen</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {/* Type-safe: now Home expects no params */}
        <Stack.Screen name="Home" component={Home} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
