/** @fileOverview Shared, explicit public/member navigation for the desktop rail and mobile drawer. @stability stable */
import type { ComponentType } from 'react';
import { FiHome, FiPackage, FiZap, FiGrid, FiMessageSquare, FiShoppingCart, FiCreditCard, FiSettings, FiHelpCircle, FiLock, FiDownload, FiUser, FiFileText, FiDollarSign, FiBox, FiHexagon, FiShield, FiUsers } from 'react-icons/fi';
import { PulseHeart } from '@/components/uicustom/icons/PulseIcons';

export type NavigationGroup = { label: string; items: { href: string; label: string; icon: ComponentType<{ className?: string }> }[] };
const explore: NavigationGroup = { label: 'Explore', items: [
  { href: '/', label: 'Home', icon: FiHome },
  { href: '/products', label: 'Products', icon: FiPackage },
  { href: '/pulse', label: 'Pulse', icon: PulseHeart },
] };
const info: NavigationGroup = { label: 'Info', items: [
  { href: '/info', label: 'Contact', icon: FiHelpCircle },
  { href: '/privacy', label: 'Privacy', icon: FiLock },
] };
export const publicNavigation: NavigationGroup[] = [explore, info];
export const memberNavigation: NavigationGroup[] = [
  { ...explore, items: [...explore.items, { href: '/ai', label: 'AI Chat', icon: FiZap }] },
  { label: 'Account', items: [
    { href: '/dashboard', label: 'Dashboard', icon: FiGrid },
    { href: '/conversations', label: 'Messages', icon: FiMessageSquare },
    { href: '/cart', label: 'Cart', icon: FiShoppingCart },
    { href: '/checkout', label: 'Checkout', icon: FiCreditCard },
    { href: '/my-downloads', label: 'Downloads', icon: FiDownload },
    { href: '/my-orders', label: 'Orders', icon: FiFileText },
    { href: '/profile', label: 'Profile', icon: FiUser },
    { href: '/settings', label: 'Settings', icon: FiSettings },
  ] },
  { label: 'Workspace', items: [
    { href: '/my-sales', label: 'Sales', icon: FiDollarSign },
    { href: '/nexus', label: 'Business', icon: FiBox },
    { href: '/dashboard/trading', label: 'Trading', icon: FiHexagon },
  ] },
  info,
];

export function getNavigationGroups(user?: { role?: string } | null): NavigationGroup[] {
  if (!user) return publicNavigation;
  if (user.role !== 'OWNER' && user.role !== 'ADMIN') return memberNavigation;
  return [...memberNavigation, { label: 'Admin', items: [
    { href: '/admin', label: 'Admin', icon: FiShield },
    { href: '/admin/users', label: 'Users', icon: FiUsers },
    { href: '/admin/repo-access', label: 'Repo access', icon: FiPackage },
  ] }];
}

export function isActiveNavigationPath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
