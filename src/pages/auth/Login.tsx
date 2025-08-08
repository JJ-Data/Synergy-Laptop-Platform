import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth, Role } from "@/context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Seo from "@/components/seo/Seo";
import heroImage from "@/assets/hero-finance.jpg";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["super_admin", "admin", "employee"]).default("employee"),
  companyId: z.string().optional(),
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
    defaultValues: { role: "employee" as Role },
  });

  const role = watch("role");

  const onSubmit = (values: FormValues) => {
    login({ email: values.email, role: values.role, companyId: values.role === "super_admin" ? null : values.companyId ?? "acme" });
    if (from) return navigate(from, { replace: true });
    if (values.role === "super_admin") navigate("/super");
    else if (values.role === "admin") navigate("/admin");
    else navigate("/employee");
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
            <h1 className="text-3xl font-semibold">Welcome back</h1>
            <p className="text-muted-foreground mt-2">Sign in to manage devices and repayments.</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select onValueChange={(v) => setValue("role", v as Role)} defaultValue={"employee"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Company Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role !== "super_admin" && (
              <div className="space-y-2">
                <Label htmlFor="companyId">Company ID</Label>
                <Input id="companyId" placeholder="e.g. acme" {...register("companyId")} />
              </div>
            )}
            <Button type="submit" variant="hero" className="w-full" disabled={isSubmitting}>
              Sign In
            </Button>
            <p className="text-xs text-muted-foreground">
              For production, enable Supabase Auth to handle secure sign-in and tenant scoping.
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
