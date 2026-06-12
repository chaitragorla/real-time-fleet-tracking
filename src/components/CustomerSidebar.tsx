import React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter
} from '@/components/ui/sidebar';
import { User, Shield, LogOut, Plus, Smartphone, Compass } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface CustomerSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function CustomerSidebar({ activeSection, onSectionChange }: CustomerSidebarProps) {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'my-devices', title: 'My Devices', icon: Smartphone },
    { id: 'add-device', title: 'Add Device', icon: Plus },
    { id: 'trips', title: 'Trip History', icon: Compass },
    { id: 'account', title: 'Account Information', icon: User },
  ];

  return (
    <Sidebar className="border-r border-gray-900 bg-gray-950/20">
      <SidebarHeader className="p-4 border-b border-gray-900 bg-gray-950/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neon-gradient rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white leading-tight">Traceify</h2>
            <p className="text-xs text-cyan-400 font-semibold tracking-wider uppercase">GPS System</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-gray-950/10">
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 text-xs tracking-wider uppercase px-2 mb-2">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <SidebarMenuItem key={item.id} className="mb-1">
                    <SidebarMenuButton
                      onClick={() => onSectionChange(item.id)}
                      isActive={isActive}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 text-cyan-400 font-medium'
                          : 'text-gray-400 hover:text-white hover:bg-gray-900/40'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-gray-400'}`} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-gray-900 bg-gray-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-500/10 border border-cyan-500/20 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-sm font-semibold text-gray-200">{user?.name}</span>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
