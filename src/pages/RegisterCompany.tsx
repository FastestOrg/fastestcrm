import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Building2, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { INDUSTRIES } from '@/config/industries';

const registerSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  industry: z.string().min(1, 'Please select an industry'),
  adminEmail: z.string().email('Please enter a valid email'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
  adminFullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

export default function RegisterCompany() {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const navigate = useNavigate();
  const { toast } = useToast();

  const validateForm = () => {
    setErrors({});
    try {
      registerSchema.parse({ companyName, industry, adminEmail, adminPassword, adminFullName });
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            newErrors[e.path[0] as string] = e.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('register-company', {
        body: {
          companyName,
          industry,
          adminEmail,
          adminPassword,
          adminFullName
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSuccess(true);
      toast({
        title: 'Company registered!',
        description: 'You can now sign in with your credentials.',
      });

      // Redirect to auth after 2 seconds
      setTimeout(() => {
        navigate('/auth');
      }, 2000);

    } catch (err: any) {
      toast({
        title: 'Registration failed',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass border-border/50 max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold">Welcome aboard!</h2>
              <p className="text-muted-foreground">
                Your company has been registered successfully. Redirecting you to sign in...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <Card className="glass border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Register Your Company</CardTitle>
            <CardDescription>
              Start managing leads with your own team workspace
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  placeholder="Acme Inc."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={loading}
                  className={errors.companyName ? 'border-destructive' : ''}
                />
                {errors.companyName && (
                  <p className="text-sm text-destructive">{errors.companyName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select
                  value={industry}
                  onValueChange={setIndustry}
                  disabled={loading}
                >
                  <SelectTrigger id="industry" className={errors.industry ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind.id} value={ind.id}>
                        {ind.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.industry && (
                  <p className="text-sm text-destructive">{errors.industry}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminFullName">Your Full Name</Label>
                <Input
                  id="adminFullName"
                  placeholder="John Doe"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  disabled={loading}
                  className={errors.adminFullName ? 'border-destructive' : ''}
                />
                {errors.adminFullName && (
                  <p className="text-sm text-destructive">{errors.adminFullName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminEmail">Admin Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder="you@company.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  disabled={loading}
                  className={errors.adminEmail ? 'border-destructive' : ''}
                />
                {errors.adminEmail && (
                  <p className="text-sm text-destructive">{errors.adminEmail}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminPassword">Password</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={loading}
                  className={errors.adminPassword ? 'border-destructive' : ''}
                />
                {errors.adminPassword && (
                  <p className="text-sm text-destructive">{errors.adminPassword}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full gradient-primary"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register Company
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                First seat is free. Additional seats at ₹999/month each.
              </p>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">
                Already have an account?
              </span>{' '}
              <Link
                to="/auth"
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By registering, you agree to our Terms of Service and Privacy Policy.
        </p>

        <footer className="mt-8 text-center text-sm text-muted-foreground">
          © 2025-∞ Fastest CRM by Upmarking.com. Built for Fastest Sales Teams.
        </footer>

      </div>
    </div>
  );
}
