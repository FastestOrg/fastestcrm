import React, { useMemo, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  Node, 
  Edge,
  Handle,
  Position,
  NodeProps,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Automation } from '@/services/automationService';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Mail, Bell, Globe, ArrowRight, Play, Pause } from 'lucide-react';

interface WorkflowCanvasProps {
    automations: Automation[];
    onNodeClick?: (automation: Automation) => void;
}

// ─── Custom Node Components ──────────────────────────────────────────────────

const TriggerNode = ({ data }: NodeProps) => {
    return (
        <Card className="min-w-[180px] p-0 overflow-hidden border-2 border-primary/20 shadow-lg bg-card/80 backdrop-blur-md">
            <div className="bg-primary/10 p-2 flex items-center justify-between border-b border-primary/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Trigger</span>
                <Zap className="h-3 w-3 text-primary animate-pulse" />
            </div>
            <div className="p-3">
                <p className="text-xs font-semibold truncate">{data.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{data.description}</p>
            </div>
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-primary border-2 border-background" />
        </Card>
    );
};

const ActionNode = ({ data }: NodeProps) => {
    const Icon = data.icon || Mail;
    return (
        <Card className="min-w-[180px] p-0 overflow-hidden border-2 border-emerald-500/20 shadow-lg bg-card/80 backdrop-blur-md">
            <div className="bg-emerald-500/10 p-2 flex items-center justify-between border-b border-emerald-500/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Action</span>
                <Icon className="h-3 w-3 text-emerald-500" />
            </div>
            <div className="p-3">
                <p className="text-xs font-semibold truncate">{data.label}</p>
                <div className="flex items-center gap-1.5 mt-2">
                    {data.isActive ? (
                        <Badge variant="outline" className="text-[9px] bg-emerald-500/5 text-emerald-500 border-emerald-500/20 h-4">
                           <Play className="h-2 w-2 mr-1" /> ACTIVE
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground h-4">
                           <Pause className="h-2 w-2 mr-1" /> PAUSED
                        </Badge>
                    )}
                </div>
            </div>
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-emerald-500 border-2 border-background" />
        </Card>
    );
};

const nodeTypes = {
    trigger: TriggerNode,
    action: ActionNode,
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function WorkflowCanvas({ automations, onNodeClick }: WorkflowCanvasProps) {
    const { nodes, edges } = useMemo(() => {
        const initialNodes: Node[] = [];
        const initialEdges: Edge[] = [];

        automations.forEach((auto, index) => {
            const yOffset = index * 120;

            // Trigger Node
            initialNodes.push({
                id: `trigger-${auto.id}`,
                type: 'trigger',
                position: { x: 50, y: yOffset },
                data: { 
                    label: auto.trigger_type.replace(/_/g, ' '),
                    description: auto.name
                },
            });

            // Action Node
            initialNodes.push({
                id: `action-${auto.id}`,
                type: 'action',
                position: { x: 350, y: yOffset },
                data: { 
                    label: auto.action_type.replace(/_/g, ' '),
                    isActive: auto.is_active,
                    icon: auto.action_type === 'send_email' ? Mail : auto.action_type === 'webhook' ? Globe : Bell
                },
            });

            // Edge
            initialEdges.push({
                id: `edge-${auto.id}`,
                source: `trigger-${auto.id}`,
                target: `action-${auto.id}`,
                animated: auto.is_active,
                style: { stroke: auto.is_active ? '#3b82f6' : '#94a3b8', strokeWidth: 2 },
            });
        });

        return { nodes: initialNodes, edges: initialEdges };
    }, [automations]);

    const onElementClick = useCallback((event: React.MouseEvent, element: any) => {
        const autoId = element.id.split('-')[1];
        const automation = automations.find(a => a.id === autoId);
        if (automation && onNodeClick) {
            onNodeClick(automation);
        }
    }, [automations, onNodeClick]);

    return (
        <div style={{ width: '100%', height: 'calc(100vh - 250px)', background: 'var(--background)' }} className="rounded-2xl border border-border shadow-inner overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodeClick={onElementClick}
                fitView
            >
                <Background color="#888" gap={20} size={1} />
                <Controls />
                <MiniMap 
                    nodeColor={(n) => n.type === 'trigger' ? '#3b82f6' : '#10b981'}
                    maskColor="rgba(0, 0, 0, 0.1)"
                    style={{ borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                />
                <Panel position="top-right">
                    <div className="bg-card/50 backdrop-blur-md p-2 rounded-lg border border-border flex items-center gap-4 text-[10px] font-bold">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-primary" /> TRIGGER
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" /> ACTION
                        </div>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}
