import { useState } from 'react';
import { View, Text } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Home, ShoppingBag, MessageCircle, FileText, Settings } from 'lucide-react-native';
import { useCommunity } from '../../src/context/CommunityContext';
import { Header } from '../../src/components/shared/Header';
import { MobileSidebar } from '../../src/components/shared/MobileSidebar';
import { NotificationCenter } from '../../src/components/shared/NotificationCenter';

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
    <View style={{ flex: 1 }}>
      {/* Single shared header across all tabs */}
      <Header
        onToggleNotifications={() => setShowNotifications(v => !v)}
        onOpenSidebar={() => setShowSidebar(true)}
      />

      {/* Tab navigator fills remaining space */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#0d3d47',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopColor: '#e5e7eb',
            height: 60,
            paddingBottom: 8,
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
