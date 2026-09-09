import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchApi } from '../services/api';
import { theme } from '../theme/theme';
import { normalizeCareerAnswer } from '../../shared/careerAnswer';
import type { PlayerSuggestion } from '../../shared/playerSearch';
import { trackAnalyticsEvent } from '../services/analytics';

export default function PlayerNameSuggestions({
  value,
  onSelect,
  actorType,
  identityKey,
}: {
  value: string;
  onSelect: (name: string) => void;
  actorType: 'guest' | 'authenticated';
  identityKey: string | null;
}) {
  const [players, setPlayers] = useState<PlayerSuggestion[]>([]);
  const [message, setMessage] = useState('');
  const failures = useRef(false);
  const selected = useRef<string | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    const seq = ++sequence.current;
    setPlayers([]);
    setMessage('');
    if (normalizeCareerAnswer(value).length < 2 || value === selected.current)
      return;
    const timer = setTimeout(() => {
      setMessage('Finding players…');
      void fetchApi<{ players: PlayerSuggestion[] }>(
        '/searchPlayers',
        { method: 'POST', body: JSON.stringify({ query: value }) },
        { timeoutMs: 5000 },
      )
        .then((response) => {
          if (sequence.current === seq) {
            setPlayers(response.players);
            setMessage(
              response.players.length
                ? ''
                : 'No suggestions. You can still submit your guess.',
            );
          }
        })
        .catch(() => {
          if (sequence.current !== seq) return;
          setMessage('Suggestions unavailable. You can still type your guess.');
          if (!failures.current) {
            failures.current = true;
            trackAnalyticsEvent('journey_autocomplete_failed', actorType);
          }
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      sequence.current++;
    };
  }, [value, identityKey, actorType]);
  return (
    <View>
      {players.map((player) => (
        <Pressable
          key={player.id}
          accessibilityRole="button"
          accessibilityLabel={`${player.name}${player.birthYear ? `, born ${player.birthYear}` : ''}${player.position ? `, ${player.position}` : ''}`}
          style={styles.option}
          onPress={() => {
            selected.current = player.name;
            setPlayers([]);
            setMessage('');
            onSelect(player.name);
          }}
        >
          <Text style={styles.name}>{player.name}</Text>
          {player.birthYear || player.position ? (
            <Text style={styles.detail}>
              {[player.birthYear, player.position].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </Pressable>
      ))}
      {message ? (
        <Text style={styles.detail} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  option: {
    padding: 12,
    minHeight: 48,
    borderBottomWidth: 1,
    borderColor: theme.colors.lightGray,
    backgroundColor: theme.colors.white,
  },
  name: {
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    fontSize: 15,
  },
  detail: {
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 4,
  },
});
