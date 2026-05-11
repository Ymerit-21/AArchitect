// App.js — Root entry point.
// Wraps the app in AuthProvider and switches between auth and app navigators
// depending on whether a user is signed in.

import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, SafeAreaView,
  ImageBackground, useWindowDimensions, Animated, Platform,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, KodeMono_700Bold } from '@expo-google-fonts/kode-mono';

import { AuthProvider, useAuth } from './context/AuthContext';
import { UserDataProvider, useUserData } from './context/UserDataContext';
import AnimatedButton from './components/AnimatedButton';
import InAppMessageToast from './components/InAppMessageToast';
import IncomingCallOverlay from './components/IncomingCallOverlay';
import RatingModal from './components/RatingModal';
import SignInScreen from './screens/SignInScreen';
import CreateAccountScreen from './screens/CreateAccountScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HomeScreen from './screens/HomeScreen';
import BecomeExpertScreen from './screens/BecomeExpertScreen';
import LogExpenseScreen from './screens/LogExpenseScreen';
import AddFundsScreen from './screens/AddFundsScreen';
import SendScreen from './screens/SendScreen';
import PinScreen from './screens/PinScreen';
import MessagesScreen from './screens/MessagesScreen';
import ConversationScreen from './screens/ConversationScreen';
import MarketplaceScreen from './screens/MarketplaceScreen';
import ExpertProfileScreen from './screens/ExpertProfileScreen';
import FinancialHubScreen from './screens/FinancialHubScreen';
import MilestonesScreen  from './screens/MilestonesScreen';
import BudgetScreen      from './screens/BudgetScreen';
import ProfileScreen     from './screens/ProfileScreen';
import HelpSupportScreen from './screens/HelpSupportScreen';
import JobsScreen             from './screens/JobsScreen';
import NotificationsScreen    from './screens/NotificationsScreen';
import AdminHomeScreen    from './screens/admin/AdminHomeScreen';
import AdminExpertsScreen from './screens/admin/AdminExpertsScreen';
import AdminUsersScreen   from './screens/admin/AdminUsersScreen';
import CallScreen         from './screens/CallScreen';
import HireScreen             from './screens/HireScreen';
import BookingDetailScreen    from './screens/BookingDetailScreen';
import MobileMoneyScreen      from './screens/MobileMoneyScreen';
import RatingScreen           from './screens/RatingScreen';

const AuthStack = createNativeStackNavigator();
const AppStack  = createNativeStackNavigator();

// Try to load the background image — falls back gracefully if missing.
const BG_IMAGE = (() => {
  try { return require('./assets/background.png'); } catch { return null; }
})();

// Reusable entrance animation: fades in and slides up from below.
function useEntrance(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 600, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 55, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  return { opacity, transform: [{ translateY }] };
}

// Landing screen — first screen in the auth flow.
function LandingScreen({ navigation }) {
  const { width, height } = useWindowDimensions();

  const isTablet  = width >= 768;
  const logoSize  = isTablet ? 56 : width < 380 ? 38 : 46;
  const btnHeight = isTablet ? 60 : 54;
  const btnPadH   = isTablet ? 100 : 36;

  const logoAnim = useEntrance(100);
  const subAnim  = useEntrance(280);
  const btn1Anim = useEntrance(420);
  const btn2Anim = useEntrance(540);

  // Block render until Kode Mono font is ready.
  const [fontsLoaded] = useFonts({ KodeMono_700Bold });
  if (!fontsLoaded) return <View style={styles.loadingBg} />;

  const content = (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.overlay} />

      <View style={styles.centre}>
        <Animated.Text style={[styles.logo, { fontSize: logoSize, fontFamily: 'KodeMono_700Bold' }, logoAnim]}>
          Architect
        </Animated.Text>
        <Animated.Text style={[styles.sub, subAnim]}>
          Hire.Manage.Budget
        </Animated.Text>
      </View>

      <SafeAreaView style={styles.bottom}>
        <Animated.View style={[btn1Anim, { marginHorizontal: btnPadH }]}>
          <AnimatedButton
            label="Create an account"
            style={[styles.btnDark, { height: btnHeight }]}
            textStyle={styles.btnDarkText}
            onPress={() => navigation.navigate('CreateAccount')}
          />
        </Animated.View>

        <View style={{ height: 12 }} />

        <Animated.View style={[btn2Anim, { marginHorizontal: btnPadH }]}>
          <AnimatedButton
            label="Sign in"
            style={[styles.btnDark, { height: btnHeight }]}
            textStyle={styles.btnDarkText}
            onPress={() => navigation.navigate('SignIn')}
          />
        </Animated.View>

        <View style={{ height: isTablet ? 32 : 24 }} />
      </SafeAreaView>
    </View>
  );

  return BG_IMAGE ? (
    <ImageBackground
      source={BG_IMAGE}
      style={[styles.fill, { width, height }]}
      imageStyle={{ width, height }}
      resizeMode="cover"
    >
      {content}
    </ImageBackground>
  ) : (
    <View style={[styles.fill, styles.fallbackBg]}>{content}</View>
  );
}

// Auth stack — shown when no user is signed in.
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <AuthStack.Screen name="Landing"         component={LandingScreen} />
      <AuthStack.Screen name="SignIn"          component={SignInScreen} />
      <AuthStack.Screen name="CreateAccount"   component={CreateAccountScreen} />
      <AuthStack.Screen name="ForgotPassword"  component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

const ADMIN_EMAIL = 'admin1234@test.com';

// App stack — shown when a user is signed in.
function AppNavigator() {
  const { user } = useAuth();
  const isAdmin   = user?.email?.toLowerCase() === ADMIN_EMAIL;

  return (
    <AppStack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      initialRouteName={isAdmin ? 'AdminHome' : 'Home'}
    >
      <AppStack.Screen name="Home"          component={HomeScreen} />
      <AppStack.Screen name="BecomeExpert"  component={BecomeExpertScreen} />
      <AppStack.Screen name="LogExpense"    component={LogExpenseScreen} />
      <AppStack.Screen name="AddFunds"      component={AddFundsScreen} />
      <AppStack.Screen name="Send"          component={SendScreen} />
      <AppStack.Screen name="Pin"           component={PinScreen} />
      <AppStack.Screen name="Messages"      component={MessagesScreen} />
      <AppStack.Screen name="Conversation"   component={ConversationScreen} />
      <AppStack.Screen name="Marketplace"    component={MarketplaceScreen} />
      <AppStack.Screen name="ExpertProfile"  component={ExpertProfileScreen} />
      <AppStack.Screen name="FinancialHub"  component={FinancialHubScreen} />
      <AppStack.Screen name="Milestones"    component={MilestonesScreen} />
      <AppStack.Screen name="Budget"        component={BudgetScreen} />
      <AppStack.Screen name="Profile"       component={ProfileScreen} />
      <AppStack.Screen name="HelpSupport"   component={HelpSupportScreen} />
      <AppStack.Screen name="Jobs"           component={JobsScreen} />
      <AppStack.Screen name="Notifications"  component={NotificationsScreen} />
      <AppStack.Screen name="AdminHome"     component={AdminHomeScreen} />
      <AppStack.Screen name="AdminExperts"  component={AdminExpertsScreen} />
      <AppStack.Screen name="AdminUsers"    component={AdminUsersScreen} />
      <AppStack.Screen name="Call"          component={CallScreen} />
      <AppStack.Screen name="Hire"           component={HireScreen} />
      <AppStack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <AppStack.Screen name="MobileMoney"    component={MobileMoneyScreen} />
      <AppStack.Screen name="Rating"         component={RatingScreen} />
    </AppStack.Navigator>
  );
}

// Inner content — switches between auth and app stacks.
function RootNavContent() {
  const { user } = useAuth();
  if (user === undefined) return <View style={styles.loadingBg} />;
  return user ? <AppNavigator /> : <AuthNavigator />;
}

// Auto-shows rating modal when the client has a pending review_request notification.
// Mounted at the App root so it appears over ANY screen.
function PendingReviewModal() {
  const { pendingReview } = useUserData();
  const [activeNotif, setActiveNotif] = useState(null);
  const shownIds  = useRef(new Set());
  const readyRef  = useRef(false);   // wait for nav to settle before popping modal

  // Short delay so navigation finishes mounting before the modal appears
  useEffect(() => {
    const t = setTimeout(() => { readyRef.current = true; }, 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!pendingReview) return;
    if (shownIds.current.has(pendingReview.id)) return;

    // If app just loaded, wait for the ready delay; otherwise show immediately
    const show = () => {
      shownIds.current.add(pendingReview.id);
      setActiveNotif({ ...pendingReview });
    };

    if (readyRef.current) {
      show();
    } else {
      const t = setTimeout(show, 900);
      return () => clearTimeout(t);
    }
  }, [pendingReview?.id]);

  return (
    <RatingModal
      visible={!!activeNotif}
      notif={activeNotif}
      onClose={() => setActiveNotif(null)}
    />
  );
}

export default function App() {
  const navRef = useRef(null);

  return (
    <SafeAreaProvider>
      <View style={[styles.appRoot, Platform.OS === 'web' && styles.appRootWeb]}>
        <AuthProvider>
          <UserDataProvider>
            <NavigationContainer ref={navRef}>
              <RootNavContent />
            </NavigationContainer>
            {/* Floating WhatsApp-style message toast */}
            <InAppMessageToast navRef={navRef} />
            {/* Incoming call sheet */}
            <IncomingCallOverlay navRef={navRef} />
            {/* Auto rating modal after job completion */}
            <PendingReviewModal />
          </UserDataProvider>
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appRoot:    { flex: 1, backgroundColor: '#111110' },
  appRootWeb: { height: '100vh' },
  fill:       { flex: 1 },
  fallbackBg: { backgroundColor: '#1a1a18' },
  loadingBg:  { flex: 1, backgroundColor: '#1a1a18' },

  root: {
    flex: 1,
    justifyContent: 'space-between',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,8,0.58)',
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  bottom: {
    justifyContent: 'flex-end',
  },
  btnDark: {
    backgroundColor: 'rgba(20,20,18,0.82)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  btnDarkText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
