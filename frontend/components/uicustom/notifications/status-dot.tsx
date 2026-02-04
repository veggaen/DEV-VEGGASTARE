"use client";

import { cn } from "@/lib/utils";
import { presenceStatuses } from "@/lib/pulse-labels";
import type { PresenceStatusName } from "./types";

interface StatusDotProps {
  status: PresenceStatusName;
  size?: "xs" | "sm" | "md" | "lg";
  showPulse?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: "h-2 w-2",
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
};

const pulseSizeClasses = {
  xs: "h-2 w-2",
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
};

export function StatusDot({ 
  status, 
  size = "sm", 
  showPulse = true,
  className 
}: StatusDotProps) {
  const config = presenceStatuses[status];
  if (!config) return null;
  
  const isPulsing = status === "ONLINE" || status === "LIVE";
  const isIdle = status === "IDLE";
  
  return (
    <span 
      className={cn("relative inline-flex", className)}
      title={`${config.label}${config.description ? ` - ${config.description}` : ""}`}
    >
      {/* Animated pulse ring for online/live statuses */}
      {showPulse && isPulsing && (
        <span 
          className={cn(
            "absolute inline-flex rounded-full opacity-75 animate-ping",
            pulseSizeClasses[size],
            status === "LIVE" ? "bg-purple-400" : "bg-emerald-400"
          )}
          style={{
            animationDuration: status === "LIVE" ? "1s" : "1.5s",
          }}
        />
      )}
      
      {/* Slow fade animation for idle status */}
      {showPulse && isIdle && (
        <span 
          className={cn(
            "absolute inline-flex rounded-full bg-amber-400 opacity-50",
            pulseSizeClasses[size],
            "animate-pulse"
          )}
          style={{
            animationDuration: "2.5s",
          }}
        />
      )}
      
      {/* Main status dot */}
      <span 
        className={cn(
          "relative inline-flex rounded-full",
          sizeClasses[size],
          // Status-specific colors
          status === "ONLINE" && "bg-emerald-500",
          status === "IDLE" && "bg-amber-500",
          status === "DND" && "bg-rose-500",
          status === "OFFLINE" && "bg-zinc-400 dark:bg-zinc-600",
          status === "LIVE" && "bg-purple-500",
          status === "SYNCING" && "bg-blue-500 animate-pulse"
        )}
      />
    </span>
  );
}

// Compound component for user avatar with status
interface StatusAvatarProps {
  status: PresenceStatusName;
  children: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const avatarDotPositions = {
  xs: "-bottom-0 -right-0",
  sm: "-bottom-0.5 -right-0.5",
  md: "-bottom-0.5 -right-0.5",
  lg: "-bottom-1 -right-1",
};

export function StatusAvatar({ 
  status, 
  children, 
  size = "sm",
  className 
}: StatusAvatarProps) {
  return (
    <div className={cn("relative inline-block", className)}>
      {children}
      <span className={cn("absolute", avatarDotPositions[size])}>
        <StatusDot status={status} size={size} />
      </span>
    </div>
  );
}

// Status text label component
interface StatusLabelProps {
  status: PresenceStatusName;
  showIcon?: boolean;
  className?: string;
}

export function StatusLabel({ 
  status, 
  showIcon = true,
  className 
}: StatusLabelProps) {
  const config = presenceStatuses[status];
  if (!config) return null;
  
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      {showIcon && <StatusDot status={status} size="xs" showPulse={false} />}
      <span className="text-zinc-600 dark:text-zinc-400">
        {config.label}
      </span>
    </span>
  );
}
