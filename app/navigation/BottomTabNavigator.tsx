import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DailyQuizScreen from '../screens/DailyQuizScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import MeScreen from '../screens/MeScreen';
import ChallengeScreen from '../screens/ChallengeScreen';
import { theme } from '../theme/theme';
import { useIsDesktopWeb } from '../components/ResponsiveLayout';

const Tab = createBottomTabNavigator();
const logoImage = require('../../assets/logo/dark/pundit-black.png');

function DesktopTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.desktopTabBar}>
      <View style={styles.desktopTabBarInner}>
        <Image source={logoImage} style={styles.logo} resizeMode="contain" />

        <View style={styles.desktopNavItems}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label =
              typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : options.title ?? route.name;
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                style={({ pressed }) => [
                  styles.desktopNavItem,
                  isFocused && styles.desktopNavItemActive,
                  pressed && styles.desktopNavItemPressed,
                ]}
              >
                <Text
                  style={[
                    styles.desktopNavText,
                    isFocused && styles.desktopNavTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function BottomTabNavigator() {
  const isDesktopWeb = useIsDesktopWeb();

  return (
    <Tab.Navigator
      tabBar={isDesktopWeb ? (props) => <DesktopTabBar {...props} /> : undefined}
      screenOptions={{
        lazy: true,
        headerShown: !isDesktopWeb,
        headerStyle: {
          backgroundColor: theme.colors.accent,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontFamily: theme.fonts.gothamBlack,
          fontSize: 18,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.mediumGray,
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopColor: theme.colors.lightGray,
        },
        tabBarPosition: isDesktopWeb ? 'top' : 'bottom',
        tabBarLabelStyle: {
          fontFamily: theme.fonts.gothamMedium,
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name="Games"
        component={DailyQuizScreen}
        options={{
          title: 'Quiz',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="football-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Challenge"
        component={ChallengeScreen}
        options={{
          title: 'Challenge',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="League Tables"
        component={LeaderboardScreen}
        options={{
          title: 'League Tables',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Me"
        component={MeScreen}
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  desktopTabBar: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E7DFD2',
  },
  desktopTabBarInner: {
    width: '100%',
    maxWidth: 1120,
    minHeight: 72,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.xl,
  },
  logo: {
    width: 126,
    height: 42,
  },
  desktopNavItems: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  desktopNavItem: {
    minHeight: 42,
    minWidth: 84,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  desktopNavItemActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: '#CFE7D4',
  },
  desktopNavItemPressed: {
    opacity: 0.76,
  },
  desktopNavText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  desktopNavTextActive: {
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.primary,
  },
});
