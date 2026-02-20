import 'react-native-gesture-handler'; // Must be at the top!
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RunAnywhere, SDKEnvironment } from '@runanywhere/core';

// --- FIXED: Move these to the top to solve the "Dynamic Import" error ---
import { LlamaCPP } from '@runanywhere/llamacpp';
import { ONNX } from '@runanywhere/onnx';

import { ModelServiceProvider, registerDefaultModels } from './services/ModelService';
import { AppColors } from './theme';
import {
  HomeScreen,
  ChatScreen,
  SpeechToTextScreen,
  TextToSpeechScreen,
  VoicePipelineScreen,
  PinpointerScreen,
  ToolCallingScreen,
  SmartClipboardScreen,
  PointAndSpeakScreen,
} from './screens';
import { setupDatabase } from './Database';
import { RootStackParamList } from './navigation/types';

const Stack = createStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Initialize Pinpoint Search Database
        setupDatabase();

        // 2. Initialize RunAnywhere SDK
        await RunAnywhere.initialize({
          environment: SDKEnvironment.Development,
        });

        // 3. Register backends (Now using the top-level imports)
        LlamaCPP.register();
        ONNX.register();

        await registerDefaultModels();
        console.log('All systems initialized successfully');
      } catch (error) {
        console.error('Initialization failed:', error);
      }
    };

    initializeApp();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ModelServiceProvider>
        <StatusBar barStyle="light-content" backgroundColor={AppColors.primaryDark} />
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Pinpointer" // This makes your UI the main screen
            screenOptions={{
              headerStyle: {
                backgroundColor: AppColors.primaryDark,
                elevation: 0,
                shadowOpacity: 0,
              },
              headerTintColor: AppColors.textPrimary,
              headerTitleStyle: { fontWeight: '700', fontSize: 18 },
              cardStyle: { backgroundColor: AppColors.primaryDark },
              ...TransitionPresets.SlideFromRightIOS,
            }}
          >
            {/* --- Pinpointer Screen --- */}
            <Stack.Screen
              name="Pinpointer"
              component={PinpointerScreen}
              options={{ headerShown: false }}
            />

            {/* Existing Hackathon Screens */}
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'My AI' }} />
            <Stack.Screen name="ToolCalling" component={ToolCallingScreen} options={{ title: 'Tool Calling' }} />
            <Stack.Screen name="SpeechToText" component={SpeechToTextScreen} options={{ title: 'Speech to Text' }} />
            <Stack.Screen name="TextToSpeech" component={TextToSpeechScreen} options={{ title: 'Text to Speech' }} />
            <Stack.Screen name="VoicePipeline" component={VoicePipelineScreen} options={{ title: 'Voice Pipeline' }} />

            {/* New Feature Screens */}
            <Stack.Screen name="SmartClipboard" component={SmartClipboardScreen} options={{ title: 'Smart Clipboard' }} />
            <Stack.Screen name="PointAndSpeak" component={PointAndSpeakScreen} options={{ title: 'Point & Speak' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </ModelServiceProvider>
    </GestureHandlerRootView>
  );
};

export default App;