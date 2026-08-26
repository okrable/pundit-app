import React from 'react';
import {
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import { CachedQuizResult } from '../storage/quizStorage';
import CenteredWebContent, { webContentWidth } from './ResponsiveLayout';
import { formatDailyQuizShare } from '../../shared/dailyQuiz';
import { trackAnalyticsEvent } from '../services/analytics';
import { useAuthStore } from '../state/useAuthStore';

interface CompletedQuizScreenProps {
  result: CachedQuizResult;
  onReturnToGames?: () => void;
}

export default function CompletedQuizScreen({
  result,
  onReturnToGames,
}: CompletedQuizScreenProps) {
  const { width } = useWindowDimensions();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Convert boolean array directly to emojis
  const emojis = result.answers.map(isCorrect => isCorrect ? '⚽️' : '❌').join('');

  const handleShare = async () => {
    try {
      const shareText = formatDailyQuizShare({
        date: result.date,
        score: result.score,
        answers: result.answers,
      });

      await Share.share({
        message: shareText,
      });
      trackAnalyticsEvent(
        'quiz_shared',
        isAuthenticated ? 'authenticated' : 'guest',
        {
          quizDate: result.date,
          score: result.score,
          totalQuestions: result.totalQuestions,
        }
      );
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <CenteredWebContent maxWidth={webContentWidth.quiz} style={styles.content}>
          <View style={styles.logoRow}>
            <Image
              source={require('../../assets/logo/white/pundit-white.png')}
              style={[styles.logo, { width: Math.min(width * 0.6, 300) }]}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.subtitle}>Well played in today's game!</Text>

          <View style={styles.scoreBlock}>
            <Text style={styles.scoreText}>{result.score} POINTS</Text>
            <Text style={styles.emojiText}>{emojis}</Text>
            {result.syncState === 'pending' && (
              <Text style={styles.statusText}>Stats still syncing in the background.</Text>
            )}
            {result.syncState === 'failed' && (
              <Text style={styles.statusText}>
                Your result is saved on this device. We’ll retry when the app next syncs.
              </Text>
            )}
          </View>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
          {onReturnToGames ? (
            <TouchableOpacity style={styles.gamesButton} onPress={onReturnToGames}>
              <Text style={styles.gamesButtonText}>Back to Games</Text>
            </TouchableOpacity>
          ) : null}
          </CenteredWebContent>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.accent,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },
  logoRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  logo: {
    height: 74,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  scoreBlock: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  scoreText: {
    fontSize: 22,
    fontFamily: theme.fonts.uniSansHeavy,
    color: theme.colors.textDark,
    letterSpacing: 1.5,
    marginBottom: theme.spacing.sm,
  },
  emojiText: {
    fontSize: 26,
    letterSpacing: 6,
    textAlign: 'center',
  },
  statusText: {
    marginTop: theme.spacing.sm,
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
    textAlign: 'center',
  },
  correctText: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
    marginTop: theme.spacing.xs,
  },
  shareButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1e5b3d',
  },
  shareButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.white,
  },
  gamesButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    alignSelf: 'center',
    backgroundColor: theme.colors.background,
  },
  gamesButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
});
