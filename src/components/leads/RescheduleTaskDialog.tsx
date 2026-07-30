import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { useOrgClient } from '@/hooks/useOrgClient';
import { toast } from 'sonner';
import { TaskLead } from '@/hooks/useTaskLeads';

interface RescheduleTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lead: TaskLead;
    onSuccess: () => void;
}

export function RescheduleTaskDialog({ open, onOpenChange, lead, onSuccess }: RescheduleTaskDialogProps) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [time, setTime] = useState('10:00');
    const [saving, setSaving] = useState(false);
    const { tableName } = useLeadsTable();
    const { orgClient } = useOrgClient();

    useEffect(() => {
        if (open && lead) {
            const currentReminder = new Date(lead.reminder_at);
            setDate(currentReminder);
            // Format time as HH:MM
            const hours = String(currentReminder.getHours()).padStart(2, '0');
            const minutes = String(currentReminder.getMinutes()).padStart(2, '0');
            setTime(`${hours}:${minutes}`);
        }
    }, [open, lead]);

    const handleConfirm = async () => {
        if (!date) {
            toast.error('Please select a date');
            return;
        }

        setSaving(true);
        try {
            const [hours, minutes] = time.split(':').map(Number);
            const newDateTime = new Date(date);
            newDateTime.setHours(hours, minutes, 0, 0);

            if (lead.isMeeting) {
                const targetUrl = (orgClient as any)?.supabaseUrl || 'default';
                const isDefaultHost = targetUrl.includes('api.fastestcrm.com') || targetUrl.includes('uykdyqdeyilpulaqlqip');

                const primaryTable = isDefaultHost ? 'calendar_events' : 'calendar_bookings';
                const fallbackTable = isDefaultHost ? 'calendar_bookings' : 'calendar_events';

                // Fetch the event to get its duration
                let event: any = null;
                const { data: pEvent } = await orgClient
                    .from(primaryTable as any)
                    .select('start_time, end_time')
                    .eq('id', lead.id)
                    .single();

                if (pEvent) {
                    event = pEvent;
                } else {
                    const { data: fbEvent } = await orgClient
                        .from(fallbackTable as any)
                        .select('start_time, end_time')
                        .eq('id', lead.id)
                        .single();
                    event = fbEvent;
                }

                if (!event) throw new Error('Meeting event not found');

                const originalDuration = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
                const newEndTime = new Date(newDateTime.getTime() + originalDuration);

                const { error: updateError } = await orgClient
                    .from(primaryTable as any)
                    .update({
                        start_time: newDateTime.toISOString(),
                        end_time: newEndTime.toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', lead.id);

                if (updateError) {
                    await orgClient
                        .from(fallbackTable as any)
                        .update({
                            start_time: newDateTime.toISOString(),
                            end_time: newEndTime.toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', lead.id);
                }
            } else {
                const { error: updateError } = await supabase
                    .from(tableName as any)
                    .update({
                        reminder_at: newDateTime.toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', lead.id);
                if (updateError) throw updateError;
            }

            toast.success('Task rescheduled successfully');
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Error rescheduling task:', error);
            toast.error('Failed to reschedule task');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Reschedule Task</DialogTitle>
                    <DialogDescription>
                        Update the reminder date and time for "{lead.name}".
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="flex flex-col gap-2">
                        <Label>Select Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, 'PPP') : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="time">Select Time</Label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="time"
                                type="time"
                                className="pl-9"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={saving || !date}>
                        {saving ? 'Saving...' : 'Reschedule'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
