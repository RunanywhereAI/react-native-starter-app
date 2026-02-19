import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppColors } from '../theme';

interface SyncProps {
  isSyncing: boolean;
  syncCount: number;
  totalImages: number;
  onStartSync: () => void;
}

export const SyncProgressCard: React.FC<SyncProps> = ({ isSyncing, syncCount, totalImages, onStartSync }) => {
  const percentage = totalImages > 0 ? (syncCount / totalImages) * 100 : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onStartSync} disabled={isSyncing}>
      <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{isSyncing ? "Syncing..." : "Start Smart Sync"}</Text>
            <Text style={styles.subtitle}>
              {isSyncing ? `${syncCount} of ${totalImages} indexed` : "Index all photos for AI search"}
            </Text>
          </View>
          <Text style={styles.icon}>{isSyncing ? "🧠" : "🔄"}</Text>
        </View>
        {isSyncing && (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${percentage}%` }]} />
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { marginVertical: 15, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  container: { padding: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  icon: { fontSize: 22 },
  track: { height: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 3, marginTop: 15, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: AppColors.accentCyan },
});