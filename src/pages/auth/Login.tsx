import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Seo from "@/components/seo/Seo";
import heroImage from "@/assets/hero-finance.jpg";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  mode: z.enum(["signin", "signup"]).default("signin"),
});

type FormValues = z.infer<typeof schema>;

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const from = location.state?.from?.pathname as string | undefined;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mode: "signin" },
  });

  const mode = watch("mode");

  const onSubmit = async (values: FormValues) => {
    const { error } = await login(values.email, values.password, values.mode);
    if (error) return alert(error);

    // After sign-in, route by role
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, company_id")
        .eq("user_id", session.user.id);
      let dest = "/";
      if ((roles || []).some((r) => r.role === "super_admin")) dest = "/super";
      else if ((roles || []).some((r) => r.role === "admin")) dest = "/admin";
      else dest = "/employee";
      return navigate(from || dest, { replace: true });
    }
    navigate(from || "/", { replace: true });
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
            <p className="text-muted-foreground mt-2">Sign in or create your account.</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="flex gap-2">
              <Button type="button" variant={mode === "signin" ? "hero" : "outline"} className="w-1/2" onClick={() => setValue("mode", "signin")}>Sign In</Button>
              <Button type="button" variant={mode === "signup" ? "hero" : "outline"} className="w-1/2" onClick={() => setValue("mode", "signup")}>Sign Up</Button>
            </div>
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
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
            <p className="text-xs text-muted-foreground">
              First user to sign in will auto‑become Super Admin.
            </p>
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

