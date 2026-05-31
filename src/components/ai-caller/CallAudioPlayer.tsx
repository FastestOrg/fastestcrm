import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface CallAudioPlayerProps {
    url: string;
    logId: string;
}

export function CallAudioPlayer({ url, logId }: CallAudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [proxyUrl, setProxyUrl] = useState<string>('');

    useEffect(() => {
        let isMounted = true;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!isMounted) return;
            const token = session?.access_token || '';
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
            const generatedUrl = `${supabaseUrl}/functions/v1/ai-caller?action=get_recording&log_id=${logId}&token=${encodeURIComponent(token)}`;
            setProxyUrl(generatedUrl);
        });
        return () => {
            isMounted = false;
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, [logId]);

    const handlePlayPause = () => {
        const activeUrl = proxyUrl || url;
        if (!audioRef.current) {
            setIsLoading(true);
            const audio = new Audio(activeUrl);
            audioRef.current = audio;

            audio.addEventListener('loadedmetadata', () => {
                setDuration(audio.duration);
                setIsLoading(false);
            });

            audio.addEventListener('timeupdate', () => {
                setCurrentTime(audio.currentTime);
            });

            audio.addEventListener('ended', () => {
                setIsPlaying(false);
                setCurrentTime(0);
            });

            audio.addEventListener('canplay', () => {
                setIsLoading(false);
            });

            audio.addEventListener('error', () => {
                setIsLoading(false);
                setIsPlaying(false);
            });
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(() => setIsPlaying(false));
            setIsPlaying(true);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className="flex items-center gap-2 bg-muted/40 hover:bg-muted/60 border border-border/50 rounded-lg p-1 transition-all w-[200px] shrink-0">
            <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary shrink-0 transition-all active:scale-95"
                onClick={handlePlayPause}
                disabled={isLoading}
            >
                {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : isPlaying ? (
                    <Pause className="h-3 w-3 fill-primary text-primary" />
                ) : (
                    <Play className="h-3 w-3 fill-primary text-primary ml-0.5" />
                )}
            </Button>

            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-0.5 bg-secondary accent-primary rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none"
                />
                <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono leading-none">
                    <span>{formatTime(currentTime)}</span>
                    <span>{duration ? formatTime(duration) : '0:00'}</span>
                </div>
            </div>
            
            <a 
                href={proxyUrl || url} 
                download 
                target="_blank" 
                rel="noreferrer"
                className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 transition-colors"
                title="Download Recording"
            >
                <Download className="h-3 w-3" />
            </a>
        </div>
    );
}
