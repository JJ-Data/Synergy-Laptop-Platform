import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Seo from "@/components/seo/Seo";
import heroImage from "@/assets/hero-finance.jpg";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormValues = z.infer<typeof schema>;

const Login = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (user) {
      let dest = "/";
      if (user.role === "super_admin") dest = "/super";
      else if (user.role === "admin") dest = "/admin";
      else dest = "/employee";
      navigate(from || dest, { replace: true });
    }
  }, [user, navigate, from]);

  const onSubmit = async (values: FormValues) => {
    const { error } = await login(values.email, values.password, "signin");
    if (error) return toast.error(error.message);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <Seo title="Login" description="Access the multi-tenant laptop financing platform." canonical="/login" />
      <section className="relative hidden lg:block">
        <img src={heroImage} alt="Financing platform abstract hero" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-br from-background/10 to-background/60" />
      </section>
      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold">Welcome</h1>
            <p className="text-muted-foreground mt-2">Sign in to your account.</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={isSubmitting}>
              Sign in
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a href="mailto:?subject=Access request — Laptop Financing Platform&body=Hello Admin,%0D%0A%0D%0APlease invite me to the platform. My email is: ____%0D%0A%0D%0AThanks!">Contact Admin</a>
            </Button>
            <div className="text-xs text-muted-foreground">
              <Link to="/">Back to home</Link>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};

export default Login;

