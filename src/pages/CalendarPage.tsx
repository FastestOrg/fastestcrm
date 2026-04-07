import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Link2, 
  Clock, 
  User, 
  Loader2, 
  Check, 
  Copy, 
  ExternalLink, 
  Video, 
  Activity, 
  CalendarRange, 
  Share2,
  CalendarDays,
  Target
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek, 
  isToday, 
  parseISO 
} from 'date-fns';
import { 
  useCalendarConnection, 
  useCalendarEvents, 
  useBookingPage, 
  useCreateBookingPage, 
  useConnectGoogleCalendar, 
  useExchangeCalendarCode 
} from '@/hooks/useCalendar';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useQueryClient } from '@tanstack/react-query';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [bookingSettingsOpen, setBookingSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { user } = useAuth();
  const { company } = useCompany();
  const queryClient = useQueryClient();

  // Calendar data
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const { data: connection, isLoading: connLoading } = useCalendarConnection();
  const { data: events = [], isLoading: eventsLoading } = useCalendarEvents(monthStart, monthEnd);
  const { data: bookingPage, isLoading: bpLoading } = useBookingPage();
  const connectGoogle = useConnectGoogleCalendar();
  const exchangeCode = useExchangeCalendarCode();
  const saveBookingPage = useCreateBookingPage();

  // Lead reminders
  const { data: reminders = [] } = useLeadReminders(monthStart, monthEnd);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      exchangeCode.mutate(code, {
        onSettled: () => {
          searchParams.delete('code');
          searchParams.delete('scope');
          setSearchParams(searchParams, { replace: true });
        }
      });
    }
  }, []);

  // Booking page form state
  const [bpTitle, setBpTitle] = useState('Book a Meeting');
  const [bpDesc, setBpDesc] = useState('');
  const [bpSlug, setBpSlug] = useState('');
  const [bpDurations, setBpDurations] = useState('15,30,60');
  const [bpBuffer, setBpBuffer] = useState(0);
  const [bpAvailability, setBpAvailability] = useState<Record<string, { enabled: boolean; start: string; end: string }>>({
    monday: { enabled: true, start: '09:00', end: '17:00' },
    tuesday: { enabled: true, start: '09:00', end: '17:00' },
    wednesday: { enabled: true, start: '09:00', end: '17:00' },
    thursday: { enabled: true, start: '09:00', end: '17:00' },
    friday: { enabled: true, start: '09:00', end: '17:00' },
    saturday: { enabled: false, start: '09:00', end: '17:00' },
    sunday: { enabled: false, start: '09:00', end: '17:00' },
  });

  // Populate form when booking page loads
  useEffect(() => {
    if (bookingPage) {
      setBpTitle((bookingPage as any).title || 'Book a Meeting');
      setBpDesc((bookingPage as any).description || '');
      setBpSlug((bookingPage as any).slug || '');
      setBpDurations(((bookingPage as any).durations || [30]).join(','));
      setBpBuffer((bookingPage as any).buffer_minutes || 0);
      if ((bookingPage as any).availability) setBpAvailability((bookingPage as any).availability);
    } else if (user?.email) {
      setBpSlug(user.email.split('@')[0].replace(/[^a-z0-9-]/g, '-'));
    }
  }, [bookingPage, user]);

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateEvents = (events as any[]).filter((e: any) => isSameDay(parseISO(e.start_time), selectedDate));
    const dateReminders = (reminders as any[]).filter((r: any) => isSameDay(parseISO(r.reminder_at), selectedDate));
    return [
      ...dateEvents.map((e: any) => ({ ...e, type: 'event' })),
      ...dateReminders.map((r: any) => ({ id: r.id, title: `Follow-up: ${r.name}`, start_time: r.reminder_at, type: 'reminder', status: r.status })),
    ].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [selectedDate, events, reminders]);

  // Check which days have events
  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    (events as any[]).forEach((e: any) => set.add(format(parseISO(e.start_time), 'yyyy-MM-dd')));
    (reminders as any[]).forEach((r: any) => set.add(format(parseISO(r.reminder_at), 'yyyy-MM-dd')));
    return set;
  }, [events, reminders]);

  const handleSaveBookingPage = () => {
    const durations = bpDurations.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d > 0);
    if (durations.length === 0) { toast('Add at least one duration'); return; }
    if (!bpSlug.trim()) { toast('Set a booking URL slug'); return; }
    saveBookingPage.mutate({
      id: (bookingPage as any)?.id,
      title: bpTitle,
      description: bpDesc,
      slug: bpSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      durations,
      availability: bpAvailability,
      bufferMinutes: bpBuffer,
    });
    setBookingSettingsOpen(false);
  };

  const bookingUrl = bookingPage && company?.slug ? `${window.location.origin}/${company.slug}/${(bookingPage as any).slug}` : '';


  const copyBookingLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    toast('Booking link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 animate-slide-up-fade">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-primary font-bold tracking-tight uppercase text-[10px]">
            <CalendarDays className="h-3 w-3" />
            FastEngage Calendar
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-syne tracking-tight">Schedule & Bookings</h1>
          <p className="text-muted-foreground text-xs max-w-md">
            Manage team schedule and public booking page.
          </p>
        </div>
        
        <div className="flex gap-3 flex-wrap">
          {!connection ? (
            <Button 
              size="sm"
              className="gradient-primary shadow-lg border-none glow button-premium"
              onClick={() => connectGoogle.mutate()} 
              disabled={connectGoogle.isPending}
            >
              {connectGoogle.isPending ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <CalendarIcon className="h-3 w-3 mr-2" />}
              Connect Google
            </Button>
          ) : (
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => connectGoogle.mutate()}>
               <div className="h-9 px-3 flex items-center gap-2 rounded-full glass border-success/30 text-success text-[11px] font-semibold transition-all hover:bg-success/5">
                 <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                 Sync Active
               </div>
            </div>
          )}

          <Dialog open={bookingSettingsOpen} onOpenChange={setBookingSettingsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="glass hover:border-primary border-border/50">
                <Link2 className="h-3 w-3 mr-2" /> Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto glass-strong border-primary/20">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold font-syne">Public Page Configuration</DialogTitle>
                <DialogDescription>Customize how customers see your booking availability.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 pt-6">
                <div className="space-y-2">
                  <Label className="font-semibold px-1">Page Headline</Label>
                  <Input className="bg-muted/30" value={bpTitle} onChange={e => setBpTitle(e.target.value)} placeholder="e.g., Discovery Call with Team" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold px-1">Description</Label>
                  <Input className="bg-muted/30" value={bpDesc} onChange={e => setBpDesc(e.target.value)} placeholder="What should people expect from this meeting?" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold px-1">Unique URL</Label>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-2">
                    <span className="text-xs text-muted-foreground font-mono select-none overflow-hidden truncate">.../book/</span>
                    <span className="text-xs font-bold font-mono text-primary truncate shrink">{bpSlug || 'slug'}</span>
                  </div>
                  <Input className="bg-muted/30 font-mono" value={bpSlug} onChange={e => setBpSlug(e.target.value)} placeholder="e.g., alex-smith" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-semibold px-1">Meeting Options (m)</Label>
                    <Input className="bg-muted/30" value={bpDurations} onChange={e => setBpDurations(e.target.value)} placeholder="15,30,60" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold px-1">Buffer (m)</Label>
                    <Input className="bg-muted/30" type="number" value={bpBuffer} onChange={e => setBpBuffer(parseInt(e.target.value) || 0)} />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Label className="font-bold flex items-center gap-2 border-b border-border/50 pb-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Weekly Availability
                  </Label>
                  <div className="space-y-3">
                    {DAY_KEYS.map((day, i) => (
                      <div key={day} className={`flex items-center gap-4 p-2 rounded-lg transition-colors ${bpAvailability[day]?.enabled ? 'bg-primary/5' : 'opacity-40'}`}>
                        <Switch
                          checked={bpAvailability[day]?.enabled}
                          onCheckedChange={c => setBpAvailability(prev => ({ ...prev, [day]: { ...prev[day], enabled: c } }))}
                        />
                        <span className="w-16 text-xs font-bold uppercase tracking-widest">{DAYS[i]}</span>
                        {bpAvailability[day]?.enabled && (
                          <div className="flex items-center gap-2 flex-grow">
                             <Input 
                               type="time" 
                               value={bpAvailability[day]?.start} 
                               onChange={e => setBpAvailability(prev => ({ ...prev, [day]: { ...prev[day], start: e.target.value } }))} 
                               className="h-9 glass border-none bg-background text-sm" 
                             />
                             <span className="text-[10px] uppercase font-bold text-muted-foreground">To</span>
                             <Input 
                               type="time" 
                               value={bpAvailability[day]?.end} 
                               onChange={e => setBpAvailability(prev => ({ ...prev, [day]: { ...prev[day], end: e.target.value } }))} 
                               className="h-9 glass border-none bg-background text-sm" 
                             />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <Button 
                  size="lg"
                  onClick={handleSaveBookingPage} 
                  disabled={saveBookingPage.isPending} 
                  className="w-full h-12 text-base font-bold shadow-xl shadow-primary/20"
                >
                  {saveBookingPage.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-5 w-5 mr-2" />}
                  Save All Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Booking URL Banner */}
      {bookingPage && (
        <div className="relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent animate-pulse group-hover:from-primary/30 transition-all duration-700" />
          <div className="relative px-6 py-4 glass border-primary/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-primary/5 border opacity-90 backdrop-blur-3xl">
            <div className="flex items-center gap-5">
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center glow-strong shadow-primary/40 shrink-0">
                <Share2 className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Live Booking Address</p>
                <div className="flex items-center gap-2 group-hover:scale-[1.01] transition-transform duration-300">
                  <span className="text-lg font-mono font-bold text-foreground truncate ">{bookingUrl}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <Button size="sm" className={`rounded-lg border-none text-xs font-bold transition-all ${copied ? 'bg-success text-white' : 'glass hover:bg-primary/20 text-foreground border border-border/50 shadow-sm'}`} onClick={copyBookingLink}>
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button size="sm" variant="link" className="text-primary text-xs font-bold hover:scale-105 transition-all flex items-center gap-2 h-9 px-4" asChild>
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                  Preview <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Calendar Box */}
        <div className="lg:col-span-8 group">
          <Card className="border shadow-2xl glass-strong border-border/40 overflow-hidden relative rounded-[2rem]">
            <CardHeader className="p-8 border-b border-border/40 pb-6 relative z-10">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 glass-strong hover:bg-primary/10 rounded-full"
                    onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 glass-strong hover:bg-primary/10 rounded-full"
                    onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex flex-col items-center gap-0">
                  <h2 className="text-2xl font-bold font-syne tracking-tight lowercase">
                    {format(currentMonth, 'MMMM')} <span className="text-primary font-dm-sans">{format(currentMonth, 'yyyy')}</span>
                  </h2>
                </div>

                <Button 
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setSelectedDate(new Date());
                  }}
                  variant="outline" 
                  size="sm" 
                  className="rounded-full glass h-9 px-4 font-bold border-primary/20 text-primary uppercase text-[10px] tracking-widest hover:bg-primary hover:text-white transition-all duration-500"
                >
                  <Activity className="h-3 w-3 mr-1" /> Today
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 lg:p-8">
              <div className="grid grid-cols-7 gap-y-3 gap-x-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[10px] font-bold text-muted-foreground/60 tracking-[0.2em] mb-4">{d.toUpperCase()}</div>
                ))}
                {calendarDays.map(day => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const hasEvent = daysWithEvents.has(dateKey);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentMonth);

                  return (
                    <div key={dateKey} className="group/cell relative flex justify-center py-1">
                      <button
                        onClick={() => setSelectedDate(day)}
                        className={`relative z-10 w-10 h-10 md:w-11 md:h-11 font-bold rounded-xl transition-all duration-500 flex flex-col items-center justify-center gap-0.5
                          ${!isCurrentMonth ? 'text-muted-foreground/20' : ''}
                          ${isSelected ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/30 glow scale-110' : 'hover:bg-primary/5 text-foreground'}
                          ${isToday(day) && !isSelected ? 'border border-primary' : ''}
                        `}
                      >
                        <span className="text-xs md:text-sm">{format(day, 'd')}</span>
                        {hasEvent && (
                          <div className={`h-1 w-1 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary shadow-primary'} glow shrink-0 transition-all`} />
                        )}
                      </button>
                      
                      {isSelected && (
                         <div className="absolute inset-0 z-0 bg-primary/20 blur-2xl animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
            
            {/* Soft decorative blur */}
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/20 blur-[120px] rounded-full" />
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 blur-[120px] rounded-full" />
          </Card>
        </div>

        {/* Selected Day Sidebar */}
        <div className="lg:col-span-4 h-full sticky top-8">
          <Card className="glass-strong border-primary/10 shadow-2xl rounded-[2rem] h-full overflow-hidden flex flex-col border">
            <CardHeader className="bg-primary/5 p-4 border-b border-border/40 pb-4 flex shrink-0">
              <div className="space-y-2">
                 <div className="flex items-center gap-2">
                    <Badge className="bg-primary text-primary-foreground border-none font-bold text-[10px] py-0 h-4 px-1.5">
                       {selectedDateEvents.length} Tasks
                    </Badge>
                 </div>
                 <div className="space-y-0">
                    <h2 className="text-xl font-bold font-syne tracking-tight lowercase">
                       {selectedDate ? format(selectedDate, 'EEEE') : 'Selecting'}
                    </h2>
                    <p className="text-muted-foreground text-[11px] font-medium">
                       {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Pick a date'}
                    </p>
                 </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-grow overflow-y-auto custom-scrollbar">
              {eventsLoading ? (
                <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
                   <div className="relative">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                   </div>
                   <p className="text-sm font-bold text-muted-foreground animate-pulse uppercase tracking-widest">Scanning Schedule...</p>
                </div>
              ) : selectedDateEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-6 pt-16">
                  <div className="h-24 w-24 rounded-full bg-muted/40 flex items-center justify-center animate-float">
                    <Target className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-bold">Clear Horizons</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      No meetings or follow-ups scheduled for this day. Ready for deep work?
                    </p>
                  </div>
                  <Button variant="outline" className="rounded-xl glass border-border/50 font-bold" disabled>
                     Schedule Activity
                  </Button>
                </div>
              ) : (
                <div className="relative p-6">
                   {/* Timeline vertical bar */}
                   <div className="absolute left-8 top-10 bottom-10 w-0.5 bg-gradient-to-b from-primary/30 via-primary/5 to-transparent z-0" />
                   
                   <div className="space-y-6 relative z-10">
                    {selectedDateEvents.map((evt: any, i) => (
                      <div key={evt.id} className="animate-row-fade-in group flex gap-6" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="relative shrink-0 pt-1">
                           <div className={`h-4 w-4 rounded-full ring-4 transition-all duration-700 group-hover:scale-150 ${evt.type === 'reminder' ? 'bg-amber-500 ring-amber-500/10 shadow-amber-500/40 shadow-lg' : 'bg-primary ring-primary/10 shadow-primary/40 shadow-lg'}`} />
                           {evt.type === 'reminder' && (
                             <div className="absolute h-full w-4 bg-amber-500/20 blur-xl top-0 translate-y-1" />
                           )}
                        </div>

                        <div className="space-y-3 flex-grow min-w-0">
                           <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(parseISO(evt.start_time), 'h:mm a')}
                                {evt.end_time && ` - ${format(parseISO(evt.end_time), 'h:mm a')}`}
                              </span>
                              <h3 className="text-lg font-bold tracking-tight line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                                {evt.title}
                              </h3>
                           </div>

                           <div className="space-y-3">
                              {evt.attendee_name && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/30">
                                   <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                      {evt.attendee_name.charAt(0)}
                                   </div>
                                   <div className="min-w-0">
                                      <p className="text-xs font-bold leading-none mb-0.5">{evt.attendee_name}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{evt.attendee_email || "External Client"}</p>
                                   </div>
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                 <Badge variant="outline" className={`rounded-md px-1.5 py-0.5 text-[9px] uppercase font-black border-border/40 tracking-wider ${evt.type === 'reminder' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                                    {evt.type === 'reminder' ? 'Lead Follow-up' : evt.event_type === 'booking' ? 'Calender Link' : 'Sync Event'}
                                 </Badge>
                                 
                                 {evt.location && evt.location.includes('google.com') && (
                                   <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-[9px] uppercase font-black bg-primary text-white border-none shadow-sm shadow-primary/20">
                                      Video Call
                                   </Badge>
                                 )}
                              </div>

                              {evt.location && evt.location.includes('google.com') && (
                                <Button size="sm" className="w-full rounded-xl gradient-primary border-none shadow-md glow h-9 text-xs font-bold font-syne hover:scale-[1.02] active:scale-95 transition-all group/btn" asChild>
                                  <a href={evt.location} target="_blank" rel="noopener noreferrer">
                                    <Video className="h-3.5 w-3.5 mr-2 group-hover/btn:animate-pulse" /> Launch Selection Meet
                                  </a>
                                </Button>
                              )}
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html:`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--primary) / 0.4); }
        .font-syne { font-family: 'Syne', sans-serif; }
        .button-premium { position: relative; overflow: hidden; transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .button-premium:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 15px 30px -5px hsl(var(--primary) / 0.4); }
        .button-premium::after { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, #fff3 0%, transparent 70%); transform: scale(0); transition: transform 0.6s ease-out; }
        .button-premium:hover::after { transform: scale(1); }
      `}} />
    </div>
  );
}

// Hook to fetch lead reminders for calendar
function useLeadReminders(startDate: Date, endDate: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['lead-reminders-calendar', user?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, reminder_at, status')
        .not('reminder_at', 'is', null)
        .gte('reminder_at', startDate.toISOString())
        .lte('reminder_at', endDate.toISOString())
        .order('reminder_at', { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id,
  });
}
