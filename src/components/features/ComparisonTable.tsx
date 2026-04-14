import React from 'react';
import { Check, X } from 'lucide-react';

interface ComparisonRow {
  feature: string;
  us: string;
  them: string;
}

interface ComparisonTableProps {
  competitor: string;
  rows: ComparisonRow[];
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({ competitor, rows }) => {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border/50 bg-secondary/30">
            <th className="py-5 px-6 font-bold text-lg" style={{ fontFamily: "'Syne', sans-serif" }}>Feature</th>
            <th className="py-5 px-6 font-bold text-lg text-primary text-center" style={{ fontFamily: "'Syne', sans-serif" }}>Fastest CRM</th>
            <th className="py-5 px-6 font-bold text-lg text-muted-foreground text-center" style={{ fontFamily: "'Syne', sans-serif" }}>{competitor}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors">
              <td className="py-5 px-6 font-semibold">{row.feature}</td>
              <td className="py-5 px-6 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="p-1 rounded-full bg-emerald-500/10 text-emerald-500 mb-1">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-emerald-400">{row.us}</span>
                </div>
              </td>
              <td className="py-5 px-6 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="p-1 rounded-full bg-red-500/10 text-red-500 mb-1">
                    <X className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-muted-foreground">{row.them}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;
