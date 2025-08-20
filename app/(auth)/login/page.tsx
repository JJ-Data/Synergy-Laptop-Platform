import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormState, useFormStatus } from "react-dom";

async function login(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  "use server";
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  if (!email || !password) {
    return { error: "Email and password are required" };
  }
  const supabase = supabaseAdmin();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return { error: error.message };
  }
  redirect("/(dashboard)");
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Logging in..." : "Login"}
    </Button>
  );
}

function LoginForm() {
  const [state, formAction] = useFormState(login, { error: undefined });
  return (
    <form action={formAction} className="space-y-4 max-w-md">
      <Input name="email" type="email" placeholder="Email" required />
      <Input name="password" type="password" placeholder="Password" required />
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      <SubmitButton />
      <p className="text-sm text-center text-muted-foreground">
        Don't have an account? <Link href="/(auth)/register" className="underline">Register</Link>
      </p>
    </form>
  );
}

export default function Page() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold mb-6">Login</h1>
      <LoginForm />
    </div>
  );
}

