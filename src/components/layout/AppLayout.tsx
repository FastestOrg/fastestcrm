import { useNavigate, useLocation, useSearchParams, Outlet } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useCompany } from '@/hooks/useCompany';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutDashboard, Users, UserCheck, CreditCard, Settings, LogOut, Phone, Workflow, Link2, BarChart3, Brain, Calendar, FileText, Building2, Shield, Package, PieChart, Database, CheckSquare, AlertTriangle, Clock, ChevronDown, ChevronUp, Mail, PanelLeftClose, PanelLeftOpen, MessageCircle, Receipt, Sparkles, Wand2, ShieldCheck, Bot, Zap, Target, Heart, Globe, PhoneCall } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useTaskLeads } from '@/hooks/useTaskLeads';
import MobileBottomNav from './MobileBottomNav';
import { NotificationsBell } from './NotificationsBell';
import { AnnouncementBanner } from './AnnouncementBanner';
import { SubscriptionExpiredBanner } from '@/components/SubscriptionExpiredBanner';
import { SubscriptionExpiredGuard } from '@/components/SubscriptionExpiredGuard';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import SEO from '@/components/SEO';

type NavSection = 'FastBoard' | 'FastestAI' | 'FastEngage' | 'Data Enrichment' | 'Accounts';

interface NavItem {
    icon: any;
    label: string;
    path: string;
    section: NavSection;
    industryOnly?: string | string[];
    industryExclude?: string | string[];
    adminOnly?: boolean;
}

const navItems: NavItem[] = [{
    icon: LayoutDashboard,
    label: 'Dashboard',
    path: '/dashboard',
    section: 'FastBoard'
}, {
    icon: BarChart3,
    label: 'LG Dashboard',
    path: '/dashboard/lg',
    section: 'FastBoard'
}, {
    icon: Users,
    label: 'All Leads',
    path: '/dashboard/leads',
    section: 'FastBoard'
}, {
    icon: UserCheck,
    label: 'Interested',
    path: '/dashboard/interested',
    section: 'FastBoard'
}, {
    icon: CreditCard,
    label: 'Paid',
    path: '/dashboard/paid',
    section: 'FastBoard'
}, {
    icon: Calendar,
    label: 'Pending Payments',
    path: '/dashboard/pending',
    section: 'FastBoard'
}, {
    icon: Users,
    label: 'Lead Profiling',
    path: '/dashboard/lead-profiling',
    industryOnly: ['real_estate', 'insurance'],
    section: 'FastBoard'
}, {
    icon: Building2,
    label: 'Properties',
    path: '/dashboard/properties',
    industryOnly: 'real_estate',
    section: 'FastBoard'
}, {
    icon: Shield,
    label: 'Insurance Plans',
    path: '/dashboard/insurance-plans',
    industryOnly: 'insurance',
    section: 'FastBoard'
}, {
    icon: FileText,
    label: 'Quotations',
    path: '/dashboard/quotations',
    section: 'FastBoard'
}, {
    icon: Receipt,
    label: 'Invoices',
    path: '/dashboard/invoices',
    section: 'FastBoard'
}, {
    icon: Phone,
    label: 'Auto Dialer',
    path: '/dashboard/dialer',
    section: 'FastEngage'
}, {
    icon: FileText,
    label: 'Forms',
    path: '/dashboard/forms',
    section: 'FastEngage'
}, {
    icon: Mail,
    label: 'FastSend',
    path: '/dashboard/fastsend',
    section: 'FastEngage'
}, {
    icon: MessageCircle,
    label: 'WhatsApp Campaign',
    path: '/dashboard/whatsapp',
    section: 'FastEngage'
}, {
    icon: Calendar,
    label: 'Calendar',
    path: '/dashboard/calendar',
    section: 'FastEngage'
}, {
    icon: PhoneCall,
    label: 'AI Caller',
    path: '/dashboard/ai-caller',
    section: 'FastEngage'
}, {
    icon: Globe,
    label: 'Landing Pages',
    path: '/dashboard/landing-pages',
    section: 'FastEngage'
}, {
    icon: ShieldCheck,
    label: 'Mission Control',
    path: '/dashboard/ai-mission-control',
    section: 'FastestAI'
}, {
    icon: Bot,
    label: 'AI Agent Hub',
    path: '/dashboard/fastest-ai',
    section: 'FastestAI'
}, {
    icon: Zap,
    label: 'Agentic Workflows',
    path: '/dashboard/agentic-workflows',
    section: 'FastestAI'
}, {
    icon: Target,
    label: 'Deal Intelligence',
    path: '/dashboard/deal-intelligence',
    section: 'FastestAI'
}, {
    icon: BarChart3,
    label: 'Revenue Forecast',
    path: '/dashboard/revenue-forecast',
    section: 'FastestAI'
}, {
    icon: Heart,
    label: 'Customer Health',
    path: '/dashboard/customer-health',
    section: 'FastestAI'
}, {
    icon: Sparkles,
    label: 'Personalization',
    path: '/dashboard/personalization',
    section: 'FastestAI'
}, {
    icon: Wand2,
    label: 'AI Growth Hacker',
    path: '/dashboard/ai-growth-hacker',
    section: 'FastestAI'
}, {
    icon: Sparkles,
    label: 'AI Closing Assistant',
    path: '/dashboard/ai-closing',
    section: 'FastestAI'
}, {
    icon: ShieldCheck,
    label: 'AI Ops Center',
    path: '/dashboard/ai-ops',
    section: 'FastestAI'
}, {
    icon: Globe,
    label: 'Fastest Scout',
    path: '/dashboard/fastest-scout',
    section: 'FastestAI'
}, {
    icon: Users,
    label: 'AI Employees',
    path: '/dashboard/ai-employees',
    section: 'FastestAI'
}, {
    icon: Brain,
    label: 'AI Insights',
    path: '/dashboard/ai',
    section: 'FastestAI'
}, {
    icon: PieChart,
    label: 'Report',
    path: '/dashboard/report',
    section: 'Data Enrichment'
}, {
    icon: Database,
    label: 'Big Data SQL',
    path: '/dashboard/bigdata-sql',
    adminOnly: true,
    section: 'Data Enrichment'
}, {
    icon: Users,
    label: 'Team',
    path: '/dashboard/team',
    section: 'Accounts'
}, {
    icon: Package,
    label: 'Statuses',
    path: '/dashboard/statuses',
    section: 'Accounts'
}, {
    icon: Workflow,
    label: 'Automations',
    path: '/dashboard/automations',
    section: 'Accounts'
}, {
    icon: Package,
    label: 'Products',
    path: '/dashboard/products',
    industryExclude: ['real_estate', 'insurance'],
    section: 'Accounts'
}, {
    icon: Link2,
    label: 'Integrations',
    path: '/dashboard/integrations',
    section: 'Accounts'
}, {
    icon: Building2,
    label: 'Manage Company',
    path: '/dashboard/company',
    section: 'Accounts'
}, {
    icon: Settings,
    label: 'Settings',
    path: '/dashboard/settings',
    section: 'Accounts'
}, {
    icon: Receipt,
    label: 'Invoice Settings',
    path: '/dashboard/invoice-settings',
    section: 'Accounts'
}];

export default function AppLayout() {
    const {
        user,
        profile,
        loading,
        signOut
    } = useAuth();
    const {
        data: role
    } = useUserRole();
    const {
        company,
        isCompanyAdmin
    } = useCompany();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const isMobile = useIsMobile();
    const [tasksExpanded, setTasksExpanded] = useState(location.pathname.startsWith('/dashboard/tasks'));
    const [fastestAiExpanded, setFastestAiExpanded] = useState(() => {
        return navItems
            .filter(item => item.section === 'FastestAI')
            .some(item => location.pathname === item.path);
    });
    const [fastEngageExpanded, setFastEngageExpanded] = useState(() => {
        return navItems
            .filter(item => item.section === 'FastEngage')
            .some(item => location.pathname === item.path) ||
            (location.pathname === '/dashboard/email' || location.pathname === '/dashboard/email-settings');
    });
    const [dataEnrichmentExpanded, setDataEnrichmentExpanded] = useState(() => {
        return navItems
            .filter(item => item.section === 'Data Enrichment')
            .some(item => location.pathname === item.path);
    });
    const [accountsExpanded, setAccountsExpanded] = useState(() => {
        return navItems
            .filter(item => item.section === 'Accounts')
            .some(item => location.pathname === item.path);
    });
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const stored = localStorage.getItem('sidebar-collapsed');
        return stored ? JSON.parse(stored) : false;
    });

    const toggleSidebar = () => {
        setIsCollapsed((prev: boolean) => {
            const newState = !prev;
            localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
            if (newState) {
                setTasksExpanded(false);
            }
            return newState;
        });
    };

    const { urgent: urgentLeads, today: todayLeads, upcoming: upcomingLeads, isLoading: tasksLoading } = useTaskLeads();
    const taskCounts = { urgent: urgentLeads.length, today: todayLeads.length, upcoming: upcomingLeads.length };
    const totalTaskCount = taskCounts.urgent + taskCounts.today + taskCounts.upcoming;

    // Check if email dashboard is enabled for this company
    const { data: emailIntegration } = useQuery({
        queryKey: ['email-integration-nav', company?.id],
        queryFn: async () => {
            if (!company?.id) return null;
            const { data } = await supabase
                .from('email_integrations' as any)
                .select('email_dashboard_enabled, is_active')
                .eq('company_id', company.id)
                .maybeSingle();
            return data as any;
        },
        enabled: !!company?.id,
        staleTime: 1000 * 60 * 5,
    });
    const emailDashboardEnabled = emailIntegration?.email_dashboard_enabled && emailIntegration?.is_active;

    const isTasksActive = location.pathname.startsWith('/dashboard/tasks');
    const activeTaskTab = searchParams.get('tab') || 'today';

    useEffect(() => {
        if (!loading && !user) {
            navigate('/auth');
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        const isFastestAiActive = navItems
            .filter(item => item.section === 'FastestAI')
            .some(item => location.pathname === item.path);
        if (isFastestAiActive) {
            setFastestAiExpanded(true);
        }

        const isFastEngageActive = navItems
            .filter(item => item.section === 'FastEngage')
            .some(item => location.pathname === item.path) ||
            (location.pathname === '/dashboard/email' || location.pathname === '/dashboard/email-settings');
        if (isFastEngageActive) {
            setFastEngageExpanded(true);
        }

        const isDataEnrichmentActive = navItems
            .filter(item => item.section === 'Data Enrichment')
            .some(item => location.pathname === item.path);
        if (isDataEnrichmentActive) {
            setDataEnrichmentExpanded(true);
        }

        const isAccountsActive = navItems
            .filter(item => item.section === 'Accounts')
            .some(item => location.pathname === item.path);
        if (isAccountsActive) {
            setAccountsExpanded(true);
        }
    }, [location.pathname]);

    const companyIndustry = (company as any)?.industry;
    const filteredNavItems = navItems.filter(item => {
        // Industry-specific filtering
        const industryOnly = (item as any).industryOnly;
        if (industryOnly) {
            if (Array.isArray(industryOnly)) {
                if (!industryOnly.includes(companyIndustry)) return false;
            } else if (industryOnly !== companyIndustry) return false;
        }
        const industryExclude = (item as any).industryExclude;
        if (industryExclude) {
            if (Array.isArray(industryExclude)) {
                if (industryExclude.includes(companyIndustry)) return false;
            } else if (industryExclude === companyIndustry) return false;
        }

        if (item.label === 'Integrations') {
            return role === 'company' || role === 'company_subadmin';
        }
        if (item.label === 'Products' || item.label === 'Properties' || item.label === 'Insurance Plans') {
            return role === 'company' || role === 'company_subadmin' || isCompanyAdmin;
        }
        if (item.label === 'Lead Profiling') {
            return role === 'company' || role === 'company_subadmin' || isCompanyAdmin;
        }
        if (item.label === 'Manage Company') {
            return role === 'company' || role === 'company_subadmin' || isCompanyAdmin;
        }
        if (item.label === 'Statuses') {
            return role === 'company' || role === 'company_subadmin' || isCompanyAdmin;
        }
        if (item.label === 'Big Data SQL') {
            return isCompanyAdmin;
        }
        return true;
    });

    if (loading) {
        return <div className="min-h-screen bg-background flex">
            {!isMobile && <div className="w-64 bg-sidebar border-r border-sidebar-border p-4">
                <Skeleton className="h-10 w-full mb-8" />
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full mb-2" />)}
            </div>}
            <div className="flex-1 p-4 md:p-8">
                <Skeleton className="h-10 w-64 mb-8" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
                </div>
            </div>
        </div>;
    }

    if (!user) return null;

    return <TooltipProvider delayDuration={0}>
        <SEO noindex={true} title="Dashboard" />
        <div className="h-screen overflow-hidden bg-background flex">
            {/* Desktop Sidebar */}
            {!isMobile && <aside className={`${isCollapsed ? 'w-20' : 'w-64'} transition-all duration-300 ease-in-out bg-sidebar border-r border-sidebar-border flex flex-col shrink-0`}>
                <div className={`p-4 border-b border-sidebar-border flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
                    <div className="flex items-center gap-3 w-full">
                        {company?.logo_url ? (
                            <img
                                src={company.logo_url}
                                alt={company.name}
                                className="w-10 h-10 rounded-lg object-cover bg-white shrink-0 mx-auto"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shrink-0 mx-auto">
                                <span className="text-lg font-bold text-primary-foreground">
                                    {company?.name?.[0] || 'Up'}
                                </span>
                            </div>
                        )}
                        {!isCollapsed && (
                            <div className="min-w-0 flex-1">
                                <h1 className="font-semibold text-sidebar-foreground truncate" style={{ fontFamily: "'Syne', sans-serif" }}>
                                    {company?.name || 'Fastest CRM'}
                                </h1>
                                <p className="text-[10px] text-muted-foreground truncate">Fastest CRM by Upmarking.com</p>
                            </div>
                        )}
                        {!isCollapsed && (
                            <div className="ml-auto shrink-0 flex items-center gap-2">
                                <NotificationsBell />
                                <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground bg-sidebar-accent/50">
                                    <PanelLeftClose className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                    {isCollapsed && (
                        <div className="mt-2 text-center w-full flex flex-col items-center justify-center gap-2">
                            <NotificationsBell />
                            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground bg-sidebar-accent/50">
                                <PanelLeftOpen className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>

                <nav className="flex-1 p-3 space-y-4 overflow-y-auto overflow-x-hidden">
                    {(['FastBoard', 'FastestAI', 'FastEngage', 'Data Enrichment', 'Accounts'] as NavSection[]).map(section => {
                        const sectionItems = filteredNavItems.filter((item: any) => item.section === section);
                        const hasEmailItems = section === 'FastEngage' && emailDashboardEnabled;
                        const hasTasksItems = section === 'FastBoard';
                        
                        if (sectionItems.length === 0 && !hasEmailItems && !hasTasksItems) return null;

                        // Custom dropdown design for FastestAI
                        if (section === 'FastestAI') {
                            const isAnyFastestAiActive = sectionItems.some((item: any) => location.pathname === item.path);
                            
                            if (isCollapsed) {
                                return (
                                    <div key={section} className="space-y-1">
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => {
                                                        setIsCollapsed(false);
                                                        localStorage.setItem('sidebar-collapsed', 'false');
                                                        setFastestAiExpanded(true);
                                                    }}
                                                    className={`w-full flex items-center justify-center py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer relative group ${
                                                        isAnyFastestAiActive 
                                                            ? 'bg-purple-500/10 text-purple-400' 
                                                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                                    }`}
                                                >
                                                    <div className="relative">
                                                        <Sparkles className={`h-4 w-4 ${isAnyFastestAiActive ? 'text-purple-400 animate-pulse' : 'text-muted-foreground group-hover:text-purple-400 group-hover:animate-pulse transition-colors'}`} />
                                                        {isAnyFastestAiActive && (
                                                            <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500"></span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" sideOffset={10}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-semibold text-purple-400">FastestAI</span>
                                                    <span className="text-xs text-muted-foreground font-normal">Click to expand AI features</span>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                );
                            }

                            return (
                                <div key={section} className="space-y-1.5 pb-1">
                                    <button
                                        onClick={() => setFastestAiExpanded(prev => !prev)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-wider rounded-lg transition-all duration-300 group cursor-pointer border ${
                                            fastestAiExpanded 
                                                ? 'bg-purple-500/5 border-purple-500/10 text-purple-300' 
                                                : 'border-transparent text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Sparkles className={`h-3.5 w-3.5 transition-all duration-300 ${
                                                fastestAiExpanded 
                                                    ? 'text-purple-400 scale-110 rotate-12 animate-pulse' 
                                                    : 'text-muted-foreground group-hover:text-purple-400 group-hover:scale-110 group-hover:rotate-12'
                                            }`} />
                                            <span style={{ fontFamily: "'Syne', sans-serif" }} className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent font-bold tracking-wider whitespace-nowrap">
                                                FASTEST AI
                                            </span>
                                            {isAnyFastestAiActive && !fastestAiExpanded && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border transition-all duration-300 leading-none ${
                                                fastestAiExpanded 
                                                    ? 'text-purple-300 bg-purple-500/20 border-purple-500/30' 
                                                    : 'text-purple-400 bg-purple-500/10 border-purple-500/20 group-hover:bg-purple-500/20'
                                            }`}>
                                                {sectionItems.length}
                                            </span>
                                            {fastestAiExpanded ? (
                                                <ChevronUp className="h-3.5 w-3.5 text-purple-400/80 transition-transform duration-300" />
                                            ) : (
                                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300" />
                                            )}
                                        </div>
                                    </button>

                                    {fastestAiExpanded && (
                                        <div className="mt-1 ml-3 border-l border-purple-500/20 pl-3 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {sectionItems.map((item: any) => (
                                                <button
                                                    key={item.label}
                                                    onClick={() => navigate(item.path)}
                                                    className={`w-full flex items-center gap-2.5 py-2 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                                                        location.pathname === item.path
                                                            ? 'bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-purple-500 -ml-[13px] pl-3 shadow-sm shadow-purple-500/5'
                                                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l border-transparent px-3'
                                                    }`}
                                                >
                                                    <item.icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${location.pathname === item.path ? 'text-purple-400' : 'text-muted-foreground'}`} />
                                                    <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                                                    {item.label === 'Big Data SQL' && (
                                                        <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full shrink-0 scale-90">New</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // Custom dropdown design for FastEngage
                        if (section === 'FastEngage') {
                            const isEmailActive = location.pathname === '/dashboard/email' || location.pathname === '/dashboard/email-settings';
                            const isAnyFastEngageActive = sectionItems.some((item: any) => location.pathname === item.path) || isEmailActive;
                            const emailItemsCount = emailDashboardEnabled ? (isCompanyAdmin ? 2 : 1) : 0;
                            const totalEngageItemsCount = sectionItems.length + emailItemsCount;

                            if (isCollapsed) {
                                return (
                                    <div key={section} className="space-y-1">
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => {
                                                        setIsCollapsed(false);
                                                        localStorage.setItem('sidebar-collapsed', 'false');
                                                        setFastEngageExpanded(true);
                                                    }}
                                                    className={`w-full flex items-center justify-center py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer relative group ${
                                                        isAnyFastEngageActive 
                                                            ? 'bg-teal-500/10 text-teal-400' 
                                                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                                    }`}
                                                >
                                                    <div className="relative">
                                                        <Zap className={`h-4 w-4 ${isAnyFastEngageActive ? 'text-teal-400 animate-pulse' : 'text-muted-foreground group-hover:text-teal-400 group-hover:animate-pulse transition-colors'}`} />
                                                        {isAnyFastEngageActive && (
                                                            <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-500"></span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" sideOffset={10}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-semibold text-teal-400">FastEngage</span>
                                                    <span className="text-xs text-muted-foreground font-normal">Click to expand engagement features</span>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                );
                            }

                            return (
                                <div key={section} className="space-y-1.5 pb-1">
                                    <button
                                        onClick={() => setFastEngageExpanded(prev => !prev)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-wider rounded-lg transition-all duration-300 group cursor-pointer border ${
                                            fastEngageExpanded 
                                                ? 'bg-teal-500/5 border-teal-500/10 text-teal-300' 
                                                : 'border-transparent text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Zap className={`h-3.5 w-3.5 transition-all duration-300 ${
                                                fastEngageExpanded 
                                                    ? 'text-teal-400 scale-110 rotate-12 animate-pulse' 
                                                    : 'text-muted-foreground group-hover:text-teal-400 group-hover:scale-110 group-hover:rotate-12'
                                            }`} />
                                            <span style={{ fontFamily: "'Syne', sans-serif" }} className="bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400 bg-clip-text text-transparent font-bold tracking-wider whitespace-nowrap">
                                                FAST ENGAGE
                                            </span>
                                            {isAnyFastEngageActive && !fastEngageExpanded && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border transition-all duration-300 leading-none ${
                                                fastEngageExpanded 
                                                    ? 'text-teal-300 bg-teal-500/20 border-teal-500/30' 
                                                    : 'text-teal-400 bg-teal-500/10 border-teal-500/20 group-hover:bg-teal-500/20'
                                            }`}>
                                                {totalEngageItemsCount}
                                            </span>
                                            {fastEngageExpanded ? (
                                                <ChevronUp className="h-3.5 w-3.5 text-teal-400/80 transition-transform duration-300" />
                                            ) : (
                                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300" />
                                            )}
                                        </div>
                                    </button>

                                    {fastEngageExpanded && (
                                        <div className="mt-1 ml-3 border-l border-teal-500/20 pl-3 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {sectionItems.map((item: any) => (
                                                <button
                                                    key={item.label}
                                                    onClick={() => navigate(item.path)}
                                                    className={`w-full flex items-center gap-2.5 py-2 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                                                        location.pathname === item.path
                                                            ? 'bg-teal-500/15 text-teal-300 font-semibold border-l-2 border-teal-500 -ml-[13px] pl-3 shadow-sm shadow-teal-500/5'
                                                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l border-transparent px-3'
                                                    }`}
                                                >
                                                    <item.icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${location.pathname === item.path ? 'text-teal-400' : 'text-muted-foreground'}`} />
                                                    <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                                                </button>
                                            ))}

                                            {/* Dynamic Email nav items */}
                                            {emailDashboardEnabled && (
                                                <>
                                                    <button
                                                        onClick={() => navigate('/dashboard/email')}
                                                        className={`w-full flex items-center gap-2.5 py-2 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                                                            location.pathname === '/dashboard/email'
                                                                ? 'bg-teal-500/15 text-teal-300 font-semibold border-l-2 border-teal-500 -ml-[13px] pl-3 shadow-sm shadow-teal-500/5'
                                                                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l border-transparent px-3'
                                                        }`}
                                                    >
                                                        <Mail className={`h-3.5 w-3.5 shrink-0 transition-colors ${location.pathname === '/dashboard/email' ? 'text-teal-400' : 'text-muted-foreground'}`} />
                                                        <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">Email</span>
                                                    </button>
                                                    {isCompanyAdmin && (
                                                        <button
                                                            onClick={() => navigate('/dashboard/email-settings')}
                                                            className={`w-full flex items-center gap-2.5 py-2 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                                                                location.pathname === '/dashboard/email-settings'
                                                                    ? 'bg-teal-500/15 text-teal-300 font-semibold border-l-2 border-teal-500 -ml-[13px] pl-3 shadow-sm shadow-teal-500/5'
                                                                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l border-transparent px-3'
                                                            }`}
                                                        >
                                                            <Mail className={`h-3.5 w-3.5 shrink-0 transition-colors ${location.pathname === '/dashboard/email-settings' ? 'text-teal-400' : 'text-muted-foreground'}`} />
                                                            <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">Email Settings</span>
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // Custom dropdown design for Data Enrichment
                        if (section === 'Data Enrichment') {
                            const isAnyDataEnrichmentActive = sectionItems.some((item: any) => location.pathname === item.path);

                            if (isCollapsed) {
                                return (
                                    <div key={section} className="space-y-1">
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => {
                                                        setIsCollapsed(false);
                                                        localStorage.setItem('sidebar-collapsed', 'false');
                                                        setDataEnrichmentExpanded(true);
                                                    }}
                                                    className={`w-full flex items-center justify-center py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer relative group ${
                                                        isAnyDataEnrichmentActive 
                                                            ? 'bg-emerald-500/10 text-emerald-400' 
                                                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                                    }`}
                                                >
                                                    <div className="relative">
                                                        <Database className={`h-4 w-4 ${isAnyDataEnrichmentActive ? 'text-emerald-400 animate-pulse' : 'text-muted-foreground group-hover:text-emerald-400 group-hover:animate-pulse transition-colors'}`} />
                                                        {isAnyDataEnrichmentActive && (
                                                            <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" sideOffset={10}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-semibold text-emerald-400">Data Enrichment</span>
                                                    <span className="text-xs text-muted-foreground font-normal">Click to expand data tools</span>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                );
                            }

                            return (
                                <div key={section} className="space-y-1.5 pb-1">
                                    <button
                                        onClick={() => setDataEnrichmentExpanded(prev => !prev)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-wider rounded-lg transition-all duration-300 group cursor-pointer border ${
                                            dataEnrichmentExpanded 
                                                ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-300' 
                                                : 'border-transparent text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Database className={`h-3.5 w-3.5 transition-all duration-300 ${
                                                dataEnrichmentExpanded 
                                                    ? 'text-emerald-400 scale-110 rotate-12 animate-pulse' 
                                                    : 'text-muted-foreground group-hover:text-emerald-400 group-hover:scale-110 group-hover:rotate-12'
                                            }`} />
                                            <span style={{ fontFamily: "'Syne', sans-serif" }} className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent font-bold tracking-wider whitespace-nowrap">
                                                DATA ENRICHMENT
                                            </span>
                                            {isAnyDataEnrichmentActive && !dataEnrichmentExpanded && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border transition-all duration-300 leading-none ${
                                                dataEnrichmentExpanded 
                                                    ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/30' 
                                                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20'
                                            }`}>
                                                {sectionItems.length}
                                            </span>
                                            {dataEnrichmentExpanded ? (
                                                <ChevronUp className="h-3.5 w-3.5 text-emerald-400/80 transition-transform duration-300" />
                                            ) : (
                                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300" />
                                            )}
                                        </div>
                                    </button>

                                    {dataEnrichmentExpanded && (
                                        <div className="mt-1 ml-3 border-l border-emerald-500/20 pl-3 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {sectionItems.map((item: any) => (
                                                <button
                                                    key={item.label}
                                                    onClick={() => navigate(item.path)}
                                                    className={`w-full flex items-center gap-2.5 py-2 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                                                        location.pathname === item.path
                                                            ? 'bg-emerald-500/15 text-emerald-300 font-semibold border-l-2 border-emerald-500 -ml-[13px] pl-3 shadow-sm shadow-emerald-500/5'
                                                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l border-transparent px-3'
                                                    }`}
                                                >
                                                    <item.icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${location.pathname === item.path ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                                                    <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                                                    {item.label === 'Big Data SQL' && (
                                                        <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full shrink-0 scale-90">New</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // Custom dropdown design for Accounts
                        if (section === 'Accounts') {
                            const isAnyAccountsActive = sectionItems.some((item: any) => location.pathname === item.path);

                            if (isCollapsed) {
                                return (
                                    <div key={section} className="space-y-1">
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => {
                                                        setIsCollapsed(false);
                                                        localStorage.setItem('sidebar-collapsed', 'false');
                                                        setAccountsExpanded(true);
                                                    }}
                                                    className={`w-full flex items-center justify-center py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer relative group ${
                                                        isAnyAccountsActive 
                                                            ? 'bg-amber-500/10 text-amber-400' 
                                                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                                    }`}
                                                >
                                                    <div className="relative">
                                                        <Settings className={`h-4 w-4 ${isAnyAccountsActive ? 'text-amber-400 animate-pulse' : 'text-muted-foreground group-hover:text-amber-400 group-hover:animate-pulse transition-colors'}`} />
                                                        {isAnyAccountsActive && (
                                                            <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" sideOffset={10}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-semibold text-amber-400">Accounts</span>
                                                    <span className="text-xs text-muted-foreground font-normal">Click to expand accounts & settings</span>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                );
                            }

                            return (
                                <div key={section} className="space-y-1.5 pb-1">
                                    <button
                                        onClick={() => setAccountsExpanded(prev => !prev)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-wider rounded-lg transition-all duration-300 group cursor-pointer border ${
                                            accountsExpanded 
                                                ? 'bg-amber-500/5 border-amber-500/10 text-amber-300' 
                                                : 'border-transparent text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Settings className={`h-3.5 w-3.5 transition-all duration-300 ${
                                                accountsExpanded 
                                                    ? 'text-amber-400 scale-110 rotate-12 animate-pulse' 
                                                    : 'text-muted-foreground group-hover:text-amber-400 group-hover:scale-110 group-hover:rotate-12'
                                            }`} />
                                            <span style={{ fontFamily: "'Syne', sans-serif" }} className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent font-bold tracking-wider whitespace-nowrap">
                                                ACCOUNTS
                                            </span>
                                            {isAnyAccountsActive && !accountsExpanded && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border transition-all duration-300 leading-none ${
                                                accountsExpanded 
                                                    ? 'text-amber-300 bg-amber-500/20 border-amber-500/30' 
                                                    : 'text-amber-400 bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20'
                                            }`}>
                                                {sectionItems.length}
                                            </span>
                                            {accountsExpanded ? (
                                                <ChevronUp className="h-3.5 w-3.5 text-amber-400/80 transition-transform duration-300" />
                                            ) : (
                                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300" />
                                            )}
                                        </div>
                                    </button>

                                    {accountsExpanded && (
                                        <div className="mt-1 ml-3 border-l border-amber-500/20 pl-3 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {sectionItems.map((item: any) => (
                                                <button
                                                    key={item.label}
                                                    onClick={() => navigate(item.path)}
                                                    className={`w-full flex items-center gap-2.5 py-2 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
                                                        location.pathname === item.path
                                                            ? 'bg-amber-500/15 text-amber-300 font-semibold border-l-2 border-amber-500 -ml-[13px] pl-3 shadow-sm shadow-amber-500/5'
                                                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l border-transparent px-3'
                                                    }`}
                                                >
                                                    <item.icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${location.pathname === item.path ? 'text-amber-400' : 'text-muted-foreground'}`} />
                                                    <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div key={section} className="space-y-1">
                                {!isCollapsed && (
                                    <h3 className="px-3 pb-2 pt-2 text-xs font-semibold text-muted-foreground tracking-wider">
                                        {section}
                                    </h3>
                                )}
                                
                                {sectionItems.map((item: any) => (
                                    <React.Fragment key={item.label}>
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => navigate(item.path)}
                                                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer ${(location.pathname === item.path && !(isTasksActive && (item.label === 'Dashboard' || item.label === 'LG Dashboard')))
                                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary'
                                                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l-2 border-transparent'
                                                        }`}
                                                >
                                                    <item.icon className={`h-4 w-4 shrink-0 transition-colors ${(location.pathname === item.path && !(isTasksActive && (item.label === 'Dashboard' || item.label === 'LG Dashboard'))) ? 'text-primary' : ''}`} />
                                                    {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>}
                                                    {!isCollapsed && item.label === 'Big Data SQL' && (
                                                        <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full shrink-0">New</span>
                                                    )}
                                                    {isCollapsed && item.label === 'Big Data SQL' && (
                                                        <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-500" />
                                                    )}
                                                </button>
                                            </TooltipTrigger>
                                            {isCollapsed && <TooltipContent side="right" sideOffset={10}>{item.label}</TooltipContent>}
                                        </Tooltip>

                                        {/* Insert Tasks exactly after LG Dashboard */}
                                        {item.label === 'LG Dashboard' && (
                                            <div>
                                                <Tooltip delayDuration={0}>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => {
                                                                if (isCollapsed) {
                                                                    toggleSidebar();
                                                                    setTasksExpanded(true);
                                                                } else {
                                                                    setTasksExpanded(prev => !prev);
                                                                }
                                                                if (!isTasksActive) navigate(`/dashboard/tasks?tab=${activeTaskTab}`);
                                                            }}
                                                            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0 flex-col py-1.5' : 'gap-3 px-3 py-2.5'} rounded-lg text-sm transition-colors cursor-pointer relative ${isTasksActive
                                                                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                                                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-center shrink-0">
                                                                <CheckSquare className="h-4 w-4" />
                                                                {isCollapsed && !tasksLoading && totalTaskCount > 0 && (
                                                                    <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-primary" />
                                                                )}
                                                            </div>
                                                            {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">Tasks</span>}
                                                            {!isCollapsed && !tasksLoading && totalTaskCount > 0 && (
                                                                <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[20px] text-center shrink-0">
                                                                    {totalTaskCount}
                                                                </span>
                                                            )}
                                                            {!isCollapsed && (tasksExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-1 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 ml-1 shrink-0" />)}
                                                        </button>
                                                    </TooltipTrigger>
                                                    {isCollapsed && <TooltipContent side="right" sideOffset={10}>
                                                        <div className="flex items-center gap-2">
                                                            Tasks {!tasksLoading && totalTaskCount > 0 && `(${totalTaskCount})`}
                                                        </div>
                                                    </TooltipContent>}
                                                </Tooltip>

                                                {/* Sub-items */}
                                                {!isCollapsed && tasksExpanded && (
                                                    <div className="mt-0.5 ml-3 border-l border-sidebar-border pl-3 space-y-0.5 overflow-hidden">
                                                        {/** Urgent */}
                                                        <button
                                                            onClick={() => navigate('/dashboard/tasks?tab=urgent')}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${isTasksActive && activeTaskTab === 'urgent'
                                                                ? 'bg-red-500/20 text-red-400'
                                                                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                                                }`}
                                                        >
                                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                            <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">Urgent</span>
                                                            {!tasksLoading && taskCounts.urgent > 0 && (
                                                                <span className="text-xs font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                                                                    {taskCounts.urgent}
                                                                </span>
                                                            )}
                                                        </button>

                                                        {/** Today */}
                                                        <button
                                                            onClick={() => navigate('/dashboard/tasks?tab=today')}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${isTasksActive && activeTaskTab === 'today'
                                                                ? 'bg-amber-500/20 text-amber-400'
                                                                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                                                }`}
                                                        >
                                                            <Clock className="h-3.5 w-3.5 shrink-0" />
                                                            <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">Today</span>
                                                            {!tasksLoading && taskCounts.today > 0 && (
                                                                <span className="text-xs font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                                                                    {taskCounts.today}
                                                                </span>
                                                            )}
                                                        </button>

                                                        {/** Upcoming */}
                                                        <button
                                                            onClick={() => navigate('/dashboard/tasks?tab=upcoming')}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${isTasksActive && activeTaskTab === 'upcoming'
                                                                ? 'bg-blue-500/20 text-blue-400'
                                                                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                                                }`}
                                                        >
                                                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                                                            <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">Upcoming</span>
                                                            {!tasksLoading && taskCounts.upcoming > 0 && (
                                                                <span className="text-xs font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                                                                    {taskCounts.upcoming}
                                                                </span>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </React.Fragment>
                                ))}

                                {/* Email nav items - only visible when email dashboard is enabled */}
                                {hasEmailItems && (
                                    <>
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => navigate('/dashboard/email')}
                                                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer ${location.pathname === '/dashboard/email'
                                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary'
                                                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l-2 border-transparent'
                                                        }`}
                                                >
                                                    <Mail className={`h-4 w-4 shrink-0 transition-colors ${location.pathname === '/dashboard/email' ? 'text-primary' : ''}`} />
                                                    {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">Email</span>}
                                                </button>
                                            </TooltipTrigger>
                                            {isCollapsed && <TooltipContent side="right" sideOffset={10}>Email</TooltipContent>}
                                        </Tooltip>
                                        {isCompanyAdmin && (
                                            <Tooltip delayDuration={0}>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={() => navigate('/dashboard/email-settings')}
                                                        className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer ${location.pathname === '/dashboard/email-settings'
                                                            ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary'
                                                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l-2 border-transparent'
                                                            }`}
                                                    >
                                                        <Mail className={`h-4 w-4 shrink-0 transition-colors ${location.pathname === '/dashboard/email-settings' ? 'text-primary' : ''}`} />
                                                        {!isCollapsed && <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">Email Settings</span>}
                                                    </button>
                                                </TooltipTrigger>
                                                {isCollapsed && <TooltipContent side="right" sideOffset={10}>Email Settings</TooltipContent>}
                                            </Tooltip>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-sidebar-border">
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 mb-4'} `}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center ring-2 ring-primary/30 shrink-0 cursor-default">
                                    <span className="text-sm font-bold" style={{ color: 'hsl(222 28% 5%)' }}>
                                        {user.email?.[0].toUpperCase()}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            {isCollapsed && <TooltipContent side="right" sideOffset={10}>{user.email}</TooltipContent>}
                        </Tooltip>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate text-sidebar-foreground">
                                    {profile?.full_name || user.user_metadata?.full_name || user.email}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                        )}
                    </div>
                    {isCollapsed ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-full mt-4 text-muted-foreground hover:text-red-500 hover:bg-red-500/10" onClick={signOut}>
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={10} className="text-red-500">Sign Out</TooltipContent>
                        </Tooltip>
                    ) : (
                        <Button variant="outline" size="sm" className="w-full text-muted-foreground hover:text-red-500 hover:border-red-500/50 hover:bg-red-500/10 transition-colors" onClick={signOut}>
                            <LogOut className="h-4 w-4 mr-2" />
                            Sign Out
                        </Button>
                    )}
                </div>
            </aside>}

            {/* Main Content */}
            <main className={`flex-1 overflow-auto ${isMobile ? 'pb-20' : ''}`}>
                <SubscriptionExpiredBanner />
                <AnnouncementBanner />
                <div className="p-4 md:p-8 min-h-[calc(100vh-2rem)] flex flex-col">
                    <div className="flex-1 max-w-full">
                        <SubscriptionExpiredGuard />
                    </div>
                    <footer className="mt-auto pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground order-2 md:order-1">
                            © 2025-∞ Fastest CRM by Upmarking.com. Built for Fastest Sales Teams.
                        </p>
                        <div className="flex flex-col md:flex-row items-center gap-4 order-1 md:order-2">
                            <p className="text-xs text-muted-foreground max-w-[200px] text-center md:text-right font-medium">
                                Download "FastestCRM App" for Seamless Experience
                            </p>
                            <a href="https://play.google.com/store/apps/details?id=com.fastestcrm" target="_blank" rel="noopener noreferrer">
                                <img src="/getitongoogleplay.png" alt="Get it on Google Play" className="h-8 hover:opacity-90 transition-opacity" />
                            </a>
                        </div>
                    </footer>
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            {isMobile && <MobileBottomNav />}
        </div>
    </TooltipProvider>;
}
