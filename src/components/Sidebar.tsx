import React from 'react';
import {
  AlertOctagon,
  BarChart3,
  Bot,
  FileText,
  LogOut,
  Map,
  Route,
  Shield,
  ShieldAlert,
  User,
  Users,
  X,
} from 'lucide-react';
import { UserProfile } from '../types/safety';

export type NavTab =
  | 'status'
  | 'report'
  | 'route'
  | 'assistant'
  | 'reports'
  | 'contacts'
  | 'statistics'
  | 'security'
  | 'profile';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: UserProfile;
  openCount: number;
  onSignOut: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  user,
  openCount,
  onSignOut,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navGroups: {
    heading: string;
    items: { id: NavTab; label: string; icon: typeof Map; badge?: number }[];
  }[] = [
    {
      heading: 'Safety & Transit',
      items: [
        { id: 'status', label: 'Safety Status', icon: Map },
        { id: 'report', label: 'Emergency SOS', icon: AlertOctagon },
        { id: 'route', label: 'Safe Route Planner', icon: Route },
        { id: 'assistant', label: 'Safety AI Advisor', icon: Bot },
      ],
    },
    {
      heading: 'Records & Network',
      items: [
        { id: 'reports', label: 'My Reports', icon: FileText },
        { id: 'contacts', label: 'Emergency Contacts', icon: Users },
        { id: 'statistics', label: 'History & Statistics', icon: BarChart3 },
      ],
    },
    {
      heading: user.role === 'admin' ? 'Command & Account' : 'Account',
      items: [
        ...(user.role === 'admin'
          ? [{ id: 'security' as NavTab, label: 'Security Dashboard', icon: ShieldAlert, badge: openCount }]
          : []),
        { id: 'profile', label: 'Account Profile', icon: User },
      ],
    },
  ];

  const handleClick = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const initials = user.displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#111827] border-r border-slate-800/90 w-64">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <Shield className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
            CampusShield
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav aria-label="Primary Sidebar Navigation" className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.heading} className="space-y-1">
            <div className="px-3 pb-1 text-xs font-medium text-slate-500">{group.heading}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleClick(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/45'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-blue-400' : 'text-slate-400'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="font-mono tabular-nums text-xs font-semibold text-red-400">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800/80 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
            {initials || 'CS'}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-100 truncate">{user.displayName}</div>
            <div className="text-xs text-slate-400 font-mono truncate">
              {user.role === 'admin' ? 'Officer' : 'Student'} · {user.studentId}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-[#0B1120] border border-slate-800 hover:border-slate-700 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Switch Account / Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
