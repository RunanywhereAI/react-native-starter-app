import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppColors } from '../theme';

interface SyncProps {
  isSyncing: boolean;
  isPaused: boolean;
  isDeepSync: boolean;
  syncCount: number;
  totalImages?: number;
  onQuickSync: () => void;
  onDeepSync: () => void;
  onPauseSync: () => void;
  onResumeSync: () => void;
}

export const SyncProgressCard: React.FC<SyncProps> = ({
  isSyncing,
  isPaused,
  isDeepSync,
  syncCount,
  totalImages = 0,
  onQuickSync,
  onDeepSync,
  onPauseSync,
  onResumeSync,
}) => {
  const getTitle = () => {
    if (isPaused) return '⏸ Deep Sync Paused';
    if (isSyncing && isDeepSync) return '🔎 Deep Scanning...';
    if (isSyncing) return '⚡ Quick Sync...';
    if (syncCount > 0) return `✅ ${syncCount} photos indexed`;
    return '📸 Sync Gallery';
  };

  const getSubtitle = () => {
    if (isPaused) return `Saved at ${syncCount} — tap Resume to continue`;
    if (isSyncing && totalImages > 0) return `Indexed ${syncCount} of ${totalImages} photos`;
    if (isSyncing) return `Indexed ${syncCount} photos so far`;
    if (syncCount > 0) return 'Quick sync done. Run Deep Sync for full library.';
    return 'Quick = first 300 • Deep = entire gallery';
  };

  // Compute fill percentage
  const getProgress = (): number => {
    if (!isSyncing && !isPaused) return syncCount > 0 ? 1 : 0;
    if (totalImages > 0) return Math.min(syncCount / totalImages, 1);
    // Indeterminate: pulse between 30-70%
    return 0.5;
  };

  const progress = getProgress();
  const isIndeterminate = (isSyncing || isPaused) && totalImages === 0;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={
          isPaused
            ? ['rgba(255,165,0,0.15)', 'rgba(255,165,0,0.05)']
            : isDeepSync && isSyncing
              ? ['rgba(138,43,226,0.15)', 'rgba(138,43,226,0.05)']
              : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']
        }
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{getTitle()}</Text>
            <Text style={styles.subtitle}>{getSubtitle()}</Text>
          </View>
        </View>

        {/* Progress bar */}
        {(isSyncing || isPaused) && (
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: isIndeterminate ? '50%' : `${Math.round(progress * 100)}%`,
                  backgroundColor: isPaused
                    ? '#FFA500'
                    : isDeepSync
                      ? AppColors.accentViolet
                      : AppColors.accentCyan,
                },
              ]}
            />
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {isSyncing ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnWarn]}
              onPress={onPauseSync}
              accessibilityLabel="Pause sync"
              accessibilityRole="button"
            >
              <Text style={styles.btnText}>⏸ Pause</Text>
            </TouchableOpacity>
          ) : isPaused ? (
            <>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={onResumeSync}
                accessibilityLabel="Resume deep sync"
                accessibilityRole="button"
              >
                <Text style={styles.btnText}>▶ Resume Deep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={onQuickSync}
                accessibilityLabel="Quick sync"
                accessibilityRole="button"
              >
                <Text style={styles.btnText}>⚡ Quick</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={onQuickSync}
                accessibilityLabel="Quick sync 300 recent photos"
                accessibilityRole="button"
              >
                <Text style={styles.btnText}>⚡ Quick (300)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnDeep]}
                onPress={onDeepSync}
                accessibilityLabel="Deep sync entire gallery"
                accessibilityRole="button"
              >
                <Text style={styles.btnText}>🔎 Deep Sync</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  container: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 3 },
  track: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: AppColors.accentCyan + 'CC' },
  btnDeep: { backgroundColor: AppColors.accentViolet + 'CC' },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.15)' },
  btnWarn: { backgroundColor: '#FFA500CC', flex: 1 },
  btnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});