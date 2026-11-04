import React from 'react';
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  ClipboardCheck,
  Database,
  HandCoins,
  LayoutDashboard,
  PiggyBank,
  Scissors,
  Settings,
} from 'lucide-react';
import { NavigationItem } from '../../config/navigation';

export interface NavIconProps {
  name: NavigationItem['iconName'];
  className?: string;
}

export const NavIcon: React.FC<NavIconProps> = ({ name, className = 'w-5 h-5' }) => {
  switch (name) {
    case 'LayoutDashboard':
      return <LayoutDashboard className={className} />;
    case 'Scissors':
      return <Scissors className={className} />;
    case 'ClipboardCheck':
      return <ClipboardCheck className={className} />;
    case 'Banknote':
      return <Banknote className={className} />;
    case 'HandCoins':
      return <HandCoins className={className} />;
    case 'PiggyBank':
      return <PiggyBank className={className} />;
    case 'ArrowLeftRight':
      return <ArrowLeftRight className={className} />;
    case 'BarChart3':
      return <BarChart3 className={className} />;
    case 'Database':
      return <Database className={className} />;
    case 'Settings':
      return <Settings className={className} />;
    default:
      return <LayoutDashboard className={className} />;
  }
};
