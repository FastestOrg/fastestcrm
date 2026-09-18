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
import { Automation, WorkflowStep } from '@/services/automationService';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  Mail,
  Bell,
  Globe,
  ArrowRight,
  Play,
  Pause,
  Clock,
  GitBranch,
  MessageSquare,
  PhoneCall,
  UserCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface WorkflowCanvasProps {
    automations: Automation[];
    onNodeClick?: (automation: Automation) => void;
}

// ─── Custom Node Components ──────────────────────────────────────────────────

const TriggerNode = ({ data }: NodeProps) => {
    return (
        <Card className="min-w-[200px] p-0 overflow-hidden border-2 border-blue-500/30 shadow-lg bg-card/90 backdrop-blur-md">
            <div className="bg-blue-500/15 p-2 flex items-center justify-between border-b border-blue-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Trigger</span>
                <Zap className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
            </div>
            <div className="p-3">
                <p className="text-xs font-semibold truncate capitalize">{data.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{data.description}</p>
            </div>
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500 border-2 border-background" />
        </Card>
    );
};

const ActionNode = ({ data }: NodeProps) => {
    const Icon = data.icon || Mail;
    const isWhatsApp = data.actionType === 'send_whatsapp' || data.actionType === 'whatsapp';

    return (
        <Card className="min-w-[200px] p-0 overflow-hidden border-2 border-emerald-500/30 shadow-lg bg-card/90 backdrop-blur-md">
            <div className="bg-emerald-500/15 p-2 flex items-center justify-between border-b border-emerald-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Action</span>
                <Icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="p-3">
                <p className="text-xs font-semibold truncate capitalize">{data.label}</p>
                {data.details && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{data.details}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                    {data.isActive ? (
                        <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 h-4">
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
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-500 border-2 border-background" />
        </Card>
    );
};

const DelayNode = ({ data }: NodeProps) => {
    return (
        <Card className="min-w-[190px] p-0 overflow-hidden border-2 border-amber-500/30 shadow-lg bg-card/90 backdrop-blur-md">
            <div className="bg-amber-500/15 p-2 flex items-center justify-between border-b border-amber-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Time Delay</span>
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="p-3">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">Wait</span>
                    <Badge variant="secondary" className="text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        {data.amount || 2} {data.unit || 'days'}
                    </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Drip Campaign Pause</p>
            </div>
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-amber-500 border-2 border-background" />
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-amber-500 border-2 border-background" />
        </Card>
    );
};

const ConditionNode = ({ data }: NodeProps) => {
    return (
        <Card className="min-w-[200px] p-0 overflow-hidden border-2 border-purple-500/30 shadow-lg bg-card/90 backdrop-blur-md">
            <div className="bg-purple-500/15 p-2 flex items-center justify-between border-b border-purple-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Condition Check</span>
                <GitBranch className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="p-3">
                <p className="text-xs font-semibold truncate">
                    If {data.field || 'status'} {data.operator === 'equals' ? 'is' : data.operator}
                </p>
                <div className="mt-1">
                    <Badge variant="outline" className="text-[10px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                        "{data.value || 'New'}"
                    </Badge>
                </div>
            </div>
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-purple-500 border-2 border-background" />
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-purple-500 border-2 border-background" />
        </Card>
    );
};

const nodeTypes = {
    trigger: TriggerNode,
    action: ActionNode,
    delay: DelayNode,
    condition: ConditionNode,
};

function getActionIcon(actionType?: string) {
    switch (actionType) {
        case 'send_whatsapp':
        case 'whatsapp':
            return MessageSquare;
        case 'send_email':
            return Mail;
        case 'ai_call':
            return PhoneCall;
        case 'ai_personalized_followup':
            return Sparkles;
        case 'assign_lead':
            return UserCheck;
        case 'update_status':
            return CheckCircle2;
        case 'webhook':
            return Globe;
        default:
            return Bell;
    }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WorkflowCanvas({ automations, onNodeClick }: WorkflowCanvasProps) {
    const { nodes, edges } = useMemo(() => {
        const initialNodes: Node[] = [];
        const initialEdges: Edge[] = [];

        automations.forEach((auto, autoIndex) => {
            const yOffset = autoIndex * 160;
            let currentX = 50;

            // 1. Trigger Node
            const triggerNodeId = `trigger-${auto.id}`;
            initialNodes.push({
                id: triggerNodeId,
                type: 'trigger',
                position: { x: currentX, y: yOffset },
                data: { 
                    label: auto.trigger_type.replace(/_/g, ' '),
                    description: auto.name,
                    automation: auto,
                },
            });

            currentX += 260;

            const steps: WorkflowStep[] =
                auto.sequence_steps || auto.action_config?.sequence_steps || [];

            if (steps.length > 0) {
                // Multi-step Sequence Pipeline
                let previousNodeId = triggerNodeId;

                steps.forEach((step, stepIndex) => {
                    const stepNodeId = `step-${auto.id}-${stepIndex}`;

                    if (step.step_type === 'delay') {
                        initialNodes.push({
                            id: stepNodeId,
                            type: 'delay',
                            position: { x: currentX, y: yOffset },
                            data: {
                                amount: step.delay?.amount || 2,
                                unit: step.delay?.unit || 'days',
                                automation: auto,
                            },
                        });
                    } else if (step.step_type === 'condition') {
                        initialNodes.push({
                            id: stepNodeId,
                            type: 'condition',
                            position: { x: currentX, y: yOffset },
                            data: {
                                field: step.condition?.field || 'status',
                                operator: step.condition?.operator || 'equals',
                                value: step.condition?.value || 'New',
                                automation: auto,
                            },
                        });
                    } else {
                        // Action step
                        const actType = step.action_type || auto.action_type;
                        initialNodes.push({
                            id: stepNodeId,
                            type: 'action',
                            position: { x: currentX, y: yOffset },
                            data: {
                                label: actType.replace(/_/g, ' '),
                                details: step.name || (actType === 'send_whatsapp' ? 'WhatsApp Welcome' : undefined),
                                actionType: actType,
                                isActive: auto.is_active,
                                icon: getActionIcon(actType),
                                automation: auto,
                            },
                        });
                    }

                    // Connecting Edge
                    initialEdges.push({
                        id: `edge-${previousNodeId}-${stepNodeId}`,
                        source: previousNodeId,
                        target: stepNodeId,
                        animated: auto.is_active,
                        style: {
                            stroke: auto.is_active ? '#3b82f6' : '#94a3b8',
                            strokeWidth: 2,
                        },
                    });

                    previousNodeId = stepNodeId;
                    currentX += 260;
                });
            } else {
                // Standard Single Action Pipeline
                const actionNodeId = `action-${auto.id}`;
                initialNodes.push({
                    id: actionNodeId,
                    type: 'action',
                    position: { x: currentX, y: yOffset },
                    data: { 
                        label: auto.action_type.replace(/_/g, ' '),
                        actionType: auto.action_type,
                        isActive: auto.is_active,
                        icon: getActionIcon(auto.action_type),
                        automation: auto,
                    },
                });

                initialEdges.push({
                    id: `edge-${triggerNodeId}-${actionNodeId}`,
                    source: triggerNodeId,
                    target: actionNodeId,
                    animated: auto.is_active,
                    style: { stroke: auto.is_active ? '#3b82f6' : '#94a3b8', strokeWidth: 2 },
                });
            }
        });

        return { nodes: initialNodes, edges: initialEdges };
    }, [automations]);

    const onElementClick = useCallback((event: React.MouseEvent, element: any) => {
        const auto = element.data?.automation;
        if (auto && onNodeClick) {
            onNodeClick(auto);
        }
    }, [onNodeClick]);

    return (
        <div style={{ width: '100%', height: 'calc(100vh - 240px)', background: 'var(--background)' }} className="rounded-2xl border border-border shadow-inner overflow-hidden relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodeClick={onElementClick}
                fitView
            >
                <Background color="#888" gap={24} size={1} />
                <Controls />
                <MiniMap 
                    nodeColor={(n) => {
                        if (n.type === 'trigger') return '#3b82f6';
                        if (n.type === 'delay') return '#f59e0b';
                        if (n.type === 'condition') return '#8b5cf6';
                        return '#10b981';
                    }}
                    maskColor="rgba(0, 0, 0, 0.1)"
                    style={{ borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                />
                <Panel position="top-right">
                    <div className="bg-card/70 backdrop-blur-md p-2.5 rounded-xl border border-border flex items-center gap-4 text-[10px] font-bold shadow-md">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> TRIGGER
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> ACTION
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> TIME DELAY
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" /> CONDITION
                        </div>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}
