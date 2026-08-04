import BottomTabNavigator from './BottomTabNavigator';

// Metro resolves IOSNativeTabNavigator.ios.tsx in supported iOS builds. This
// fallback deliberately avoids importing React Navigation's unstable native
// tabs entrypoint, which throws as soon as it is evaluated on web.
export default BottomTabNavigator;
