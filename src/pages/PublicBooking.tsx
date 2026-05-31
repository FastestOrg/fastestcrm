import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarIcon, Clock, Check, Loader2, ChevronLeft, ChevronRight, ArrowLeft, Video, User, Globe } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isToday, isBefore, startOfDay, parseISO, addMinutes, isAfter } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

type Step = 'datetime' | 'details' | 'confirmed';

export default function PublicBooking() {
  const { companySlug, slug } = useParams<{ companySlug: string; slug: string }>();

  const [bookingPage, setBookingPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [step, setStep] = useState<Step>('datetime');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [busySlots, setBusySlots] = useState<{start: string, end: string}[]>([]);
  const [fetchingBusy, setFetchingBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [meetLink, setMeetLink] = useState<string | null>(null);

  // Fetch booking page
  useEffect(() => {
    if (!slug || !companySlug) return;
    (async () => {
      // Fetch booking page joining with company slug
      const { data, error: err } = await supabase
        .from('booking_pages' as any)
        .select(`
          *, 
          companies!inner(name, logo_url, slug)
        `)
        .eq('slug', slug)
        .eq('companies.slug', companySlug)
        .eq('is_active', true)
        .maybeSingle();

      if (err || !data) { 
        setError('Booking page not found'); 
        setLoading(false); 
        return; 
      }
      
      // Fetch profile info securely using public RPC function
      try {
        const { data: profileData } = await supabase.rpc('get_public_profile_info', {
          profile_id: data.user_id
        });
        if (profileData && profileData.length > 0) {
          data.profiles = profileData[0];
        }
      } catch (profileErr) {
        console.error('Error fetching public profile details:', profileErr);
      }
      
      setBookingPage(data);
      setSelectedDuration((data as any).durations?.[0] || 30);
      setLoading(false);
    })();
  }, [slug, companySlug]);

  // Fetch free/busy when month changes
  useEffect(() => {
    if (!bookingPage?.id) return;
    const fetchBusy = async () => {
      setFetchingBusy(true);
      const timeMin = startOfMonth(currentMonth).toISOString();
      const timeMax = endOfMonth(addMonths(currentMonth, 1)).toISOString(); // Fetch 2 months
      
      const { data, error } = await supabase.functions.invoke('calendar-freebusy', {
        body: { bookingPageId: bookingPage.id, timeMin, timeMax }
      });
      
      if (!error && data?.busy) {
        setBusySlots(data.busy);
      }
      setFetchingBusy(false);
    };
    fetchBusy();
  }, [bookingPage?.id, currentMonth]);

  // Calendar generation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const isDayAvailable = (day: Date) => {
    if (isBefore(startOfDay(day), startOfDay(new Date()))) return false;
    if (!bookingPage?.availability) return false;
    const dayKey = DAY_KEYS[day.getDay()];
    return bookingPage.availability[dayKey]?.enabled || false;
  };

  const isSlotOverlap = (start: Date, end: Date) => {
    for (const busy of busySlots) {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);
      // If busyStart is before our interval ends AND busyEnd is after our interval starts
      if (isBefore(busyStart, end) && isAfter(busyEnd, start)) {
        return true;
      }
    }
    return false;
  };

  const timeSlots = useMemo(() => {
    if (!selectedDate || !bookingPage?.availability) return [];
    const dayKey = DAY_KEYS[selectedDate.getDay()];
    const config = bookingPage.availability[dayKey];
    if (!config?.enabled) return [];

    const [startH, startM] = config.start.split(':').map(Number);
    const [endH, endM] = config.end.split(':').map(Number);
    const slots: string[] = [];
    const buffer = bookingPage.buffer_minutes || 0;

    let current = new Date(selectedDate);
    current.setHours(startH, startM, 0, 0);
    const endTime = new Date(selectedDate);
    endTime.setHours(endH, endM, 0, 0);

    while (addMinutes(current, selectedDuration) <= endTime) {
      const slotEnd = addMinutes(current, selectedDuration);
      
      // Check if past time
      if (isToday(selectedDate) && isBefore(current, new Date())) {
        current = addMinutes(current, selectedDuration + buffer);
        continue;
      }

      // Check external busy slots
      if (!isSlotOverlap(current, slotEnd)) {
        slots.push(format(current, 'HH:mm'));
      }
      
      current = addMinutes(current, selectedDuration + buffer);
    }
    return slots;
  }, [selectedDate, selectedDuration, bookingPage, busySlots]);

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || !name || !email || !bookingPage) return;
    setSubmitting(true);

    const [h, m] = selectedTime.split(':').map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(h, m, 0, 0);
    const endTime = addMinutes(startTime, selectedDuration);

    try {
      const { data, error: err } = await supabase.functions.invoke('create-booking', {
        body: {
          bookingPageId: bookingPage.id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration: selectedDuration,
          attendeeName: name,
          attendeeEmail: email,
          attendeePhone: phone,
          notes,
        },
      });

      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      if (data?.event?.location) {
          setMeetLink(data.event.location);
      }
      setStep('confirmed');
    } catch (e: any) {
      setError(e.message || 'Failed to book. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error && !bookingPage) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-background">
      <Card className="max-w-md w-full mx-4 shadow-xl">
        <CardContent className="pt-6 text-center">
          <p className="text-destructive font-medium">{error}</p>
        </CardContent>
      </Card>
    </div>
  );

  const profileName = bookingPage.profiles?.full_name || 'Host';
  const companyName = bookingPage.companies?.name || '';
  const profileAvatar = bookingPage.profiles?.avatar_url || bookingPage.companies?.logo_url;

  if (step === 'confirmed') return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-background p-4">
      <Card className="max-w-xl w-full shadow-2xl border-none">
        <CardContent className="pt-10 pb-8 text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center border-4 border-green-500/20">
            <Check className="h-10 w-10 text-green-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">You are scheduled</h2>
            <p className="text-muted-foreground">A calendar invitation has been sent to your email address.</p>
          </div>
          
          <div className="border border-border/50 rounded-xl p-6 text-left space-y-4 bg-muted/30">
            <h3 className="font-semibold text-lg">{bookingPage.title}</h3>
            <div className="flex items-center gap-3 text-muted-foreground">
              <CalendarIcon className="h-5 w-5" />
              <span>{selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Clock className="h-5 w-5" />
              <span>{selectedTime} ({selectedDuration} min)</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Video className="h-5 w-5" />
              <span>Web conferencing details to follow.</span>
            </div>
          </div>
          
          {meetLink && (
            <Button size="lg" className="w-full mt-4" asChild>
              <a href={meetLink} target="_blank" rel="noopener noreferrer">
                <Video className="h-4 w-4 mr-2" /> Join Google Meet
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-background flex items-center justify-center p-4 sm:p-8 font-sans transition-all">
      <Card className="max-w-[1000px] w-full shadow-2xl rounded-2xl overflow-hidden border-border/40 bg-card">
        <div className="flex flex-col md:flex-row min-h-[500px]">
          
          {/* Left Panel: Info */}
          <div className="w-full md:w-[35%] bg-muted/30 border-r border-border/50 p-6 sm:p-8 flex flex-col gap-6 relative">
            {step === 'details' && (
              <Button variant="ghost" size="icon" className="absolute top-6 left-6 h-8 w-8 rounded-full bg-background border border-border shadow-sm" onClick={() => setStep('datetime')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            
            <div className={`flex flex-col items-start gap-4 ${step === 'details' ? 'mt-8 md:mt-0' : ''}`}>
              {profileAvatar ? (
                <img src={profileAvatar} alt={profileName} className="w-14 h-14 rounded-full object-cover border border-border" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                  {profileName.charAt(0)}
                </div>
              )}
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{profileName} {companyName && `• ${companyName}`}</p>
                <h1 className="text-2xl font-bold tracking-tight">{bookingPage.title}</h1>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground text-sm font-medium">
                <Clock className="h-5 w-5" />
                <span>{selectedDuration} min</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground text-sm font-medium">
                <Video className="h-5 w-5" />
                <span>Google Meet</span>
              </div>
              {step === 'details' && selectedDate && selectedTime && (
                <div className="flex items-start gap-3 text-primary text-sm font-medium mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <CalendarIcon className="h-5 w-5 mt-0.5 shrink-0" />
                  <span>{format(selectedDate, 'EEEE, MMMM d, yyyy')} <br/> at {selectedTime}</span>
                </div>
              )}
            </div>

            {bookingPage.description && step === 'datetime' && (
              <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {bookingPage.description}
              </div>
            )}
          </div>

          {/* Right Panel: Content */}
          <div className="w-full md:w-[65%] p-6 sm:p-8">
            {error && <p className="text-sm text-destructive mb-6 p-4 bg-destructive/10 rounded-lg border border-destructive/20">{error}</p>}

            {step === 'datetime' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Select a Date & Time</h2>
                  
                  {bookingPage.durations?.length > 1 && (
                    <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
                      {bookingPage.durations.map((d: number) => (
                        <button 
                          key={d} 
                          className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${selectedDuration === d ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setSelectedDuration(d)}
                        >
                          {d}m
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                  {/* Calendar Widget */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-medium text-lg">{format(currentMonth, 'MMMM yyyy')}</h3>
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-y-4 gap-x-1 mb-2 text-center">
                      {DAYS.map(d => (
                        <div key={d} className="text-[10px] font-bold text-muted-foreground tracking-wider">{d}</div>
                      ))}
                      {calendarDays.map(day => {
                        const available = isDayAvailable(day);
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const isCurrentMonth = isSameMonth(day, currentMonth);

                        return (
                          <div key={format(day, 'yyyy-MM-dd')} className="flex justify-center aspect-square">
                            <button
                              onClick={() => { if (available) { setSelectedDate(day); setSelectedTime(null); } }}
                              disabled={!available}
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
                                ${!isCurrentMonth ? 'text-muted-foreground/30' : ''}
                                ${!available ? 'opacity-30 cursor-not-allowed text-muted-foreground' : 'cursor-pointer hover:bg-primary/10 text-foreground'}
                                ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary' : 'bg-transparent'}
                                ${isToday(day) && !isSelected ? 'text-primary font-bold bg-primary/5' : ''}
                              `}
                            >
                              {format(day, 'd')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      <Globe className="h-3 w-3" />
                      {bookingPage.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </div>
                  </div>

                  {/* Time Slots Widget */}
                  {selectedDate && (
                    <div className="w-full md:w-[200px] flex flex-col pt-1 md:pt-[2.75rem] animate-in slide-in-from-left-4 fade-in duration-300">
                      <h4 className="text-sm font-medium mb-4 text-center md:text-left">{format(selectedDate, 'EEEE, MMM d')}</h4>
                      {fetchingBusy ? (
                         <div className="flex-1 flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                      ) : timeSlots.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-8 text-center p-4 bg-muted/30 rounded-xl border border-border/50">
                          No times available on this date.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar pb-4">
                          {timeSlots.map(slot => (
                            <div key={slot} className="flex flex-col sm:flex-row gap-1 w-full">
                              <Button
                                variant="outline"
                                className={`flex-1 font-medium border-primary/20 text-primary hover:border-primary transition-all ${
                                  selectedTime === slot ? 'bg-foreground text-background shrink-0 w-1/2 justify-center' : 'w-full'
                                }`}
                                onClick={() => setSelectedTime(slot)}
                              >
                                {slot}
                              </Button>
                              {selectedTime === slot && (
                                <Button 
                                  className="w-1/2 animate-in slide-in-from-right-4 fade-in font-medium" 
                                  onClick={() => setStep('details')}
                                >
                                  Next
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'details' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-md mx-auto">
                <h2 className="text-xl font-bold mb-6">Enter Details</h2>
                
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="font-semibold">Name *</Label>
                    <Input className="bg-muted/50 border-border/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all" value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="font-semibold">Email *</Label>
                    <Input className="bg-muted/50 border-border/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="font-semibold flex items-center justify-between">
                       Phone
                       <span className="font-normal text-muted-foreground text-xs">Optional</span>
                    </Label>
                    <Input className="bg-muted/50 border-border/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="font-semibold flex items-center justify-between">
                      Please share anything that will help prepare for our meeting
                      <span className="font-normal text-muted-foreground text-xs">Optional</span>
                    </Label>
                    <Textarea className="bg-muted/50 border-border/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all resize-none" value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
                  </div>
                  
                  <div className="pt-2">
                    <Button size="lg" onClick={handleSubmit} disabled={submitting || !name || !email} className="w-full text-base font-semibold">
                      {submitting ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : null}
                      Schedule Event
                    </Button>
                  </div>
                  
                  <p className="text-[11px] text-muted-foreground text-center px-4 leading-relaxed">
                    By proceeding, you confirm that you have read and agree to our Terms of Use and Privacy Notice.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
      
      {/* Required for custom scrollbar in timeslots */}
      <style dangerouslySetInnerHTML={{__html:`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: hsl(var(--border));
          border-radius: 20px;
        }
      `}}/>
    </div>
  );
}
