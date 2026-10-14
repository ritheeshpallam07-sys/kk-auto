import React from 'react';
import { 
  Loader2, 
  UserCheck, 
  Navigation, 
  Zap, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'Searching for Auto':
        return {
          label: 'Searching for Auto',
          bg: 'bg-orange-50 border-orange-200 text-orange-900',
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF8A00]" />
        };
      case 'Driver Assigned':
        return {
          label: 'Driver Assigned',
          bg: 'bg-blue-50 border-blue-200 text-blue-900',
          icon: <UserCheck className="w-3.5 h-3.5 text-blue-600" />
        };
      case 'Driver Arriving':
        return {
          label: 'Driver Arriving',
          bg: 'bg-cyan-50 border-cyan-200 text-cyan-900',
          icon: <Navigation className="w-3.5 h-3.5 text-cyan-600 animate-pulse" />
        };
      case 'Ride Started':
        return {
          label: 'Ride Started',
          bg: 'bg-indigo-50 border-indigo-200 text-indigo-900',
          icon: <Zap className="w-3.5 h-3.5 text-indigo-600" />
        };
      case 'Ride Completed':
        return {
          label: 'Ride Completed',
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        };
      case 'Cancelled':
        return {
          label: 'Cancelled',
          bg: 'bg-rose-50 border-rose-200 text-rose-900',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />
        };
      default:
        return {
          label: status,
          bg: 'bg-slate-100 border-slate-200 text-slate-800',
          icon: null
        };
    }
  };

  const config = getStatusConfig();
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-semibold',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-bold',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-black'
  };

  return (
    <span className={`inline-flex items-center rounded-full border shadow-2xs ${config.bg} ${sizeClasses[size]}`}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};
