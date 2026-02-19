/**
 * Mock implementation of react-native-screens for iOS with New Architecture
 * 
 * This replaces all native screen components with regular React Native Views
 * to avoid crashes with react-native-screens on RN 0.83's mandatory New Architecture.
 */
import React from 'react';
import { View, Animated } from 'react-native';

// Simple View wrapper that accepts all props
const ScreenView = React.forwardRef((props, ref) => {
  const { children, style, enabled, activityState, ...rest } = props;
  return (
    <View ref={ref} style={[{ flex: 1 }, style]} {...rest}>
      {children}
    </View>
  );
});
ScreenView.displayName = 'Screen';

const AnimatedScreenView = Animated.createAnimatedComponent(ScreenView);

// Screen components
export const Screen = ScreenView;
export const ScreenContainer = ScreenView;
export const ScreenStack = ScreenView;
export const NativeScreen = ScreenView;
export const NativeScreenContainer = ScreenView;
export const NativeScreenNavigationContainer = ScreenView;
export const ScreenStackHeaderConfig = () => null;
export const ScreenStackHeaderSubview = View;
export const ScreenStackHeaderBackButtonImage = () => null;
export const ScreenStackHeaderCenterView = View;
export const ScreenStackHeaderLeftView = View;
export const ScreenStackHeaderRightView = View;
export const ScreenStackHeaderSearchBarView = View;
export const SearchBar = () => null;
export const FullWindowOverlay = ScreenView;
export const ScreenContext = React.createContext(null);

// Functions
export const enableScreens = (val) => {};
export const enableFreeze = (val) => {};
export const screensEnabled = () => false;
export const shouldUseActivityState = false;

// Transition progress hook
export const useTransitionProgress = () => ({
  progress: { value: 1 },
  closing: { value: 0 },
  goingForward: { value: 1 },
});

// Freeze component
export const Freeze = ({ freeze, children }) => <>{children}</>;

// For native-stack compatibility
export const NativeScreensModule = null;
export const NativeScreenContainerComponent = ScreenView;
export const NativeScreenComponent = ScreenView;

// GH Pages
export const GHContext = React.createContext(null);
export const useGHContext = () => null;

// Reanimated compatibility
export const InnerScreen = ScreenView;
export const ScreensNativeModules = {};

// Default export with everything
const RNScreens = {
  Screen,
  ScreenContainer,
  ScreenStack,
  NativeScreen,
  NativeScreenContainer,
  NativeScreenNavigationContainer,
  ScreenStackHeaderConfig,
  ScreenStackHeaderSubview,
  ScreenStackHeaderBackButtonImage,
  ScreenStackHeaderCenterView,
  ScreenStackHeaderLeftView,
  ScreenStackHeaderRightView,
  ScreenStackHeaderSearchBarView,
  SearchBar,
  FullWindowOverlay,
  ScreenContext,
  enableScreens,
  enableFreeze,
  screensEnabled,
  shouldUseActivityState,
  useTransitionProgress,
  Freeze,
  NativeScreensModule,
  NativeScreenContainerComponent,
  NativeScreenComponent,
  GHContext,
  useGHContext,
  InnerScreen,
  ScreensNativeModules,
};

export default RNScreens;
