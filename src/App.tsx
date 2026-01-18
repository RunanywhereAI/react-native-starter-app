import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import { ModelServiceProvider, registerDefaultModels } from './services/ModelService';
import { AppColors } from './theme';
import {
  HomeScreen,
  ChatScreen,
  SpeechToTextScreen,
  TextToSpeechScreen,
  VoicePipelineScreen,
} from './screens';
import { RootStackParamList } from './navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  useEffect(() => {
    // Initialize SDK
    const initializeSDK = async () => {
      try {
        console.log('[App] Starting SDK initialization...');
        
        // Try to import and check if native modules are available
        const core = await import('@runanywhere/core');
        console.log('[App] @runanywhere/core imported, exports:', Object.keys(core));
        
        const { RunAnywhere, SDKEnvironment } = core;
        
        // Check if RunAnywhere has the initialize method
        if (!RunAnywhere || typeof RunAnywhere.initialize !== 'function') {
          console.warn('[App] RunAnywhere.initialize not available, native module may not be linked');
          // Continue without initialization - the UI will still work
          return;
        }

        // Try to initialize - this may fail if native module isn't properly linked
        try {
          await RunAnywhere.initialize({
            environment: SDKEnvironment.Development,
          });
          console.log('[App] RunAnywhere.initialize() succeeded');
        } catch (initError: any) {
          console.warn('[App] RunAnywhere.initialize() failed:', initError.message);
          // Continue anyway - some features may still work
        }

        // Register backends
        try {
          const { LlamaCPP } = await import('@runanywhere/llamacpp');
          console.log('[App] @runanywhere/llamacpp imported');
          if (LlamaCPP && typeof LlamaCPP.register === 'function') {
            LlamaCPP.register();
            console.log('[App] LlamaCPP.register() called');
          }
        } catch (e: any) {
          console.warn('[App] LlamaCPP registration failed:', e.message);
        }

        try {
          const { ONNX } = await import('@runanywhere/onnx');
          console.log('[App] @runanywhere/onnx imported');
          if (ONNX && typeof ONNX.register === 'function') {
            ONNX.register();
            console.log('[App] ONNX.register() called');
          }
        } catch (e: any) {
          console.warn('[App] ONNX registration failed:', e.message);
        }

        // Register default models
        try {
          await registerDefaultModels();
          console.log('[App] Default models registered');
        } catch (e: any) {
          console.warn('[App] Model registration failed:', e.message);
        }

        console.log('[App] SDK initialization complete');
      } catch (error: any) {
        console.error('[App] Failed to initialize RunAnywhere SDK:', error);
        // Still continue - the UI will load and user can see what features work
      }
    };

    initializeSDK();
  }, []);

  return (
    <ModelServiceProvider>
      <StatusBar barStyle="light-content" backgroundColor={AppColors.primaryDark} />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: AppColors.primaryDark,
            },
            headerTintColor: AppColors.textPrimary,
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
            },
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: AppColors.primaryDark,
            },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ title: 'Chat' }}
          />
          <Stack.Screen
            name="SpeechToText"
            component={SpeechToTextScreen}
            options={{ title: 'Speech to Text' }}
          />
          <Stack.Screen
            name="TextToSpeech"
            component={TextToSpeechScreen}
            options={{ title: 'Text to Speech' }}
          />
          <Stack.Screen
            name="VoicePipeline"
            component={VoicePipelineScreen}
            options={{ title: 'Voice Pipeline' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ModelServiceProvider>
  );
};

export default App;
