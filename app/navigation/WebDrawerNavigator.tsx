import React, { useEffect, useRef } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
  useDrawerStatus,
} from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import GamesNavigator from './GamesNavigator';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import MeScreen from '../screens/MeScreen';
import ChallengeScreen from '../screens/ChallengeScreen';
import { theme } from '../theme/theme';
import { webContentWidth } from '../components/ResponsiveLayout';
import type { MainSectionParamList } from './MainNavigator';

const Drawer = createDrawerNavigator<MainSectionParamList>();
const whiteLogo = require('../../assets/logo/white/pundit-white.png');
const darkLogo = require('../../assets/logo/dark/pundit-black.png');

interface WebHeaderProps {
  title: string;
  onOpenMenu: () => void;
}

function WebHeader({ title, onOpenMenu }: WebHeaderProps) {
  const { width } = useWindowDimensions();
  const drawerStatus = useDrawerStatus();
  const menuRef = useRef<View>(null);
  const previousStatus = useRef(drawerStatus);

  useEffect(() => {
    if (previousStatus.current === 'open' && drawerStatus === 'closed') {
      const focusableRef = menuRef.current as unknown as { focus?: () => void };
      focusableRef?.focus?.();
    }
    previousStatus.current = drawerStatus;
  }, [drawerStatus]);

  const compact = width < 600;
  const headerGutter = width < 600 ? 16 : width < 900 ? 24 : 40;

  return (
    <View
      style={[
        styles.header,
        compact ? styles.headerCompact : styles.headerWide,
      ]}
    >
      <View style={[styles.headerInner, { paddingHorizontal: headerGutter }]}>
        <Image
          source={whiteLogo}
          style={[styles.headerLogo, compact && styles.headerLogoCompact]}
          resizeMode="contain"
        />
        <Text
          style={[styles.headerTitle, compact && styles.headerTitleCompact]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Pressable
          ref={menuRef}
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          accessibilityHint="Shows the main app sections"
          onPress={onOpenMenu}
          style={({ pressed }) => [
            styles.menuButton,
            pressed && styles.menuButtonPressed,
          ]}
        >
          <Ionicons name="menu" size={28} color={theme.colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

function WebDrawerContent(props: DrawerContentComponentProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        props.navigation.closeDrawer();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [props.navigation]);

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.drawerContent}
    >
      <View style={styles.drawerBrand}>
        <Image source={darkLogo} style={styles.drawerLogo} resizeMode="contain" />
        <Text style={styles.drawerEyebrow}>NAVIGATION</Text>
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

export default function WebDrawerNavigator() {
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(360, Math.round(width * 0.88));

  return (
    <Drawer.Navigator
      initialRouteName="Games"
      backBehavior="fullHistory"
      drawerContent={(props) => <WebDrawerContent {...props} />}
      screenOptions={({ navigation, route }) => ({
        lazy: true,
        drawerPosition: 'right',
        drawerType: 'front',
        swipeEnabled: false,
        overlayColor: 'rgba(47, 41, 38, 0.34)',
        drawerStyle: {
          width: drawerWidth,
          backgroundColor: theme.colors.background,
        },
        drawerActiveTintColor: theme.colors.primary,
        drawerActiveBackgroundColor: theme.colors.primaryLight,
        drawerInactiveTintColor: theme.colors.textDark,
        drawerLabelStyle: {
          marginLeft: -theme.spacing.sm,
          fontFamily: theme.fonts.gothamBold,
          fontSize: 15,
        },
        sceneStyle: {
          backgroundColor: theme.colors.background,
        },
        header: () => (
          <WebHeader
            title={route.name}
            onOpenMenu={() => navigation.openDrawer()}
          />
        ),
      })}
    >
      <Drawer.Screen
        name="Games"
        component={GamesNavigator}
        options={{
          title: 'Games',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="football-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="Challenge"
        component={ChallengeScreen}
        options={{
          title: 'Challenge',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="flash-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="League Tables"
        component={LeaderboardScreen}
        options={{
          title: 'League Tables',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="Me"
        component={MeScreen}
        options={{
          title: 'Me',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    backgroundColor: theme.colors.accent,
  },
  headerCompact: {
    height: 64,
  },
  headerWide: {
    height: 72,
  },
  headerInner: {
    flex: 1,
    width: '100%',
    maxWidth: webContentWidth.wide,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    width: 112,
    height: 38,
  },
  headerLogoCompact: {
    width: 88,
  },
  headerTitle: {
    position: 'absolute',
    left: 160,
    right: 160,
    fontFamily: theme.fonts.gothamBlack,
    fontSize: 18,
    color: theme.colors.white,
    textAlign: 'center',
  },
  headerTitleCompact: {
    left: 100,
    right: 100,
    fontSize: 13,
  },
  menuButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
  },
  menuButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  drawerContent: {
    flexGrow: 1,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.xl,
  },
  drawerBrand: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  drawerLogo: {
    width: 136,
    height: 48,
  },
  drawerEyebrow: {
    marginTop: theme.spacing.md,
    fontFamily: theme.fonts.gothamBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: theme.colors.neutralDark,
  },
});
