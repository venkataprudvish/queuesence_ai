import React from 'react';
import { TopBar } from '../navigation/TopBar';
import { BottomNav } from '../navigation/BottomNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5EC] text-[#252B26]">
      <TopBar />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-24 md:pb-12">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};
