/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppStoreProvider, useAppStore } from './hooks/useAppStore';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AppLayout } from './layouts/AppLayout';
import { SplashScreen } from './screens/SplashScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MonitorContainerScreen } from './screens/MonitorContainerScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ProfileSettingsScreen } from './screens/ProfileSettingsScreen';

const QueueSenseRouter: React.FC = () => {
  const { flowState, activeTab } = useAppStore();

  if (flowState === 'splash') {
    return <SplashScreen />;
  }

  if (flowState === 'onboarding') {
    return <OnboardingScreen />;
  }

  if (flowState === 'auth') {
    return <AuthScreen />;
  }

  return (
    <AppLayout>
      {activeTab === 'home' && <HomeScreen />}
      {activeTab === 'monitor' && <MonitorContainerScreen />}
      {activeTab === 'analytics' && <AnalyticsScreen />}
      {activeTab === 'history' && <HistoryScreen />}
      {activeTab === 'profile' && <ProfileSettingsScreen />}
    </AppLayout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppStoreProvider>
        <QueueSenseRouter />
      </AppStoreProvider>
    </ErrorBoundary>
  );
}
