import { useState } from 'react';
import { useAIEmployees, AIEmployee } from '@/hooks/useAIEmployees';
import { useWhatsAppAccounts } from '@/hooks/useWhatsAppAccounts';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { WhatsAppAccountAddDialog } from '@/components/integrations/WhatsAppAccountAddDialog';
import { EmailAccountAddDialog } from '@/components/integrations/EmailAccountAddDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Users, Bot, Phone, MessageCircle, Mail, Trash2, Edit2, Sparkles, BrainCircuit, Target, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

export default function ManageAIEmployees() {
  const { employees, isLoading, createEmployee, updateEmployee, deleteEmployee } = useAIEmployees();
  const { accounts: whatsappAccounts } = useWhatsAppAccounts();
  const { accounts: emailAccounts } = useEmailAccounts();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<AIEmployee> | null>(null);
  const [formData, setFormData] = useState<Partial<AIEmployee>>({
    name: '',
    system_prompt: '',
    knowledge_base: '',
    outcome_goal: '',
    dialer_provider: null,
    is_active: true,
  });

  const [isWhatsAppAddOpen, setIsWhatsAppAddOpen] = useState(false);
  const [isEmailAddOpen, setIsEmailAddOpen] = useState(false);

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setFormData({
      name: '',
      system_prompt: '',
      knowledge_base: '',
      outcome_goal: '',
      dialer_provider: null,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (employee: AIEmployee) => {
    setEditingEmployee(employee);
    setFormData(employee);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingEmployee?.id) {
        await updateEmployee.mutateAsync({ id: editingEmployee.id, ...formData });
      } else {
        await createEmployee.mutateAsync(formData);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 min-h-screen bg-transparent">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
              AI Employees
            </h1>
          </div>
          <p className="text-muted-foreground max-w-xl">
            Create and manage your autonomous sales team. Assign identities, knowledge, and tools to drive deal outcomes 24/7.
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gradient-primary h-11 px-6 rounded-xl shadow-lg shadow-primary/20 font-semibold transition-all hover:scale-[1.02]">
          <Plus className="h-4 w-4 mr-2" />
          Hire New AI
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
          <p className="text-sm text-muted-foreground">Summoning your AI team...</p>
        </div>
      ) : employees?.length === 0 ? (
        <Card className="glass border-dashed border-2 py-20 flex flex-col items-center justify-center text-center">
          <div className="p-6 rounded-full bg-primary/5 mb-6">
            <Bot className="h-16 w-16 text-primary/40" />
          </div>
          <h3 className="text-xl font-bold mb-2">No AI Employees Found</h3>
          <p className="text-muted-foreground max-w-sm mb-8">
            Start by creating your first AI Employee to automate follow-ups and close leads autonomously.
          </p>
          <Button onClick={handleOpenAdd} variant="outline" className="border-primary/30 text-primary hover:bg-primary/5">
            Create First Agent
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees?.map((employee) => (
            <Card key={employee.id} className="glass p-0 overflow-hidden group hover:border-primary/40 transition-all duration-300">
              <CardHeader className="p-6 pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      {employee.avatar_url ? (
                        <img src={employee.avatar_url} alt={employee.name} className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        <Bot className="h-8 w-8 text-primary" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">{employee.name}</CardTitle>
                      <Badge variant={employee.is_active ? 'default' : 'secondary'} className={employee.is_active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : ''}>
                        {employee.is_active ? 'Active' : 'Offline'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(employee)} className="h-8 w-8 hover:text-primary">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteEmployee.mutate(employee.id)} className="h-8 w-8 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Target className="h-3 w-3 text-primary" />
                    <span className="font-medium truncate">{employee.outcome_goal || 'No outcome set'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`gap-1.5 py-1 ${employee.dialer_provider ? 'border-primary/30 text-primary' : 'opacity-30'}`}>
                      <Phone className="h-3 w-3" /> {employee.dialer_provider || 'Voice'}
                    </Badge>
                    <Badge variant="outline" className={`gap-1.5 py-1 ${employee.whatsapp_account_id ? 'border-emerald-500/30 text-emerald-400' : 'opacity-30'}`}>
                      <MessageCircle className="h-3 w-3" /> {employee.whatsapp_account_id ? 'WhatsApp' : 'Chat'}
                    </Badge>
                    <Badge variant="outline" className={`gap-1.5 py-1 ${employee.email_account_id ? 'border-blue-500/30 text-blue-400' : 'opacity-30'}`}>
                      <Mail className="h-3 w-3" /> {employee.email_account_id ? 'Email' : 'Mail'}
                    </Badge>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-3 bg-white/5 p-3 rounded-xl border border-white/5 italic">
                  "{employee.system_prompt || 'No system prompt provided.'}"
                </p>
                
                <Button variant="outline" onClick={() => handleOpenEdit(employee)} className="w-full mt-2 group-hover:bg-primary group-hover:text-white transition-colors">
                  Configure Agent
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Hire/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden glass border-white/10">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              {editingEmployee ? 'Adjust AI Configuration' : 'Onboard AI Employee'}
            </DialogTitle>
            <DialogDescription>
              Define the identity, behavior, and capabilities of your autonomous agent.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="identity" className="w-full">
            <div className="px-6">
              <TabsList className="grid grid-cols-4 bg-white/5 border border-white/10 p-1">
                <TabsTrigger value="identity" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Identity</TabsTrigger>
                <TabsTrigger value="brain" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Brain</TabsTrigger>
                <TabsTrigger value="tools" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Tools</TabsTrigger>
                <TabsTrigger value="outcome" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Goals</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[450px] p-6 pt-4">
              <TabsContent value="identity" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-24 h-24 rounded-2xl bg-primary/5 border border-dashed border-primary/30 flex items-center justify-center flex-col gap-1 cursor-pointer hover:bg-primary/10 transition-colors">
                      <Plus className="h-6 w-6 text-primary/40" />
                      <span className="text-[10px] text-muted-foreground">Upload Avatar</span>
                    </div>
                    <div className="flex-1 space-y-4 w-full">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Employee Name</Label>
                        <Input 
                          id="name" 
                          placeholder="e.g. Sarah J., Senior Sales AI" 
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="bg-white/5 border-white/10 focus:border-primary/50"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={formData.is_active} 
                          onCheckedChange={(val) => setFormData({...formData, is_active: val})}
                        />
                        <Label>Employee is Active</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="brain" className="space-y-6 mt-0">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2">
                      <BrainCircuit className="h-4 w-4 text-primary" />
                      System Prompt (Personality & Behavior)
                    </Label>
                    <Textarea 
                      placeholder="You are an empathetic yet firm sales executive. Your voice is calm and professional..." 
                      className="min-h-[150px] bg-white/5 border-white/10"
                      value={formData.system_prompt || ''}
                      onChange={(e) => setFormData({...formData, system_prompt: e.target.value})}
                    />
                    <p className="text-[10px] text-muted-foreground">This defines HOW the AI talks and handles objections.</p>
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-violet-400" />
                      Knowledge Base (Context & Facts)
                    </Label>
                    <Textarea 
                      placeholder="Product Features: [X], Pricing: [Y], Refund Policy: [Z]..." 
                      className="min-h-[150px] bg-white/5 border-white/10"
                      value={formData.knowledge_base || ''}
                      onChange={(e) => setFormData({...formData, knowledge_base: e.target.value})}
                    />
                    <p className="text-[10px] text-muted-foreground">The AI will use this data to answer specific questions accurately.</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tools" className="space-y-6 mt-0">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label className="flex items-center gap-2 text-primary">
                      <Phone className="h-4 w-4" /> Voice Dialer (Privo/Exotel)
                    </Label>
                    <div className="grid gap-2">
                      <Label className="text-xs">Provider</Label>
                      <Select 
                        value={formData.dialer_provider || 'none'} 
                        onValueChange={(val) => setFormData({...formData, dialer_provider: val === 'none' ? null : val as any})}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Disabled</SelectItem>
                          <SelectItem value="privo">Privo</SelectItem>
                          <SelectItem value="exotel">Exotel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.dialer_provider && (
                      <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10 animate-in fade-in slide-in-from-top-2">
                        <div className="grid gap-2">
                          <Label className="text-[10px]">API Key</Label>
                          <Input 
                            type="password" 
                            className="h-8 bg-transparent text-xs" 
                            value={formData.dialer_api_key || ''}
                            onChange={(e) => setFormData({...formData, dialer_api_key: e.target.value})}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-[10px]">API Secret</Label>
                          <Input 
                            type="password" 
                            className="h-8 bg-transparent text-xs" 
                            value={formData.dialer_api_secret || ''}
                            onChange={(e) => setFormData({...formData, dialer_api_secret: e.target.value})}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-[10px]">Dialer Phone Number</Label>
                          <Input 
                            placeholder="+91..." 
                            className="h-8 bg-transparent text-xs" 
                            value={formData.dialer_phone_number || ''}
                            onChange={(e) => setFormData({...formData, dialer_phone_number: e.target.value})}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2 text-emerald-400">
                        <MessageCircle className="h-4 w-4" /> WhatsApp Instance
                      </Label>
                      <Select 
                        value={formData.whatsapp_account_id || 'none'} 
                        onValueChange={(val) => {
                          if (val === 'add_new') {
                            setIsWhatsAppAddOpen(true);
                          } else {
                            setFormData({...formData, whatsapp_account_id: val === 'none' ? null : val});
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Disabled</SelectItem>
                          {whatsappAccounts?.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.display_name} ({acc.phone_number})
                            </SelectItem>
                          ))}
                          <SelectItem value="add_new" className="text-emerald-400 font-bold border-t border-white/5 mt-1">
                            <Plus className="h-3 w-3 mr-2" /> Add New Account...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2 pt-4">
                      <Label className="flex items-center gap-2 text-blue-400">
                        <Mail className="h-4 w-4" /> Email Account
                      </Label>
                      <Select 
                        value={formData.email_account_id || 'none'} 
                        onValueChange={(val) => {
                          if (val === 'add_new') {
                            setIsEmailAddOpen(true);
                          } else {
                            setFormData({...formData, email_account_id: val === 'none' ? null : val});
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Disabled</SelectItem>
                          {emailAccounts?.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.display_name} ({acc.email_address})
                            </SelectItem>
                          ))}
                          <SelectItem value="add_new" className="text-primary font-bold border-t border-white/5 mt-1">
                            <Plus className="h-3 w-3 mr-2" /> Add New Account...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="outcome" className="space-y-6 mt-0">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-rose-500" />
                      North Star Outcome (The Definition of "Win")
                    </Label>
                    <Textarea 
                      placeholder="The goal is to get the lead to say 'Yes' to the demo and provide their available time slots for next Tuesday." 
                      className="min-h-[150px] bg-white/5 border-white/10"
                      value={formData.outcome_goal || ''}
                      onChange={(e) => setFormData({...formData, outcome_goal: e.target.value})}
                    />
                    <p className="text-[10px] text-muted-foreground">The AI uses this to prioritize its conversational strategy.</p>
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="p-6 bg-white/5 border-t border-white/10">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={createEmployee.isPending || updateEmployee.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="gradient-primary" disabled={createEmployee.isPending || updateEmployee.isPending}>
              {(createEmployee.isPending || updateEmployee.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingEmployee ? 'Save Changes' : 'Confirm Hiring'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WhatsAppAccountAddDialog 
        isOpen={isWhatsAppAddOpen} 
        onOpenChange={setIsWhatsAppAddOpen}
        onSuccess={(id) => setFormData(prev => ({ ...prev, whatsapp_account_id: id }))}
      />
      <EmailAccountAddDialog 
        isOpen={isEmailAddOpen} 
        onOpenChange={setIsEmailAddOpen}
        onSuccess={(id) => setFormData(prev => ({ ...prev, email_account_id: id }))}
      />
    </div>
  );
}
