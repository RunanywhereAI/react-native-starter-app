import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Animated } from 'react-native';
import { TranscriptChunk } from '../types/session';
import { AppColors } from '../theme';

interface LiveTranscriptProps {
  transcript: TranscriptChunk[];
  highlightPatterns?: boolean;
}

export const LiveTranscript: React.FC<LiveTranscriptProps> = ({ transcript, highlightPatterns = true }) => {
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (transcript.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [transcript.length, fadeAnim]);

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const renderItem = ({ item, index }: { item: TranscriptChunk; index: number }) => (
    <Animated.View style={[styles.item, item.hasPattern && highlightPatterns && styles.itemHighlighted, { opacity: index === transcript.length - 1 ? fadeAnim : 1 }]}>
      <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
      <Text style={styles.text}>{item.text}</Text>
      {item.hasPattern && highlightPatterns && (
        <View style={styles.patternBadge}><Text style={styles.patternBadgeText}>Pattern Detected</Text></View>
      )}
    </Animated.View>
  );

  if (transcript.length === 0) return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}><Text style={styles.emptyIcon}>🎤</Text></View>
      <Text style={styles.emptyText}>Start speaking...</Text>
      <Text style={styles.emptySubtext}>Your transcript will appear here</Text>
    </View>
  );

  return (
    <FlatList ref={flatListRef} data={transcript} renderItem={renderItem} keyExtractor={(i) => i.id}
      style={styles.list} contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator indicatorStyle="default"
      onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })} />
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  contentContainer: { padding: 16 },
  item: { marginBottom: 12, padding: 14, backgroundColor: '#FFFFFF', borderRadius: 16, borderLeftWidth: 3, borderLeftColor: '#DDD6FE', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3 },
  itemHighlighted: { backgroundColor: '#F5F0FF', borderLeftColor: '#7B61FF', borderLeftWidth: 4 },
  timestamp: { fontSize: 11, color: AppColors.textMuted, marginBottom: 6, fontWeight: '500' },
  text: { fontSize: 15, color: AppColors.textPrimary, lineHeight: 22 },
  patternBadge: { marginTop: 8, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#EDE9FE', borderRadius: 8, alignSelf: 'flex-start' },
  patternBadgeText: { fontSize: 11, color: '#7B61FF', fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 28, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 18, fontWeight: '600', color: AppColors.textPrimary, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: AppColors.textSecondary, textAlign: 'center' },
});
