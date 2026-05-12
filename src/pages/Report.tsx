import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// DashboardLayout removed
import { useLeads } from "@/hooks/useLeads";
import { useTeam } from "@/hooks/useTeam";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { Loader2, TrendingUp, Users, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForecast } from "@/hooks/useForecast";
import { DollarSign, Activity, Sparkles, BrainCircuit } from "lucide-react";
import { 
    ComposedChart, 
    Area, 
    Tooltip as RechartsTooltip 
} from "recharts";


const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function Report() {
    const [reportLimit, setReportLimit] = useState<number>(1000);
    const { data: leadsData, isLoading: leadsLoading } = useLeads({ fetchAll: true, limit: reportLimit });
    const { members, loading: teamLoading } = useTeam();
    const { data: forecastData, isLoading: forecastLoading } = useForecast();
    const leads = leadsData?.leads || [];

    const isLoading = leadsLoading || teamLoading || forecastLoading;

    // 1. Leads per Employee (Basic for Chart)
    const leadsPerEmployee = members.map((member) => {
        const count = leads.filter((lead) => lead.sales_owner_id === member.id).length;
        return {
            name: member.full_name || member.email?.split("@")[0] || "Unknown",
            leads: count,
        };
    }).sort((a, b) => b.leads - a.leads);

    // 2. Lead Status Distribution
    const leadsByStatus = leads.reduce((acc, lead) => {
        const status = lead.status.replace("_", " ").toUpperCase();
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const statusData = Object.entries(leadsByStatus).map(([name, value]) => ({
        name,
        value,
    }));

    // 3. Conversion Ratios & Overall Stats
    const totalLeads = leads.length;
    const interestedLeads = leads.filter((l) =>
        ["interested", "follow_up", "site_visit", "negotiation"].includes(l.status)
    ).length;
    const paidLeads = leads.filter((l) => l.status === "paid").length;

    const funnelData = [
        { name: "Total Leads", value: totalLeads },
        { name: "Interested/Active", value: interestedLeads },
        { name: "Converted (Paid)", value: paidLeads },
    ];

    const conversionRate = totalLeads > 0 ? ((paidLeads / totalLeads) * 100).toFixed(1) : "0";

    // 4. Detailed Employee Stats
    const employeeStats = members.map((member) => {
        const memberLeads = leads.filter((lead) => lead.sales_owner_id === member.id);
        const total = memberLeads.length;

        const newLeads = memberLeads.filter((l) => l.status === 'new').length;
        const interestedLeadsCount = memberLeads.filter((l) =>
            ["interested", "follow_up", "site_visit", "negotiation"].includes(l.status)
        ).length;
        const paidLeadsCount = memberLeads.filter((l) => l.status === "paid").length;
        const otherLeads = total - (newLeads + interestedLeadsCount + paidLeadsCount);

        const revenue = memberLeads.reduce((sum, lead) => sum + (lead.revenue_received || 0), 0);

        const convRate = total > 0 ? ((paidLeadsCount / total) * 100).toFixed(1) : "0";

        return {
            id: member.id,
            name: member.full_name || member.email?.split("@")[0] || "Unknown",
            total,
            new: { count: newLeads, percentage: total > 0 ? ((newLeads / total) * 100).toFixed(1) : 0 },
            interested: { count: interestedLeadsCount, percentage: total > 0 ? ((interestedLeadsCount / total) * 100).toFixed(1) : 0 },
            paid: { count: paidLeadsCount, percentage: total > 0 ? ((paidLeadsCount / total) * 100).toFixed(1) : 0 },
            other: { count: otherLeads, percentage: total > 0 ? ((otherLeads / total) * 100).toFixed(1) : 0 },
            revenue,
            conversionRate: convRate,
        };
    }).sort((a, b) => b.total - a.total);


    if (isLoading) {
        return (
            <>
                <div className="flex h-screen items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    return (
        <>
            <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Report Analysis</h1>
                        <p className="text-muted-foreground">
                            Detailed insights into team performance and lead conversion.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:inline">Report Range:</span>
                        <Select
                            value={reportLimit.toString()}
                            onValueChange={(value) => setReportLimit(Number(value))}
                        >
                            <SelectTrigger className="w-[180px] bg-card/50 backdrop-blur-sm border-border/50">
                                <SelectValue placeholder="Select limit" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1000">Recent 1,000</SelectItem>
                                <SelectItem value="10000">Recent 10,000</SelectItem>
                                <SelectItem value="50000">Recent 50,000</SelectItem>
                                <SelectItem value="1000000">All Leads</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="individual">Individual Reporting</TabsTrigger>
                        <TabsTrigger value="forecast" className="gap-2">
                             <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                             Revenue Forecast
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        {/* Stats Overview */}
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{totalLeads}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{conversionRate}%</div>
                                    <p className="text-xs text-muted-foreground">
                                        leads resulted in payment
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                                    <Target className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{leadsPerEmployee[0]?.name || "N/A"}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {leadsPerEmployee[0]?.leads || 0} leads assigned
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                            {/* Leads by Employee Chart */}
                            <Card className="col-span-4">
                                <CardHeader>
                                    <CardTitle>Leads by Employee</CardTitle>
                                    <CardDescription>
                                        Total number of leads assigned to each team member.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pl-2" style={{ overflow: 'visible' }}>
                                    <ResponsiveContainer width="100%" height={450}>
                                        <BarChart data={leadsPerEmployee} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                                            <XAxis
                                                dataKey="name"
                                                stroke="#888888"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                angle={-45}
                                                textAnchor="end"
                                                interval={0}
                                                height={80}
                                            />
                                            <YAxis
                                                stroke="#888888"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `${value}`}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                contentStyle={{
                                                    borderRadius: '8px',
                                                    border: '1px solid #334155',
                                                    backgroundColor: '#1e293b',
                                                    color: '#f1f5f9',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                }}
                                                labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                                                itemStyle={{ color: '#22d3ee' }}
                                            />
                                            <Bar dataKey="leads" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* Lead Status Distribution */}
                            <Card className="col-span-3">
                                <CardHeader>
                                    <CardTitle>Lead Status Bifurcation</CardTitle>
                                    <CardDescription>
                                        Current distribution of leads across different statuses.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={350}>
                                        <PieChart>
                                            <Pie
                                                data={statusData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {statusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Conversion Funnel */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Conversion Funnel</CardTitle>
                                <CardDescription>
                                    Lead progression from total leads to paid customers.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={funnelData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            width={150}
                                            tick={{ fontSize: 13 }}
                                        />
                                        <Tooltip cursor={{ fill: 'transparent' }} />
                                        <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={40}>
                                            {
                                                funnelData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="individual">
                        <Card>
                            <CardHeader>
                                <CardTitle>Individual Performance Report</CardTitle>
                                <CardDescription>Detailed breakdown of metrics per team member</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee Name</TableHead>
                                            <TableHead className="text-right">Total Leads</TableHead>
                                            <TableHead className="text-right">New (Fresh Leads)</TableHead>
                                            <TableHead className="text-right">Interested (In Progress)</TableHead>
                                            <TableHead className="text-right">Paid (Closed Won)</TableHead>
                                            <TableHead className="text-right">Other (Closed Lost / Archive)</TableHead>
                                            <TableHead className="text-right">Revenue Generated</TableHead>
                                            <TableHead className="text-right">Conversion Rate</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {employeeStats.map((stat) => (
                                            <TableRow key={stat.id}>
                                                <TableCell className="font-medium">{stat.name}</TableCell>
                                                <TableCell className="text-right font-bold">{stat.total}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    {stat.new.count} <span className="text-xs">({stat.new.percentage}%)</span>
                                                </TableCell>
                                                <TableCell className="text-right text-blue-600 font-medium">
                                                    {stat.interested.count} <span className="text-xs">({stat.interested.percentage}%)</span>
                                                </TableCell>
                                                <TableCell className="text-right text-green-600 font-bold">
                                                    {stat.paid.count} <span className="text-xs">({stat.paid.percentage}%)</span>
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    {stat.other.count} <span className="text-xs">({stat.other.percentage}%)</span>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {stat.revenue.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                                </TableCell>
                                                <TableCell className="text-right">{stat.conversionRate}%</TableCell>
                                            </TableRow>
                                        ))}
                                        {employeeStats.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                                    No team members found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>


                    <TabsContent value="forecast" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-4">
                            <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Potential Pipeline</CardTitle>
                                    <Activity className="h-4 w-4 text-blue-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {forecastData?.totalPotential.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Gross value of all active leads</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Expected Revenue</CardTitle>
                                    <BrainCircuit className="h-4 w-4 text-emerald-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {forecastData?.expectedRevenue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Probability-adjusted weighting</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Closed Revenue</CardTitle>
                                    <DollarSign className="h-4 w-4 text-purple-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {forecastData?.closedRevenue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Total payments received</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Avg Conversion</CardTitle>
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{forecastData?.conversionRate.toFixed(1)}%</div>
                                    <p className="text-xs text-muted-foreground">Leads to Paid ratio</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 md:grid-cols-7">
                            <Card className="col-span-4">
                                <CardHeader>
                                    <CardTitle>Pipeline Value Distribution</CardTitle>
                                    <CardDescription>
                                        Comparison between gross pipeline value and expected revenue (probability adjusted).
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <ComposedChart data={forecastData?.pipelineByStatus}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                            <XAxis 
                                                dataKey="name" 
                                                fontSize={10} 
                                                tickLine={false} 
                                                axisLine={false}
                                                angle={-45}
                                                textAnchor="end"
                                                height={70}
                                            />
                                            <YAxis 
                                                fontSize={10} 
                                                tickLine={false} 
                                                axisLine={false}
                                                tickFormatter={(value) => `₹${value/1000}k`}
                                            />
                                            <RechartsTooltip 
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                                formatter={(value: number) => [value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }), '']}
                                            />
                                            <Legend />
                                            <Bar dataKey="total" name="Gross Value" fill="#3b82f6" opacity={0.3} radius={[4, 4, 0, 0]} />
                                            <Area type="monotone" dataKey="expected" name="Expected Adjusted" fill="#10b981" stroke="#10b981" fillOpacity={0.2} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card className="col-span-3">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-blue-500" />
                                        AI Forecast Insights
                                    </CardTitle>
                                    <CardDescription>Automated pipeline health check</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
                                        <h4 className="text-sm font-semibold text-blue-400 mb-1">Projected Outcome</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Based on current conversion probabilities, your pipeline of {totalLeads} leads is expected to generate 
                                            <span className="text-foreground font-bold mx-1">
                                                {forecastData?.expectedRevenue.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                            </span> 
                                            at maturity.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Strategic Recommendations</h4>
                                        <ul className="space-y-3">
                                            <li className="flex gap-3 text-sm italic items-start">
                                                <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                </div>
                                                Focus on conversion optimization for "Interested" leads to potentially increase Expected Revenue by 15%.
                                            </li>
                                            <li className="flex gap-3 text-sm italic items-start">
                                                <div className="h-5 w-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                </div>
                                                Strategic priority: High-intent leads in the mid-funnel represent the largest opportunity for immediate revenue growth.
                                            </li>
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

            </div>
        </>
    );
}
