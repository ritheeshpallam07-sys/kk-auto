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
          bg: 'bg-amber-950/40 border-amber-800 text-amber-300',
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
        };
      case 'Driver Assigned':
        return {
          label: 'Driver Assigned',
          bg: 'bg-sky-950/40 border-sky-800 text-sky-300',
          icon: <UserCheck className="w-3.5 h-3.5 text-sky-400" />
        };
      case 'Driver Arriving':
        return {
          label: 'Driver Arriving',
          bg: 'bg-[#C6FF3D]/15 border-[#C6FF3D]/40 text-[#C6FF3D]',
          icon: <Navigation className="w-3.5 h-3.5 text-[#C6FF3D] animate-pulse" />
        };
      case 'Ride Started':
        return {
          label: 'Ride Started',
          bg: 'bg-[#C6FF3D] border-[#C6FF3D] text-[#0B0B0D] font-black',
          icon: <Zap className="w-3.5 h-3.5 text-[#0B0B0D]" />
        };
      case 'Ride Completed':
        return {
          label: 'Ride Completed',
          bg: 'bg-emerald-950/40 border-emerald-800 text-emerald-300',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        };
      case 'Cancelled':
        return {
          label: 'Cancelled',
          bg: 'bg-rose-950/40 border-rose-800 text-rose-300',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />
        };
      default:
        return {
          label: status,
          bg: 'bg-[#202023] border-[#303034] text-white',
          icon: null
        };
    }
  };

  const config = getStatusConfig();

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-bold'
  };

  return (
    <span className={`inline-flex items-center font-bold rounded-full border shadow-subtle ${config.bg} ${sizeClasses[size]}`}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};
