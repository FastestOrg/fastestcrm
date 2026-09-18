import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function ReportSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-pulse">
      {/* ─── Page Title & Action Header Skeleton ─── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-72 sm:w-80 rounded-lg" />
            <Skeleton className="h-5 w-28 rounded-full hidden sm:inline-flex" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full rounded-md" />
        </div>

        {/* Action Controls Skeleton */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-44 rounded-md" />
        </div>
      </div>

      {/* ─── Attribute Filters Bar Skeleton ─── */}
      <Card className="bg-card/70 border-border/70 p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-44 rounded-md ml-auto" />
        </div>
      </Card>

      {/* ─── Main Tabs Navigation Skeleton ─── */}
      <div className="space-y-6">
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted/40 border border-border/50 rounded-lg w-fit">
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-44 rounded-md" />
          <Skeleton className="h-8 w-36 rounded-md hidden md:block" />
          <Skeleton className="h-8 w-36 rounded-md hidden lg:block" />
        </div>

        {/* ─── Dynamic 4 KPI Metric Cards Skeleton ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card/70 border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent className="space-y-1.5">
                <Skeleton className="h-7 w-28 rounded-md" />
                <Skeleton className="h-3 w-36 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ─── Charts Grid Skeleton (Funnel & Segment Breakdown) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card/70 border-border/70 shadow-xs">
            <CardHeader className="pb-3 space-y-1.5">
              <Skeleton className="h-5 w-44 rounded-md" />
              <Skeleton className="h-3 w-64 rounded-md" />
            </CardHeader>
            <CardContent className="h-72 flex flex-col justify-end p-6 pt-0">
              <div className="flex items-end gap-4 h-52 w-full justify-between pt-6">
                {[40, 75, 55, 90, 65, 80].map((heightPct, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <Skeleton className="w-full rounded-t-md opacity-80" style={{ height: `${heightPct}%` }} />
                    <Skeleton className="h-2.5 w-8 rounded" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/70 border-border/70 shadow-xs">
            <CardHeader className="pb-3 space-y-1.5">
              <Skeleton className="h-5 w-48 rounded-md" />
              <Skeleton className="h-3 w-60 rounded-md" />
            </CardHeader>
            <CardContent className="h-72 flex flex-col justify-center gap-3.5 p-6 pt-0">
              {[85, 70, 55, 40, 25].map((widthPct, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-3 w-12 rounded" />
                  </div>
                  <Skeleton className="h-2.5 rounded-full" style={{ width: `${widthPct}%` }} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ─── Custom Report Table Skeleton ─── */}
        <Card className="bg-card/70 border-border/70 shadow-xs overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48 rounded-md" />
              <Skeleton className="h-3 w-64 rounded-md" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-28 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Table Header */}
            <div className="border-t border-b border-border/60 bg-muted/30 px-6 py-3 flex gap-4">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-24 rounded ml-auto" />
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
            {/* Table Rows */}
            <div className="divide-y divide-border/40 px-6">
              {[1, 2, 3, 4, 5, 6].map((row) => (
                <div key={row} className="py-3.5 flex items-center gap-4">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-4 w-40 rounded" />
                  </div>
                  <Skeleton className="h-4 w-16 rounded ml-auto" />
                  <Skeleton className="h-4 w-20 rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ReportSkeleton;
