/**
 * RunAnywhere Starter App - Expo Entry Point
 * Simple test version to verify Metro connection works
 */

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar } from 'react-native';

const App: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.content}>
        <Text style={styles.title}>🎉 RunAnywhere AI Studio</Text>
        <Text style={styles.subtitle}>Metro Connection Working!</Text>
        <Text style={styles.info}>
          The app bundle loaded successfully from the Metro dev server.
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next Steps:</Text>
          <Text style={styles.cardText}>
            • Native modules (NitroModules) need to be compiled into the AI Studio app
          </Text>
          <Text style={styles.cardText}>
            • Then @runanywhere/core, llamacpp, onnx will work
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: '#22C55E',
    marginBottom: 24,
    fontWeight: '600',
  },
  info: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 12,
    width: '100%',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default App;
