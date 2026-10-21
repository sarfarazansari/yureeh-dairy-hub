import type { LucideIcon } from 'lucide-react';
import {
  Activity, Beef, IndianRupee, LayoutDashboard, ListOrdered, Milk, PlusCircle,
  Settings, TrendingUp, Users, Wheat,
} from 'lucide-react';
import type { FarmRole } from '@/lib/farm-access';

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: readonly FarmRole[];
};

export type NavigationGroup = {
  label: string;
  items: readonly NavigationItem[];
};

/**
 * Central navigation registry.
 * Keep permissions aligned with FarmRole; this controls visibility only.
 * Route guards, server actions, RLS, and RPC authorization remain the security boundary.
 */
export const navigationGroups: readonly NavigationGroup[] = [
  {
    label: 'MILK SALES',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard, permission: ['super_admin', 'viewer'] },
      { label: 'New Milk Entry', href: '/new-entry', icon: PlusCircle, permission: ['super_admin'] },
      { label: 'Milk Entries', href: '/entries', icon: ListOrdered, permission: ['super_admin', 'viewer'] },
      { label: 'Farm Milk Pool', href: '/milk-pool', icon: Milk, permission: ['super_admin', 'viewer'] },
      { label: 'Customers', href: '/customers', icon: Users, permission: ['super_admin', 'viewer'] },
      { label: 'Analytics', href: '/analytics', icon: TrendingUp, permission: ['super_admin', 'viewer'] },
    ],
  },
  {
    label: 'FARM COSTS',
    items: [
      { label: 'Expenses', href: '/expenses', icon: IndianRupee, permission: ['super_admin', 'viewer'] },
      { label: 'Financial Reports', href: '/financial-reports', icon: TrendingUp, permission: ['super_admin', 'viewer'] },
      { label: 'Feed Items', href: '/feeds/items', icon: Wheat, permission: ['super_admin'] },
      { label: 'Feed Inventory', href: '/feeds/inventory', icon: Wheat, permission: ['super_admin', 'viewer'] },
      { label: 'Movement History', href: '/feeds/inventory/movements', icon: ListOrdered, permission: ['super_admin', 'viewer'] },
      { label: 'Feed Purchases', href: '/feeds/purchases', icon: Wheat, permission: ['super_admin', 'viewer'] },
      { label: 'Feed Consumption', href: '/feeds/consumption', icon: Wheat, permission: ['super_admin', 'viewer'] },
      { label: 'Diet Plans', href: '/feeds/diet-plans', icon: Wheat, permission: ['super_admin', 'viewer'] },
    ],
  },
  {
    label: 'PRODUCTION',
    items: [
      { label: 'Buffaloes', href: '/buffaloes', icon: Beef, permission: ['super_admin', 'viewer'] },
      { label: 'Buffalo Sales', href: '/buffalo-sales', icon: IndianRupee, permission: ['super_admin', 'viewer'] },
      { label: 'Daily Performance', href: '/daily-performance', icon: Activity, permission: ['super_admin', 'viewer'] },
      { label: 'Buffalo Analytics', href: '/buffalo-analytics', icon: TrendingUp, permission: ['super_admin', 'viewer'] },
    ],
  },
  {
    label: 'PREFERENCES',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings, permission: ['super_admin'] },
    ],
  },
];
