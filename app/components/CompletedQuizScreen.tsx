import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import { CachedQuizResult } from '../storage/quizStorage';

const { width } = Dimensions.get('window');

interface CompletedQuizScreenProps {
  result: CachedQuizResult;
}

export default function CompletedQuizScreen({ result }: CompletedQuizScreenProps) {
  // Convert boolean array directly to emojis
  const emojis = result.answers.map(isCorrect => isCorrect ? '⚽️' : '❌').join('');
  const correctCount = result.answers.filter(isCorrect => isCorrect).length;

  const handleShare = async () => {
    try {
      const shareText = `Pundit - ${result.date}\n${emojis}\n${result.score} points (${correctCount}/${result.totalQuestions} correct)\n🔥 Streak: ${result.streak}\n\nPlay at: [app link]`;

      await Share.share({
        message: shareText,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.logoRow}>
          <Image
            source={require('../../assets/logo/white/pundit-white.png')}
            style={styles.logo}
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
            <Text style={styles.statusText}>We will retry syncing your result shortly.</Text>
          )}
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
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
  logoRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  logo: {
    width: width * 0.6,
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
});
