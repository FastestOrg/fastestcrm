import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, X } from 'lucide-react';

export function ScrollFloatingCTA() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (dismissed) return;

      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Auto-hide when near footer (within 600px of page bottom)
      const nearBottom = scrollY + windowHeight >= documentHeight - 600;

      setShow(scrollY > 600 && !nearBottom);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-lg pointer-events-auto"
        >
          <div className="rounded-2xl p-2.5 sm:px-4 sm:py-3 border border-primary/30 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_25px_rgba(20,184,166,0.2)] flex items-center justify-between gap-3 backdrop-blur-2xl bg-slate-950/90">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 hidden sm:flex">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-foreground tracking-tight flex items-center gap-1.5 truncate">
                  Ready to accelerate your sales pipeline?
                </span>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  Free 1-Seat Starter · Startup plan ₹999/mo
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link to="/register-company">
                <Button
                  size="sm"
                  className="gradient-primary font-bold text-slate-950 text-xs h-8 sm:h-9 px-3.5 sm:px-4 rounded-xl shadow-md hover:opacity-95 active:scale-[0.97] transition-all"
                >
                  Start Free
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
              <button
                onClick={() => setDismissed(true)}
                className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ScrollFloatingCTA;

