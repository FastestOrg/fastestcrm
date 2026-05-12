import React from 'react';
import { cn } from "@/lib/utils";

interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'purple' | 'blue' | 'emerald' | 'amber';
  glow?: boolean;
}

export function PremiumCard({ 
  children, 
  className, 
  variant = 'default', 
  glow = false,
  ...props 
}: PremiumCardProps) {
  
  const variantStyles = {
    default: "border-border/50 bg-card/50",
    purple: "border-purple-500/20 bg-purple-500/5",
    blue: "border-blue-500/20 bg-blue-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
  };

  const glowStyles = {
    default: "",
    purple: "shadow-[0_0_20px_-12px_rgba(168,85,247,0.4)]",
    blue: "shadow-[0_0_20px_-12px_rgba(59,130,246,0.4)]",
    emerald: "shadow-[0_0_20px_-12px_rgba(16,185,129,0.4)]",
    amber: "shadow-[0_0_20px_-12px_rgba(245,158,11,0.4)]",
  };

  return (
    <div 
      className={cn(
        "rounded-xl border backdrop-blur-md transition-all duration-300",
        variantStyles[variant],
        glow && glowStyles[variant],
        "hover:shadow-lg hover:border-primary/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PremiumCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function PremiumCardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 
      className={cn("text-lg font-semibold leading-none tracking-tight", className)} 
      style={{ fontFamily: "'Syne', sans-serif" }} 
      {...props} 
    />
  );
}

export function PremiumCardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-sm text-muted-foreground mt-2", className)} {...props} />;
}

export function PremiumCardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function PremiumCardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
