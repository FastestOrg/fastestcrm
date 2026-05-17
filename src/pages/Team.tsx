import { useState } from 'react';
// DashboardLayout removed
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, UserPlus, ChevronRight, Shield, Loader2, ArrowUp, Mail, Trash2, Lock, Pencil, UserX, UserCheck } from 'lucide-react';
import { useTeam, AppRole } from '@/hooks/useTeam';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { useCompany } from '@/hooks/useCompany';
import { useNavigate } from 'react-router-dom';
import { OrgChart } from '@/components/team/OrgChart';

// Validation schema for team member invitation
const inviteSchema = z.object({
    email: z.string().trim().email({ message: "Please enter a valid email address" }).max(255, { message: "Email must be less than 255 characters" }),
    fullName: z.string().trim().min(1, { message: "Full name is required" }).max(100, { message: "Full name must be less than 100 characters" }).regex(/^[a-zA-Z\s'-]+$/, { message: "Full name can only contain letters, spaces, hyphens, and apostrophes" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(72, { message: "Password must be less than 72 characters" }),
    role: z.enum([
        "company", "company_subadmin", "cbo", "vp", "avp",
        "dgm", "agm", "sm", "tl", "bde", "intern", "ca",
        "level_3", "level_4", "level_5", "level_6", "level_7", "level_8",
        "level_9", "level_10", "level_11", "level_12", "level_13", "level_14",
        "level_15", "level_16", "level_17", "level_18", "level_19", "level_20"
    ])
});
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Team() {
    const { user } = useAuth();
    const {
        members,
        loading,
        currentUserRole,
        promoteUser,
        setManager,
        deleteMember,
        toggleMemberStatus,
        getRoleLabel,
        getAssignableRoles,
        refetch,
        addMemberOptimistic,
        removeMemberOptimistic,
        replaceMemberOptimistic,
        roleLabels,
    } = useTeam();
    const { company } = useCompany();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [selectedMember, setSelectedMember] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
    const [selectedManager, setSelectedManager] = useState<string>('');
    const [isPromoting, setIsPromoting] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [reassignToId, setReassignToId] = useState<string>('');

    // Invite member state
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteFullName, setInviteFullName] = useState('');
    const [invitePassword, setInvitePassword] = useState('');
    const [inviteRole, setInviteRole] = useState<AppRole>('level_10');
    const [isInviting, setIsInviting] = useState(false);

    // Hierarchy Edit State
    const [editHierarchyOpen, setEditHierarchyOpen] = useState(false);
    const [hierarchyForm, setHierarchyForm] = useState<Record<string, string>>({});
    const [isSavingHierarchy, setIsSavingHierarchy] = useState(false);

    // Deactivation State
    const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);

    const openEditHierarchy = () => {
        // Initialize form with current labels
        const initialForm: Record<string, string> = {};
        for (let i = 3; i <= 20; i++) {
            const key = `level_${i}` as AppRole;
            initialForm[key] = getRoleLabel(key);
        }
        setHierarchyForm(initialForm);
        setEditHierarchyOpen(true);
    };

    const handleSaveHierarchy = async () => {
        if (!company?.id) return;
        setIsSavingHierarchy(true);
        try {
            const updates: Record<string, string> = {};
            // Only send level_3 to level_20
            Object.keys(hierarchyForm).forEach(key => {
                if (key.startsWith('level_')) {
                    updates[key] = hierarchyForm[key];
                }
            });

            const { error } = await supabase
                .from('company_hierarchies')
                .update(updates)
                .eq('company_id', company.id);

            if (error) throw error;

            toast({ title: "Success", description: "Hierarchy names updated." });
            setEditHierarchyOpen(false);
            refetch();
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message,
                variant: "destructive"
            });
        }
        setIsSavingHierarchy(false);
    };

    const assignableRoles = getAssignableRoles();

    // Users who can be managers (above the lowest level)
    const potentialManagers = members.filter(m => {
        const roleLevel = getRoleLevelNum(m.role);
        return roleLevel < 10; // Above BDE level
    });

    function getRoleLevelNum(role: AppRole): number {
        const fixedLevels: Partial<Record<AppRole, number>> = {
            platform_admin: 0, company: 1, company_subadmin: 2, cbo: 3, vp: 4, avp: 5,
            dgm: 6, agm: 7, sm: 8, tl: 9, bde: 10, intern: 11, ca: 12
        };

        if (role in fixedLevels) {
            return fixedLevels[role]!;
        }

        if (role.startsWith('level_')) {
            const level = parseInt(role.split('_')[1]);
            return isNaN(level) ? 99 : level;
        }

        return 99;
    }

    const handleInviteMember = async () => {
        // Validate inputs with Zod
        const validationResult = inviteSchema.safeParse({
            email: inviteEmail,
            fullName: inviteFullName,
            password: invitePassword,
            role: inviteRole
        });

        if (!validationResult.success) {
            const firstError = validationResult.error.errors[0];
            toast({
                title: "Validation Error",
                description: firstError.message,
                variant: "destructive"
            });
            return;
        }

        const email = validationResult.data.email;
        const fullName = validationResult.data.fullName;
        const password = validationResult.data.password;
        const role = validationResult.data.role as AppRole;

        // Add immediately to UI (optimistic) and close dialog so it feels instant.
        const tempId = `pending-${Date.now()}`;
        addMemberOptimistic({
            id: tempId,
            email,
            full_name: fullName,
            phone: null,
            avatar_url: null,
            manager_id: null,
            created_at: new Date().toISOString(),
            role,
            is_pending: true,
        });

        setInviteDialogOpen(false);
        setInviteEmail('');
        setInviteFullName('');
        setInvitePassword('');
        setInviteRole('level_10');

        setIsInviting(true);

        try {
            const { data, error } = await supabase.functions.invoke('invite-team-member', {
                body: {
                    email,
                    fullName,
                    password,
                    role,
                }
            });

            if (error) {
                let msg = error.message || "Failed to invite member";
                try {
                    if (error && typeof error === 'object' && 'context' in error) {
                        const response = (error as any).context;
                        if (response instanceof Response) {
                            const errorBody = await response.json();
                            if (errorBody?.error) msg = errorBody.error;
                        }
                    }
                } catch (e) { /* ignore parse errors */ }
                throw new Error(msg);
            }

            if (data?.error) throw new Error(data.error);

            if (!data?.userId) {
                throw new Error('Invite succeeded but userId was missing.');
            }

            // Replace the optimistic placeholder with the real user.
            replaceMemberOptimistic(tempId, {
                id: data.userId,
                email,
                full_name: fullName,
                phone: null,
                avatar_url: null,
                manager_id: null,
                created_at: new Date().toISOString(),
                role,
                is_pending: false,
            });

            toast({
                title: "Success",
                description: `${fullName} has been added as ${getRoleLabel(role)}.`,
            });
        } catch (err: any) {
            // Rollback optimistic row
            removeMemberOptimistic(tempId);
            toast({
                title: "Error",
                description: err.message || "Failed to invite member.",
                variant: "destructive"
            });
        } finally {
            setIsInviting(false);
        }
    };

    const handlePromote = async () => {
        if (!selectedMember || !selectedRole) return;

        setIsPromoting(true);
        const { error } = await promoteUser(selectedMember, selectedRole as AppRole);
        setIsPromoting(false);

        if (error) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        } else {
            toast({
                title: "Success",
                description: "User role updated successfully.",
            });
            setSelectedMember(null);
            setSelectedRole('');
        }
    };

    const handleSetManager = async (userId: string, managerId: string) => {
        const { error } = await setManager(userId, managerId || null);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to update manager.",
                variant: "destructive"
            });
        } else {
            toast({
                title: "Success",
                description: "Manager updated successfully.",
            });
        }
    };

    const handleDeleteMember = async () => {
        if (!memberToDelete) return;
        setIsDeleting(true);
        const finalReassignId = reassignToId === 'unassigned' ? null : (reassignToId || null);
        const { error } = await deleteMember(memberToDelete, finalReassignId);
        setIsDeleting(false);

        if (error) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        } else {
            toast({
                title: "Success",
                description: "Team member removed, and data reassigned successfully.",
            });
            setDeleteDialogOpen(false);
            setMemberToDelete(null);
            setSelectedMember(null); // Close the manage dialog too if needed, though state is separate
            setReassignToId('');
        }
    };

    const handleToggleStatus = async () => {
        if (!selectedMember) return;
        const member = members.find(m => m.id === selectedMember);
        if (!member) return;

        const shouldDeactivate = !member.is_deactivated;
        setIsTogglingStatus(true);
        const { error } = await toggleMemberStatus(selectedMember, shouldDeactivate);
        setIsTogglingStatus(false);

        if (error) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        } else {
            toast({
                title: "Success",
                description: shouldDeactivate
                    ? `${member.full_name || member.email} has been deactivated. They can no longer access the CRM.`
                    : `${member.full_name || member.email} has been reactivated. They can now log in again.`,
            });
            setDeactivateDialogOpen(false);
        }
    };

    // Sort members by role level
    const sortedMembers = [...members].sort((a, b) =>
        getRoleLevelNum(a.role) - getRoleLevelNum(b.role)
    );

    return (
        <>
            <div className="p-4 md:p-8 space-y-6 md:space-y-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Team Management</h1>
                        <p className="text-muted-foreground">Manage your organization hierarchy and roles.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        {currentUserRole === 'company' && (
                            <Dialog open={editHierarchyOpen} onOpenChange={setEditHierarchyOpen}>
                                <Button variant="outline" onClick={openEditHierarchy}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit Hierarchy
                                </Button>
                                <DialogContent className="max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>Edit Organization Hierarchy</DialogTitle>
                                        <DialogDescription>
                                            Customize the role names for your organization. Levels 1 & 2 are fixed.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-2 gap-4 items-center p-3 bg-muted/50 rounded-md">
                                            <div className="font-medium text-sm">Level 1 (Fixed)</div>
                                            <div className="text-sm font-bold">{getRoleLabel('company')}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 items-center p-3 bg-muted/50 rounded-md">
                                            <div className="font-medium text-sm">Level 2 (Fixed)</div>
                                            <div className="text-sm font-bold">{getRoleLabel('company_subadmin')}</div>
                                        </div>
                                        {Array.from({ length: 18 }, (_, i) => i + 3).map(level => {
                                            const key = `level_${level}`;
                                            return (
                                                <div key={key} className="flex items-center gap-4">
                                                    <div className="font-medium text-sm text-muted-foreground w-16 shrink-0">Level {level}</div>
                                                    <Input
                                                        value={hierarchyForm[key] || ''}
                                                        onChange={(e) => setHierarchyForm(prev => ({ ...prev, [key]: e.target.value }))}
                                                        placeholder={`Role Name for Level ${level}`}
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="shrink-0 text-muted-foreground hover:text-destructive"
                                                        onClick={() => setHierarchyForm(prev => ({ ...prev, [key]: '' }))}
                                                        title="Clear/Delete Role"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                        <Button className="w-full mt-4" onClick={handleSaveHierarchy} disabled={isSavingHierarchy}>
                                            {isSavingHierarchy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Save Changes
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                        {company && company.used_licenses >= company.total_licenses ? (
                            <Button
                                variant="destructive"
                                onClick={() => navigate('/dashboard/company')}
                                className="gap-2"
                            >
                                <Lock className="h-4 w-4" />
                                License Limit Exhausted, Buy Now
                            </Button>
                        ) : (
                            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gradient-primary">
                                        <UserPlus className="h-4 w-4 mr-2" />
                                        Invite Member
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Invite New Team Member</DialogTitle>
                                        <DialogDescription>
                                            Add a new member and assign their role in the organization.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 pt-4">
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Full Name</label>
                                            <Input
                                                placeholder="Enter full name"
                                                value={inviteFullName}
                                                onChange={(e) => setInviteFullName(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Email</label>
                                            <Input
                                                type="email"
                                                placeholder="Enter email address"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Role / Position</label>
                                            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {assignableRoles.map(role => {
                                                        const label = getRoleLabel(role);
                                                        if (!label) return null;
                                                        return (
                                                            <SelectItem key={role} value={role}>
                                                                {label}
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                You can only assign roles below your level.
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Temporary Password</label>
                                            <Input
                                                type="password"
                                                placeholder="Min 6 characters"
                                                value={invitePassword}
                                                onChange={(e) => setInvitePassword(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Share this password with the new member to let them log in.
                                            </p>
                                        </div>
                                        <Button
                                            className="w-full"
                                            onClick={handleInviteMember}
                                            disabled={isInviting}
                                        >
                                            {isInviting ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Mail className="h-4 w-4 mr-2" />
                                            )}
                                            Send Invitation
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Hierarchy Tree */}
                        <Card className="glass lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Organization Hierarchy</CardTitle>
                                <CardDescription>
                                    {currentUserRole && `Your role: ${getRoleLabel(currentUserRole)}`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 overflow-auto">
                                    {members.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No team members yet.
                                        </div>
                                    ) : (
                                        <OrgChart
                                            members={members}
                                            currentUserRole={currentUserRole}
                                            currentUserId={user?.id}
                                            getRoleLabel={getRoleLabel}
                                            getRoleLevelNum={getRoleLevelNum}
                                            onManage={(member) => {
                                                setSelectedMember(member.id);
                                                setSelectedRole('');
                                                setSelectedManager(member.manager_id || '');
                                            }}
                                        />
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Role Info */}
                        <Card className="glass h-fit">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Shield className="h-4 w-4 text-primary" />
                                    Role Hierarchy
                                </CardTitle>
                                <CardDescription className="text-xs">12-level access control</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-1.5 pt-0">
                                {Array.from({ length: 20 }, (_, i) => i + 1)
                                    .filter((level) => {
                                        let roleKey: AppRole | null = null;
                                        if (level === 1) roleKey = 'company';
                                        else if (level === 2) roleKey = 'company_subadmin';
                                        else roleKey = `level_${level}` as AppRole;

                                        return roleKey && getRoleLabel(roleKey);
                                    })
                                    .map((originalLevel, index) => {
                                        const displayIndex = index + 1;
                                        let roleKey: AppRole | null = null;
                                        if (originalLevel === 1) roleKey = 'company';
                                        else if (originalLevel === 2) roleKey = 'company_subadmin';
                                        else roleKey = `level_${originalLevel}` as AppRole;

                                        // Should be guaranteed by filter, but safe check
                                        if (!roleKey) return null;
                                        const label = getRoleLabel(roleKey);

                                        return (
                                            <div key={originalLevel} className="flex items-center gap-2 text-xs">
                                                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                                    {displayIndex}
                                                </span>
                                                <span className="font-medium truncate">{label}</span>
                                            </div>
                                        );
                                    })
                                }
                                <div className="pt-3 border-t border-border text-[11px] text-muted-foreground">
                                    <p>• New users start at lowest level (CA)</p>
                                    <p>• Only users above can promote others</p>
                                    <p>• Users see leads from their hierarchy</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Manage Member Dialog - Controlled by selectedMember state */}
                <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex flex-col gap-1">
                                <span>Manage {members.find(m => m.id === selectedMember)?.full_name}</span>
                                <span className="text-sm font-normal text-muted-foreground">
                                    ({members.find(m => m.id === selectedMember)?.email})
                                </span>
                            </DialogTitle>
                            <DialogDescription>
                                Update role or reporting structure
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    Promote to Role
                                </label>
                                <Select
                                    value={selectedRole}
                                    onValueChange={(v) => setSelectedRole(v as AppRole)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select new role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {selectedMember && assignableRoles
                                            .filter(role => {
                                                const member = members.find(m => m.id === selectedMember);
                                                return member && getRoleLevelNum(role) < getRoleLevelNum(member.role);
                                            })
                                            .map(role => {
                                                const label = getRoleLabel(role);
                                                if (!label) return null;
                                                return (
                                                    <SelectItem key={role} value={role}>
                                                        {label}
                                                    </SelectItem>
                                                );
                                            })
                                        }
                                    </SelectContent>
                                </Select>
                                <Button
                                    className="mt-2 w-full"
                                    disabled={!selectedRole || isPromoting}
                                    onClick={handlePromote}
                                >
                                    {isPromoting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Promote
                                </Button>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    Set Manager
                                </label>
                                <Select
                                    value={selectedManager || "no_manager"}
                                    onValueChange={(v) => {
                                        const newValue = v === "no_manager" ? "" : v;
                                        setSelectedManager(newValue);
                                        if (selectedMember) handleSetManager(selectedMember, newValue);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="no_manager">No Manager</SelectItem>
                                        {selectedMember && potentialManagers
                                            .filter(m => {
                                                const member = members.find(mem => mem.id === selectedMember);
                                                return member && m.id !== member.id && getRoleLevelNum(m.role) < getRoleLevelNum(member.role);
                                            })
                                            .map(m => (
                                                <SelectItem key={m.id} value={m.id}>
                                                    {m.full_name || m.email} ({getRoleLabel(m.role)})
                                                </SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4 border-t">
                                <label className="text-sm font-medium mb-2 block text-destructive">
                                    Danger Zone
                                </label>
                                <div className="space-y-3">
                                    {/* Deactivate / Reactivate */}
                                    {(() => {
                                        const member = members.find(m => m.id === selectedMember);
                                        const isDeactivated = member?.is_deactivated;
                                        return (
                                            <>
                                                <p className="text-xs text-muted-foreground">
                                                    {isDeactivated
                                                        ? "This user is currently deactivated and cannot access the CRM. Reactivate to restore access."
                                                        : "Deactivating a user will prevent them from logging in. Their data (leads, forms) will be preserved."}
                                                </p>
                                                <Button
                                                    variant={isDeactivated ? "default" : "outline"}
                                                    className={`w-full ${isDeactivated ? '' : 'border-warning text-warning hover:bg-warning/10'}`}
                                                    onClick={() => setDeactivateDialogOpen(true)}
                                                >
                                                    {isDeactivated ? (
                                                        <><UserCheck className="h-4 w-4 mr-2" /> Reactivate User</>
                                                    ) : (
                                                        <><UserX className="h-4 w-4 mr-2" /> Deactivate User</>
                                                    )}
                                                </Button>
                                            </>
                                        );
                                    })()}

                                    {/* Separator */}
                                    <div className="border-t" />

                                    <p className="text-xs text-muted-foreground">
                                        When removing a member permanently, you must choose what to do with their assigned leads and forms.
                                    </p>
                                    <Select
                                        value={reassignToId}
                                        onValueChange={(v) => setReassignToId(v)}
                                    >
                                        <SelectTrigger className="border-destructive/30 focus:ring-destructive">
                                            <SelectValue placeholder="Reassign data to..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Leave Unassigned</SelectItem>
                                            {members
                                                .filter(m => m.id !== selectedMember)
                                                .map(m => (
                                                    <SelectItem key={m.id} value={m.id}>
                                                        {m.full_name || m.email} ({getRoleLabel(m.role)})
                                                    </SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        variant="destructive"
                                        className="w-full"
                                        disabled={!reassignToId}
                                        onClick={() => {
                                            if (selectedMember) {
                                                setMemberToDelete(selectedMember);
                                                setDeleteDialogOpen(true);
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Remove Member
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the team member
                            and transfer any assigned leads and forms to {reassignToId === 'unassigned' ? 'nobody (Unassigned)' : 'the selected member'}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteMember();
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete user & transfer data"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Deactivate / Reactivate Confirmation */}
            <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {members.find(m => m.id === selectedMember)?.is_deactivated
                                ? 'Reactivate this user?'
                                : 'Deactivate this user?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {members.find(m => m.id === selectedMember)?.is_deactivated
                                ? 'This will restore their access to the CRM. They will be able to log in and use the system again.'
                                : 'This will immediately block the user from accessing the CRM. Their existing sessions will be terminated. All their data (leads, forms, hierarchy position) will be preserved.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleToggleStatus();
                            }}
                            className={members.find(m => m.id === selectedMember)?.is_deactivated
                                ? ''
                                : 'bg-warning text-warning-foreground hover:bg-warning/90'}
                        >
                            {isTogglingStatus
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : members.find(m => m.id === selectedMember)?.is_deactivated
                                    ? 'Yes, reactivate user'
                                    : 'Yes, deactivate user'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
