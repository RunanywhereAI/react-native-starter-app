import 'react-native-gesture-handler'; // Must be at the top!
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// Note: react-native-screens is shimmed in index.js for iOS New Architecture compatibility
import { ModelServiceProvider } from './services/ModelService';
import { AppColors } from './theme';
import { HomeScreen, LiveSessionScreen, InsightsScreen, SettingsScreen } from './screens';
import { RootStackParamList } from './navigation/types';

// Using JS-based stack navigator instead of native-stack
// to avoid react-native-screens setColor crash with New Architecture
const Stack = createStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  // SDK initialization is now handled inside ModelServiceProvider

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ModelServiceProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F0FF" />
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerStyle: {
                backgroundColor: '#F5F0FF',
                elevation: 0,
                shadowOpacity: 0,
                borderBottomWidth: 0,
              },
              headerTintColor: '#1A1A2E',
              headerTitleStyle: {
                fontWeight: '700',
                fontSize: 18,
                color: '#1A1A2E',
              },
              cardStyle: {
                backgroundColor: '#F5F0FF',
              },
              // iOS-like animations
              ...TransitionPresets.SlideFromRightIOS,
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="LiveSession"
              component={LiveSessionScreen}
              options={{ title: 'Live Session' }}
            />
            <Stack.Screen
              name="Insights"
              component={InsightsScreen}
              options={{ title: 'Session Insights' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </ModelServiceProvider>
    </GestureHandlerRootView>
  );
};

export default App;
