import { useMemo } from 'react';
import { AppRole } from '@/hooks/useTeam';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2 } from 'lucide-react';

interface OrgChartProps {
    members: any[];
    currentUserRole: AppRole | null;
    onManage?: (member: any) => void;
    currentUserId?: string;
    getRoleLabel: (role: AppRole) => string;
    getRoleLevelNum: (role: AppRole) => number;
}

interface TreeNode {
    member: any;
    children: TreeNode[];
}

export function OrgChart({ members, currentUserRole, onManage, currentUserId, getRoleLabel, getRoleLevelNum }: OrgChartProps) {

    // Build tree structure
    const treeData = useMemo(() => {
        const nodes: Record<string, TreeNode> = {};
        const mainRoots: TreeNode[] = [];
        const unassignedRoots: TreeNode[] = [];

        // Initialize all nodes
        members.forEach(member => {
            nodes[member.id] = { member, children: [] };
        });

        // Link children to parents
        members.forEach(member => {
            if (member.manager_id && nodes[member.manager_id]) {
                nodes[member.manager_id].children.push(nodes[member.id]);
            } else {
                // Determine if it should be a main root or unassigned
                // If viewing as Company Admin, anyone who is NOT a top-level admin (Level 1) is unassigned if they have no manager
                // If viewing as generic user (BDE), the root of the visible tree (themself) is a valid main root

                const level = getRoleLevelNum(member.role);
                // Simple heuristic: If level > 1, it's unassigned. Level 0 (Platform) and 1 (Company) are valid roots.
                // Level 2 (Subadmin) might also be considered unassigned if they don't report to Company Admin? 
                // Let's assume Level 1 is the only true root.

                // However, for non-admins viewing their own tree, they might be Level 10 but valid root of their view.
                // We can check if currentUserRole allows seeing everyone.
                const isCompanyView = currentUserRole === 'company';

                if (isCompanyView && level > 1) {
                    unassignedRoots.push(nodes[member.id]);
                } else {
                    mainRoots.push(nodes[member.id]);
                }
            }
        });

        // Sort main roots: Company Admin first
        mainRoots.sort((a, b) => getRoleLevelNum(a.member.role) - getRoleLevelNum(b.member.role));

        return { mainRoots, unassignedRoots };
    }, [members, currentUserRole, getRoleLevelNum]);


    // CSS-only Org Chart implementation strategy often uses <ul><li> nested structure
    // Let's use a standard robust CSS structure

    return (
        <div className="overflow-x-auto py-4 custom-scrollbar">
            {/* Main Hierarchy */}
            {treeData.mainRoots.length > 0 && (
                <div className="min-w-max flex justify-center mb-6">
                    <ul className="org-tree flex justify-center m-0 p-0 list-none">
                        {treeData.mainRoots.map(root => (
                            <TreeItem key={root.member.id} node={root} onManage={onManage} currentUserId={currentUserId} getRoleLabel={getRoleLabel} />
                        ))}
                    </ul>
                </div>
            )}

            {/* Unassigned Manager Section */}
            {treeData.unassignedRoots.length > 0 && (
                <div className="border-t pt-8 mt-4">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 pl-4">
                        <span className="w-2 h-8 bg-warning rounded-full inline-block"></span>
                        Unassigned Manager
                        <Badge variant="outline" className="ml-2 text-warning border-warning/50">
                            {treeData.unassignedRoots.length} Members
                        </Badge>
                    </h3>
                    <div className="min-w-max flex flex-wrap gap-8 justify-center px-4">
                        {/* We render them as trees because they might have their own reports! */}
                        <ul className="org-tree flex flex-wrap justify-center m-0 p-0 list-none gap-10">
                            {treeData.unassignedRoots.map(root => (
                                <TreeItem key={root.member.id} node={root} onManage={onManage} currentUserId={currentUserId} getRoleLabel={getRoleLabel} />
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <style>{`
                .org-tree ul {
                    padding-top: 14px;
                    position: relative;
                    display: flex;
                    justify-content: center;
                }
                
                .org-tree li {
                    float: left; text-align: center;
                    list-style-type: none;
                    position: relative;
                    padding: 14px 6px 0 6px;
                }
                
                /* Vertical line down from parent */
                .org-tree li::before, .org-tree li::after {
                    content: '';
                    position: absolute; top: 0; right: 50%;
                    border-top: 2px solid hsl(var(--border));
                    width: 50%; height: 14px;
                }
                .org-tree li::after {
                    right: auto; left: 50%;
                    border-left: 2px solid hsl(var(--border));
                }
                
                /* Remove connection for single/roots properly or first/last children */
                .org-tree li:only-child::after, .org-tree li:only-child::before {
                    display: none;
                }
                .org-tree li:only-child { padding-top: 0; }
                
                .org-tree li:first-child::before, .org-tree li:last-child::after {
                    border: 0 none;
                }
                .org-tree li:last-child::before, .org-tree li:first-child::after {
                    border-radius: 4px 0 0 0;
                    border-top: 2px solid hsl(var(--border));
                }
                .org-tree li:first-child::after {
                    border-radius: 4px 0 0 0;
                }
                .org-tree li:last-child::before {
                    border-radius: 0 4px 0 0;
                    border-right: 2px solid hsl(var(--border));
                }
                
                /* Add downward connectors from parents */
                .org-tree ul ul::before {
                    content: '';
                    position: absolute; top: 0; left: 50%;
                    border-left: 2px solid hsl(var(--border));
                    width: 0; height: 14px;
                }
            `}</style>
        </div>
    );
}

function TreeItem({ node, onManage, currentUserId, getRoleLabel }: { node: TreeNode, onManage?: any, currentUserId?: string, getRoleLabel: any }) {
    const isDeactivated = node.member.is_deactivated;
    return (
        <li>
            <div className={`relative z-10 bg-card border rounded-lg p-2.5 min-w-[130px] max-w-[160px] shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-1.5 group inline-flex mx-1 ${isDeactivated ? 'opacity-50 border-destructive/30' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${isDeactivated ? 'bg-destructive/10 border-destructive/20' : 'bg-primary/10 border-transparent group-hover:border-primary/20'}`}>
                    <span className={`font-bold text-sm ${isDeactivated ? 'text-destructive' : 'text-primary'}`}>
                        {node.member.full_name?.[0] || node.member.email?.[0] || '?'}
                    </span>
                </div>

                <div className="text-center">
                    <h4 className="font-semibold text-xs truncate max-w-[130px]" title={node.member.full_name}>
                        {node.member.full_name || 'Unnamed'}
                    </h4>
                    <div className="text-[9px] text-muted-foreground truncate max-w-[130px] mb-1">
                        ({node.member.email})
                    </div>
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                            {getRoleLabel(node.member.role)}
                        </Badge>
                        {node.member.incentive_percent !== null && node.member.incentive_percent !== undefined && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal bg-emerald-50 text-emerald-700 border-emerald-200">
                                {node.member.incentive_percent}% Inc.
                            </Badge>
                        )}
                        {isDeactivated && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-normal">
                                Deactivated
                            </Badge>
                        )}
                    </div>
                </div>

                {onManage && currentUserId !== node.member.id && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] w-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onManage(node.member)}
                    >
                        Manage
                    </Button>
                )}
            </div>
            {node.children.length > 0 && (
                <ul>
                    {node.children.map(child => (
                        <TreeItem
                            key={child.member.id}
                            node={child}
                            onManage={onManage}
                            currentUserId={currentUserId}
                            getRoleLabel={getRoleLabel}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}
