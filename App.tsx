/**
 * RunAnywhere Starter App - Testing Native Modules
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native';

// Import RunAnywhere modules
let RunAnywhereLlamaCpp: any = null;
let RunAnywhereCore: any = null;
let RunAnywhereOnnx: any = null;
let moduleError: string | null = null;

try {
  RunAnywhereLlamaCpp = require('@runanywhere/llamacpp');
  console.log('✅ @runanywhere/llamacpp loaded successfully');
} catch (e: any) {
  moduleError = `LlamaCpp: ${e.message}`;
  console.log('❌ Failed to load @runanywhere/llamacpp:', e.message);
}

try {
  RunAnywhereCore = require('@runanywhere/core');
  console.log('✅ @runanywhere/core loaded successfully');
} catch (e: any) {
  moduleError = moduleError ? `${moduleError}\nCore: ${e.message}` : `Core: ${e.message}`;
  console.log('❌ Failed to load @runanywhere/core:', e.message);
}

try {
  RunAnywhereOnnx = require('@runanywhere/onnx');
  console.log('✅ @runanywhere/onnx loaded successfully');
} catch (e: any) {
  moduleError = moduleError ? `${moduleError}\nOnnx: ${e.message}` : `Onnx: ${e.message}`;
  console.log('❌ Failed to load @runanywhere/onnx:', e.message);
}

const App: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Checking native modules...');
  const [details, setDetails] = useState<string[]>([]);

  useEffect(() => {
    checkNativeModules();
  }, []);

  const checkNativeModules = async () => {
    const newDetails: string[] = [];
    
    try {
      // Check if modules are available
      if (RunAnywhereLlamaCpp) {
        newDetails.push('✅ @runanywhere/llamacpp - LOADED');
        
        // Try to get available functions
        const keys = Object.keys(RunAnywhereLlamaCpp);
        if (keys.length > 0) {
          newDetails.push(`   Exports: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
        }
      } else {
        newDetails.push('❌ @runanywhere/llamacpp - NOT AVAILABLE');
      }

      if (RunAnywhereCore) {
        newDetails.push('✅ @runanywhere/core - LOADED');
        
        const keys = Object.keys(RunAnywhereCore);
        if (keys.length > 0) {
          newDetails.push(`   Exports: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
        }
      } else {
        newDetails.push('❌ @runanywhere/core - NOT AVAILABLE');
      }

      if (RunAnywhereOnnx) {
        newDetails.push('✅ @runanywhere/onnx - LOADED');
        
        const keys = Object.keys(RunAnywhereOnnx);
        if (keys.length > 0) {
          newDetails.push(`   Exports: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
        }
      } else {
        newDetails.push('❌ @runanywhere/onnx - NOT AVAILABLE');
      }

      if (moduleError) {
        newDetails.push('');
        newDetails.push('⚠️ Errors:');
        moduleError.split('\n').forEach(line => {
          newDetails.push(`   ${line}`);
        });
      }

      setDetails(newDetails);
      
      if (RunAnywhereLlamaCpp && RunAnywhereCore && RunAnywhereOnnx) {
        setStatus('success');
        setMessage('All native modules loaded successfully!');
      } else if (RunAnywhereLlamaCpp || RunAnywhereCore || RunAnywhereOnnx) {
        setStatus('success');
        setMessage('Some native modules loaded');
      } else {
        setStatus('error');
        setMessage('Native modules failed to load');
      }
    } catch (e: any) {
      setStatus('error');
      setMessage(`Error: ${e.message}`);
      setDetails([e.message]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.content}>
        <Text style={styles.title}>🧪 RunAnywhere AI Studio</Text>
        <Text style={styles.subtitle}>Native Module Test</Text>
        
        <View style={styles.statusCard}>
          {status === 'loading' ? (
            <ActivityIndicator size="large" color="#6366F1" />
          ) : (
            <Text style={[
              styles.statusText,
              status === 'success' ? styles.successText : styles.errorText
            ]}>
              {status === 'success' ? '✅' : '❌'} {message}
            </Text>
          )}
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Module Status:</Text>
          {details.map((detail, index) => (
            <Text key={index} style={styles.detailText}>{detail}</Text>
          ))}
        </View>

        <TouchableOpacity style={styles.button} onPress={checkNativeModules}>
          <Text style={styles.buttonText}>Refresh</Text>
        </TouchableOpacity>
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
    fontSize: 18,
    color: '#94A3B8',
    marginBottom: 24,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
  },
  successText: {
    color: '#22C55E',
  },
  errorText: {
    color: '#EF4444',
  },
  detailsCard: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 13,
    color: '#CBD5E1',
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
