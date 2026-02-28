import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppColors } from '../theme';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';

type DisclaimerScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Disclaimer'>;

interface DisclaimerScreenProps {
  navigation: DisclaimerScreenNavigationProp;
}

const DISCLAIMER_KEY = '@latent_disclaimer_accepted';

export const DisclaimerScreen: React.FC<DisclaimerScreenProps> = ({ navigation }) => {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkDisclaimer();
  }, []);

  const checkDisclaimer = async () => {
    try {
      const isAccepted = await AsyncStorage.getItem(DISCLAIMER_KEY);
      if (isAccepted === 'true') {
        navigation.replace('Home');
      } else {
        setChecking(false);
      }
    } catch (e) {
      setChecking(false);
    }
  };

  const handleAccept = async () => {
    try {
      await AsyncStorage.setItem(DISCLAIMER_KEY, 'true');
      navigation.replace('Home');
    } catch (e) {
      console.error('Failed to save disclaimer acceptance', e);
    }
  };

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⚠️</Text>
        </View>
        
        <Text style={styles.title}>Important Notice</Text>
        
        <View style={styles.card}>
          <Text style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text> This app records and analyzes conversations <Text style={styles.bold}>locally</Text> on this device.
          </Text>
          
          <Text style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text> You must comply with all local, state, and federal <Text style={styles.bold}>recording laws</Text> (e.g., two-party consent laws) in your jurisdiction.
          </Text>
          
          <Text style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text> Live mode is intended strictly for <Text style={styles.bold}>permitted environments</Text> such as authorized business negotiations, mock interviews, or startup pitches.
          </Text>
          
          <Text style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text> This software is <Text style={styles.bold}>not intended for covert or prohibited usage</Text>. You are solely responsible for how you apply this technology.
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.acceptButton} 
          onPress={handleAccept}
          activeOpacity={0.8}
        >
          <Text style={styles.acceptButtonText}>I Understand & Agree</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A', // Dark professional theme
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8B949E',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#30363D',
    marginBottom: 40,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#E6EDF3',
    lineHeight: 24,
    marginBottom: 20,
  },
  bullet: {
    color: AppColors.error,
    fontWeight: '900',
  },
  bold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  acceptButton: {
    backgroundColor: AppColors.accentViolet,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: AppColors.accentViolet,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
