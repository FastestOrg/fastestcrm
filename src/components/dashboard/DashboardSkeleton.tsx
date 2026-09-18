import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardSkeleton() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-100px] left-[15%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[10%] left-[5%] w-[450px] h-[450px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Sticky Header Skeleton */}
      <header className="sticky top-0 bg-background/60 backdrop-blur-xl border-b border-border/40 px-6 md:px-8 py-4 z-20">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-36 rounded-md" />
            <Skeleton className="h-4 w-64 rounded-md hidden sm:block" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-28 rounded-md hidden md:block" />
            <Skeleton className="h-9 w-36 rounded-lg" />
          </div>
        </div>
      </header>

      <div className="p-6 md:p-8 space-y-8 relative z-10">
        {/* Welcome Hero Banner Skeleton */}
        <div className="relative overflow-hidden p-6 md:p-8 rounded-2xl border border-purple-500/10 bg-gradient-to-r from-purple-950/20 via-indigo-950/10 to-background shadow-lg shadow-purple-500/5">
          <div className="max-w-3xl space-y-3">
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-8 w-64 md:w-80 rounded-lg mt-2" />
            <Skeleton className="h-4 w-full max-w-2xl rounded-md mt-2" />
            <Skeleton className="h-4 w-3/4 max-w-lg rounded-md" />
          </div>
        </div>

        {/* 6 KPI Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            'border-l-amber-400/80',
            'border-l-emerald-400/80',
            'border-l-primary/80',
            'border-l-teal-400/80',
            'border-l-pink-500/80',
            'border-l-violet-400/80'
          ].map((borderAccent, i) => (
            <Card key={i} className={`glass card-hover border-l-2 ${borderAccent} relative overflow-hidden`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-8 w-28 mb-2 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
                <div className="mt-4 pt-3 border-t border-border/20 flex justify-between items-center">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Analytics Charts Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Intake Trend Chart (2/3 width) */}
          <Card className="glass lg:col-span-2 relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-3 w-60 rounded-md" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </CardHeader>
            <CardContent className="h-72 flex flex-col justify-end p-6 pt-0">
              <div className="flex items-end gap-3 h-52 w-full justify-between pt-6">
                {[35, 60, 45, 80, 50, 95, 70, 85].map((heightPct, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <Skeleton className="w-full rounded-t-md opacity-80" style={{ height: `${heightPct}%` }} />
                    <Skeleton className="h-2.5 w-6 rounded" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Status Breakdown Chart (1/3 width) */}
          <Card className="glass relative overflow-hidden">
            <CardHeader className="pb-4 space-y-1.5">
              <Skeleton className="h-5 w-36 rounded-md" />
              <Skeleton className="h-3 w-48 rounded-md" />
            </CardHeader>
            <CardContent className="h-72 flex flex-col justify-center gap-4 p-6 pt-0">
              {[85, 65, 45, 30, 20].map((widthPct, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-3 w-20 rounded" />
                    <Skeleton className="h-3 w-8 rounded" />
                  </div>
                  <Skeleton className="h-2.5 rounded-full" style={{ width: `${widthPct}%` }} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Recent Activity Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass lg:col-span-2 relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40 rounded-md" />
                <Skeleton className="h-3 w-64 rounded-md" />
              </div>
              <Skeleton className="h-4 w-24 rounded" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32 rounded" />
                      <Skeleton className="h-3 w-48 rounded" />
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-4 w-20 ml-auto rounded" />
                    <Skeleton className="h-3 w-24 ml-auto rounded" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass relative overflow-hidden">
            <CardHeader className="pb-4 space-y-1.5">
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-3 w-48 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3.5 rounded-xl border border-border/40 bg-card/40 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3.5 w-24 rounded" />
                      <Skeleton className="h-3 w-36 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Full page skeleton including the desktop sidebar and header.
 * Used at the top-level Router/Suspense boundary so the user instantly sees
 * the entire CRM interface without any blank screens or "Initializing Interface" spinners.
 */
export function FullDashboardSkeleton() {
  return (
    <div className="min-h-screen h-screen overflow-hidden bg-background flex">
      {/* Desktop Sidebar Skeleton */}
      <aside className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border flex-col shrink-0 h-full">
        {/* Brand/Logo Header */}
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <Skeleton className="h-3 w-20 px-3 my-2 rounded" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
          ))}

          <Skeleton className="h-3 w-20 px-3 my-3 rounded" />
          {[...Array(4)].map((_, i) => (
            <div key={`sub-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
          ))}
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-sidebar-border flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <main className="flex-1 overflow-y-auto h-full">
        <DashboardSkeleton />
      </main>
    </div>
  );
}

export default DashboardSkeleton;
