import { Flame, Sun, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PriorityLevel } from "@/hooks/useLeadScoring";

interface PriorityBadgeProps {
    level: PriorityLevel;
    score: number;
    className?: string;
    showScore?: boolean;
}

export function PriorityBadge({ level, score, className, showScore = false }: PriorityBadgeProps) {
    const config = {
        hot: {
            icon: <Flame className="h-3 w-3" />,
            label: "Hot",
            classes: "bg-red-500/10 text-red-500 border-red-500/20",
        },
        warm: {
            icon: <Sun className="h-3 w-3" />,
            label: "Warm",
            classes: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        },
        cold: {
            icon: <Snowflake className="h-3 w-3" />,
            label: "Cold",
            classes: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        },
    };

    const { icon, label, classes } = config[level];

    return (
        <Badge 
            variant="outline" 
            className={cn("gap-1.5 px-2 py-0.5 font-semibold", classes, className)}
        >
            {icon}
            <span>{label}</span>
            {showScore && <span className="opacity-60 ml-0.5">• {score}</span>}
        </Badge>
    );
}
