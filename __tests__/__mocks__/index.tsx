import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';

const Stack = createStackNavigator();

export const MockedNavigator = ({ component, params = {} }: { component: React.ComponentType<any>, params?: any }) => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="MockedScreen"
          component={component}
          initialParams={params}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export const MockedProvider = ({ children }: { children: React.ReactNode }) => {
  // You can wrap children with any context providers your app uses
  return <>{children}</>;
};
