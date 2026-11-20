import React from 'react';
import { MainTab } from '../types';
import { useAppStore } from '../hooks/useAppStore';

const NAV_ITEMS: { id: MainTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'history', label: 'History' },
  { id: 'profile', label: 'Profile' },
];

export const TopBar: React.FC = () => {
  const { activeTab, setActiveTab, navigateToMonitor } = useAppStore();

  return (
    <header className="sticky top-0 z-30 bg-[#F7F5EC]/95 backdrop-blur-sm border-b border-[#E1E6DA] pt-safe">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 h-14">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="text-lg font-bold tracking-tight text-[#244C3A] font-display whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#244C3A] rounded-lg py-1"
        >
          QueueSense
        </button>

        {/* Zone 2: 5 concise single-line text navigation links (Tablet/Desktop) */}
        <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-6 text-sm font-medium">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  isActive
                    ? 'text-[#244C3A] border-[#244C3A] font-semibold'
                    : 'text-[#777D75] border-transparent hover:text-[#252B26]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => navigateToMonitor('live')}
            className="min-h-[38px] px-4 py-1.5 text-xs font-semibold text-[#F7F5EC] bg-[#244C3A] rounded-xl hover:bg-[#1C3D2E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Live Monitor
          </button>
        </div>
      </div>
    </header>
  );
};
