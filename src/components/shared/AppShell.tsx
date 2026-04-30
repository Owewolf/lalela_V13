import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { Header } from './Header';
import { MobileSidebar } from './MobileSidebar';
import { NotificationCenter } from './NotificationCenter';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: string;
}

export const AppShell: React.FC<AppShellProps> = ({ children, activeTab }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const router = useRouter();

  const handleNavigate = (tab: string) => {
    switch (tab) {
      case 'home':    router.replace('/(tabs)'); break;
      case 'market':  router.replace('/(tabs)/market'); break;
      case 'chat':    router.replace('/(tabs)/chat'); break;
      case 'posts':   router.replace('/(tabs)/posts'); break;
      case 'settings':router.replace('/(tabs)/settings'); break;
    }
  };

  const handleOpenAdmin = (communityId: string, role: string) => {
    router.push('/admin');
  };

  const handleOpenSettings = () => {
    router.push('/(tabs)/settings');
  };

  return (
    <View style={{ flex: 1 }}>
      <Header
        onToggleNotifications={() => setShowNotifications(v => !v)}
        onOpenSidebar={() => setShowSidebar(true)}
      />

      <View style={{ flex: 1 }}>
        {children}
      </View>

      <MobileSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        activeTab={activeTab}
        onNavigate={handleNavigate}
        onOpenAdmin={handleOpenAdmin}
        onOpenSettings={handleOpenSettings}
      />

      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </View>
  );
};
