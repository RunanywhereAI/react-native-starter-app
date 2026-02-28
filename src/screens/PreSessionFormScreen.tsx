import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import { AppColors } from '../theme';
import { StrategicPreparationEngine, FormField } from '../ai/StrategicPreparationEngine';
import { getModeConfig } from '../ai/patternLibrary';
import { PreSessionInputs } from '../types/session';

type PreSessionFormRouteProp = RouteProp<RootStackParamList, 'PreSessionForm'>;
type PreSessionFormNavigationProp = StackNavigationProp<RootStackParamList, 'PreSessionForm'>;

interface Props {
  route: PreSessionFormRouteProp;
  navigation: PreSessionFormNavigationProp;
}

export const PreSessionFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { mode } = route.params;
  const modeConfig = getModeConfig(mode);
  
  const [fields, setFields] = useState<FormField[]>([]);
  const [formValues, setFormValues] = useState<PreSessionInputs>({});
  
  useEffect(() => {
    const generatedFields = StrategicPreparationEngine.getFormConfigForMode(mode);
    setFields(generatedFields);
    
    // Initialize empty form state
    const initialValues: PreSessionInputs = {};
    generatedFields.forEach(f => {
      initialValues[f.id] = '';
    });
    setFormValues(initialValues);
  }, [mode]);

  const handleInputChange = (id: string, text: string) => {
    setFormValues(prev => ({
      ...prev,
      [id]: text
    }));
  };

  const handleGenerateStrategy = () => {
    // Basic validation
    const missingRequired = fields.filter(f => f.required && !formValues[f.id].trim());
    
    if (missingRequired.length > 0) {
      Alert.alert(
        'Missing Information', 
        `Please fill out: ${missingRequired.map(f => f.label).join(', ')}`
      );
      return;
    }

    // Generate strict 10-point analysis based on input
    const analysis = StrategicPreparationEngine.generateStrategicAnalysis(mode, formValues);
    
    navigation.navigate('PreSessionStrategy', {
      mode,
      inputs: formValues,
      analysis,
    });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={['#0A0E1A', '#131A2A', '#1A233A']} style={styles.gradient}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.headerIcon}>{modeConfig.icon}</Text>
            </View>
            <Text style={styles.subtitle}>STRATEGIC PREPARATION</Text>
            <Text style={styles.title}>{modeConfig.displayName}</Text>
            <Text style={styles.description}>
              Fill out this briefing document to instantly generate your 10-point power positioning and tactical response strategy.
            </Text>
          </View>

          <View style={styles.formContainer}>
            {fields.map((field) => (
              <View key={field.id} style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{field.label}</Text>
                  {!field.required && <Text style={styles.optionalText}>(Optional)</Text>}
                </View>
                
                <TextInput
                  style={[
                    styles.input,
                    field.type === 'multiline' && styles.inputMultiline
                  ]}
                  value={formValues[field.id]}
                  onChangeText={(text) => handleInputChange(field.id, text)}
                  placeholder={field.placeholder}
                  placeholderTextColor="#4B5563"
                  multiline={field.type === 'multiline'}
                  numberOfLines={field.type === 'multiline' ? 3 : 1}
                  keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity 
            style={styles.generateButton}
            onPress={handleGenerateStrategy}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.generateGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.generateButtonText}>Generate Tactical Strategy ⚡</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.skipButton}
            onPress={() => navigation.replace('LiveSession', { mode })}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Skip Setup & Start Session 👉</Text>
          </TouchableOpacity>

        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  gradient: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60, paddingTop: 60 },
  
  header: { marginBottom: 32, alignItems: 'center' },
  iconContainer: { 
    width: 64, height: 64, borderRadius: 32, 
    backgroundColor: 'rgba(123, 97, 255, 0.15)', 
    justifyContent: 'center', alignItems: 'center', 
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(123, 97, 255, 0.3)' 
  },
  headerIcon: { fontSize: 32 },
  subtitle: { color: AppColors.accentPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', marginBottom: 12, textAlign: 'center' },
  description: { fontSize: 15, color: '#8B949E', textAlign: 'center', lineHeight: 22 },

  formContainer: { marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { color: '#E6EDF3', fontSize: 15, fontWeight: '600' },
  optionalText: { color: '#4B5563', fontSize: 13, marginLeft: 8 },
  
  input: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  generateButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
    elevation: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  generateGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  skipButtonText: {
    color: '#8B949E',
    fontSize: 16,
    fontWeight: '600',
  },
});
