import { useState } from 'react';
import { View, Text } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, ShoppingBag, MessageCircle, FileText, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunity } from '../../src/context/CommunityContext';
import { Header } from '../../src/components/shared/Header';
import { MobileSidebar } from '../../src/components/shared/MobileSidebar';
import { NotificationCenter } from '../../src/components/shared/NotificationCenter';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../src/theme/colors';

const SPACE = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

const PILL_SIDE_INSET = 20;
const PILL_HEIGHT = 56;

function FloatingTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: PILL_SIDE_INSET,
        right: PILL_SIDE_INSET,
        bottom: insets.bottom + SPACE.md,
      }}
    >
      <View
        style={{
          height: PILL_HEIGHT,
          borderRadius: 999,
          backgroundColor: APP_SHELL_COLORS.chrome,
          overflow: 'hidden',
          shadowColor: THEME_COLORS.black,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.16,
          shadowRadius: 16,
          elevation: 10,
        }}
      >
        <BottomTabBar
          {...props}
          insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
          style={{
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            height: PILL_HEIGHT,
            elevation: 0,
            shadowOpacity: 0,
          }}
        />
      </View>
    </View>
  );
}

function ChatTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const { chatUnreadTotals } = useCommunity();
  const unread = chatUnreadTotals.totalMessages;

  return (
    <View>
      <MessageCircle size={24} color={color} />
      {unread > 0 && (
        <View className="absolute -top-1 -right-1 bg-green-500 rounded-full min-w-[16px] h-4 items-center justify-center px-1">
          <Text className="text-white text-[10px] font-bold">{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  // Derive active tab name from route segments
  const activeTab = (segments as string[])[1] ?? 'index';

  const handleNavigate = (tab: string) => {
    switch (tab) {
      case 'home':     router.replace('/(tabs)'); break;
      case 'market':   router.replace('/(tabs)/market'); break;
      case 'chat':     router.replace('/(tabs)/chat'); break;
      case 'posts':    router.replace('/(tabs)/posts'); break;
      case 'settings': router.replace('/(tabs)/settings'); break;
      case 'login':    router.replace('/landing'); break;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: APP_SHELL_COLORS.body }}>
      {/* Single shared header across all tabs */}
      <Header
        onToggleNotifications={() => setShowNotifications(v => !v)}
        onOpenSidebar={() => setShowSidebar(true)}
      />

      {/* Tab navigator fills remaining space */}
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: THEME_COLORS.primary,
          tabBarInactiveTintColor: THEME_COLORS.neutralTextSoft,
          sceneStyle: {
            backgroundColor: APP_SHELL_COLORS.body,
          },
          tabBarItemStyle: {
            marginHorizontal: 6,
            paddingHorizontal: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            marginBottom: 2,
          },
          tabBarIconStyle: {
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Home size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="posts"
          options={{
            title: 'Posts',
            tabBarIcon: ({ color }) => <FileText size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, focused }) => <ChatTabIcon color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="market"
          options={{
            title: 'Market',
            tabBarIcon: ({ color }) => <ShoppingBag size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
          }}
        />
      </Tabs>

      {/* Single shared overlay components — rendered once above all tabs */}
      <MobileSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        activeTab={activeTab}
        onNavigate={handleNavigate}
      />
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </View>
  );
}
