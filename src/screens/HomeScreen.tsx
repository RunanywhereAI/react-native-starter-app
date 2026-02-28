import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppColors } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { useSessionAnalyzer } from '../hooks/useSessionAnalyzer';
import { SessionSummaryCard } from '../components/SessionSummaryCard';
import { getAllModes } from '../ai/patternLibrary';
import { NegotiationMode, ModeConfig } from '../types/session';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type HomeScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Home'>;
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { sessions, stats, isLoading, refreshSessions } = useSessionAnalyzer();
  const [showModeSelector, setShowModeSelector] = useState(false);
  const allModes = getAllModes();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshSessions();
    });
    return unsubscribe;
  }, [navigation, refreshSessions]);

  const handleStartSession = (mode: NegotiationMode) => {
    setShowModeSelector(false);
    navigation.navigate('PreSessionForm', { mode });
  };

  const handleSessionPress = (sessionId: string) => {
    navigation.navigate('Insights', { sessionId });
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    return `${minutes}min`;
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.primaryLight} />

      <LinearGradient
        colors={['#F5F0FF', '#EDE5FF', '#E8DFFF']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshSessions}
              tintColor={AppColors.accentPrimary}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <LinearGradient
                colors={['#7B61FF', '#9B82FF']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>L</Text>
              </LinearGradient>
              <View style={styles.headerTextContainer}>
                <Text style={styles.greeting}>{getGreeting()},</Text>
                <Text style={styles.userName}>Latent Strategist</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.notificationIcon}>🔔</Text>
            </TouchableOpacity>
          </View>

          {/* Balance Card */}
          <LinearGradient
            colors={['#7B61FF', '#9B82FF', '#B19CFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>TOTAL SESSIONS</Text>
            <Text style={styles.balanceAmount}>
              {stats ? stats.totalSessions : 0}
            </Text>
            {stats && stats.totalSessions > 0 && (
              <View style={styles.balanceBadge}>
                <Text style={styles.balanceBadgeText}>
                  📈 {Math.round(stats.avgFocusScore)}% avg focus
                </Text>
              </View>
            )}
            {!stats || stats.totalSessions === 0 ? (
              <View style={styles.balanceBadge}>
                <Text style={styles.balanceBadgeText}>✨ Ready to start</Text>
              </View>
            ) : null}
          </LinearGradient>

          {/* Action Buttons */}
          <View style={styles.actionColumn}>
            {/* Live Tactical Mode */}
            <TouchableOpacity
              style={styles.actionItemLarge}
              onPress={() => setShowModeSelector(true)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#7B61FF', '#9B82FF']}
                style={styles.actionCircleLarge}
              >
                <Text style={styles.actionIconLarge}>🎤</Text>
              </LinearGradient>
              <View style={styles.actionTextContent}>
                <Text style={styles.actionLabelLarge}>Live Tactical Mode</Text>
                <Text style={styles.actionSubLabelLarge}>Real-time negotiation intelligence</Text>
              </View>
            </TouchableOpacity>

            {/* Strategic Outcome Replay */}
            <TouchableOpacity
              style={styles.actionItemLarge}
              onPress={() => {
                if (sessions.length > 0) {
                  navigation.navigate('OutcomeReplay', { sessionId: sessions[0].id });
                } else {
                  Alert.alert('No Sessions', 'Complete a session first to view replays.');
                }
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10B981', '#34D399']}
                style={styles.actionCircleLarge}
              >
                <Text style={styles.actionIconLarge}>🧠</Text>
              </LinearGradient>
              <View style={styles.actionTextContent}>
                <Text style={styles.actionLabelLarge}>Strategic Outcome Replay™</Text>
                <Text style={styles.actionSubLabelLarge}>Counterfactual behavior modeling</Text>
              </View>
            </TouchableOpacity>

            {/* Practice Simulation */}
            <TouchableOpacity
              style={styles.actionItemLarge}
              onPress={() => Alert.alert('Coming Soon', 'Practice Simulation Engine is under construction.')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#F59E0B', '#FBBF24']}
                style={styles.actionCircleLarge}
              >
                <Text style={styles.actionIconLarge}>⚔️</Text>
              </LinearGradient>
              <View style={styles.actionTextContent}>
                <Text style={styles.actionLabelLarge}>Practice Simulation</Text>
                <Text style={styles.actionSubLabelLarge}>Mock scenarios against AI</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Recent Sessions */}
          <View style={styles.sessionsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Sessions</Text>
              {sessions.length > 0 && (
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              )}
            </View>

            {sessions.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Text style={styles.emptyIcon}>📊</Text>
                </View>
                <Text style={styles.emptyText}>No sessions yet</Text>
                <Text style={styles.emptySubtext}>
                  Start your first session to see insights here
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => setShowModeSelector(true)}
                >
                  <LinearGradient
                    colors={['#7B61FF', '#9B82FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.emptyButtonGradient}
                  >
                    <Text style={styles.emptyButtonText}>Start Session</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              sessions.map((session) => (
                <SessionSummaryCard
                  key={session.id}
                  session={session}
                  onPress={() => handleSessionPress(session.id)}
                />
              ))
            )}
          </View>

          {/* Quick Stats */}
          {stats && stats.totalSessions > 0 && (
            <View style={styles.quickStatsSection}>
              <Text style={styles.sectionTitle}>Quick Stats</Text>
              <View style={styles.quickStatsGrid}>
                <View style={styles.quickStatCard}>
                  <View style={[styles.quickStatIcon, { backgroundColor: '#EDE9FE' }]}>
                    <Text style={styles.quickStatEmoji}>🎯</Text>
                  </View>
                  <Text style={styles.quickStatValue}>
                    {Math.round(stats.avgFocusScore)}%
                  </Text>
                  <Text style={styles.quickStatLabel}>Avg Focus</Text>
                </View>
                <View style={styles.quickStatCard}>
                  <View style={[styles.quickStatIcon, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={styles.quickStatEmoji}>📈</Text>
                  </View>
                  <Text style={styles.quickStatValue}>
                    {stats.totalPatterns}
                  </Text>
                  <Text style={styles.quickStatLabel}>Patterns</Text>
                </View>
                <View style={styles.quickStatCard}>
                  <View style={[styles.quickStatIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={styles.quickStatEmoji}>⏱️</Text>
                  </View>
                  <Text style={styles.quickStatValue}>
                    {formatDuration(stats.avgDuration)}
                  </Text>
                  <Text style={styles.quickStatLabel}>Avg Duration</Text>
                </View>
                <View style={styles.quickStatCard}>
                  <View style={[styles.quickStatIcon, { backgroundColor: '#FCE7F3' }]}>
                    <Text style={styles.quickStatEmoji}>🔒</Text>
                  </View>
                  <Text style={styles.quickStatValue}>100%</Text>
                  <Text style={styles.quickStatLabel}>Private</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowModeSelector(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#7B61FF', '#6C4DE6']}
            style={styles.fabGradient}
          >
            <Text style={styles.fabIcon}>🎤</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Bottom Navigation Bar */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem}>
            <Text style={styles.navIconActive}>🏠</Text>
            <Text style={styles.navLabelActive}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => {
              if (sessions.length > 0) {
                handleSessionPress(sessions[0].id);
              }
            }}
          >
            <Text style={styles.navIcon}>📊</Text>
            <Text style={styles.navLabel}>Insights</Text>
          </TouchableOpacity>
          <View style={styles.navItemSpacer} />
          <TouchableOpacity style={styles.navItem}>
            <Text style={styles.navIcon}>📁</Text>
            <Text style={styles.navLabel}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.navIcon}>👤</Text>
            <Text style={styles.navLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Mode Selector Modal */}
      <Modal
        visible={showModeSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModeSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Live Mode Category</Text>
            <Text style={styles.modalSubtitle}>Live mode is recommended for permitted business and negotiation environments. Avoid usage where recording is restricted.</Text>

            <ScrollView style={styles.modesScroll}>
              {allModes.map((modeConfig: ModeConfig) => (
                <TouchableOpacity
                  key={modeConfig.mode}
                  style={styles.modeCard}
                  onPress={() => handleStartSession(modeConfig.mode)}
                  activeOpacity={0.7}
                >
                  <View style={styles.modeIconCircle}>
                    <Text style={styles.modeIcon}>{modeConfig.icon}</Text>
                  </View>
                  <View style={styles.modeInfo}>
                    <Text style={styles.modeTitle}>{modeConfig.displayName}</Text>
                    <Text style={styles.modeDescription}>{modeConfig.description}</Text>
                  </View>
                  <Text style={styles.modeArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowModeSelector(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.primaryLight,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 14,
    color: '#6B6B80',
    fontWeight: '400',
    marginBottom: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#1E1E2C',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(123, 97, 255, 0.08)',
  },
  notificationIcon: {
    fontSize: 20,
  },

  // Balance Card
  balanceCard: {
    borderRadius: 24,
    padding: 28,
    marginBottom: 28,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 2,
    marginBottom: 12,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 14,
  },
  balanceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  balanceBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  actionColumn: {
    flexDirection: 'column',
    gap: 16,
    marginBottom: 36,
  },
  actionItemLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  actionCircleLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  actionIconLarge: {
    fontSize: 28,
  },
  actionTextContent: {
    flex: 1,
  },
  actionLabelLarge: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  actionSubLabelLarge: {
    fontSize: 14,
    color: '#8B949E',
  },

  // Section
  sessionsSection: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    color: AppColors.accentPrimary,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 36,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Quick Stats
  quickStatsSection: {
    marginBottom: 20,
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  quickStatCard: {
    width: (SCREEN_WIDTH - 60) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  quickStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickStatEmoji: {
    fontSize: 22,
  },
  quickStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    color: AppColors.textSecondary,
    fontWeight: '500',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 72,
    alignSelf: 'center',
    zIndex: 10,
    elevation: 12,
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIcon: {
    fontSize: 26,
  },

  // Bottom Nav
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
    justifyContent: 'space-around',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 6,
  },
  navItemSpacer: {
    width: 60,
  },
  navIcon: {
    fontSize: 22,
    marginBottom: 4,
    opacity: 0.4,
  },
  navIconActive: {
    fontSize: 22,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 10,
    color: AppColors.textMuted,
    fontWeight: '500',
  },
  navLabelActive: {
    fontSize: 10,
    color: AppColors.accentPrimary,
    fontWeight: '700',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginBottom: 24,
  },
  modesScroll: {
    maxHeight: 400,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F5FF',
    padding: 16,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(123, 97, 255, 0.08)',
  },
  modeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modeIcon: {
    fontSize: 22,
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textPrimary,
    marginBottom: 3,
  },
  modeDescription: {
    fontSize: 13,
    color: AppColors.textSecondary,
    lineHeight: 17,
  },
  modeArrow: {
    fontSize: 22,
    color: AppColors.textMuted,
    marginLeft: 8,
  },
  cancelButton: {
    marginTop: 14,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
});
