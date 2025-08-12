import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"idle" | "accepting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const dashboardPath = useMemo(() => {
    if (!user) return "/";
    if (user.role === "super_admin") return "/super";
    if (user.role === "admin") return "/admin";
    return "/employee";
  }, [user]);

  useEffect(() => {
    const run = async () => {
      if (!token || !user) return;
      setStatus("accepting");
      const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
      if (error || data !== true) {
        setStatus("error");
        setMessage(error?.message || "Invalid or expired invitation token.");
        return;
      }
      setStatus("success");
    };
    run();
  }, [token, user]);

  const goDashboard = () => navigate(dashboardPath, { replace: true });

  const loginState = { from: { pathname: token ? `/accept-invite?token=${token}` : "/accept-invite" } } as any;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Seo title="Accept Invitation" description="Accept your invitation to join the platform." canonical="/accept-invite" />
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>
            {token ? "Use your invitation token to gain access." : "A token is required to accept an invitation."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token && (
            <div className="text-sm text-muted-foreground">No token found in the URL. Please use the link provided in your invitation.</div>
          )}

          {token && !user && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">You must sign in to accept the invitation.</p>
              <Link to="/login" state={loginState}>
                <Button className="w-full" variant="hero">Sign in to continue</Button>
              </Link>
            </div>
          )}

          {token && user && status === "idle" && (
            <div className="text-sm text-muted-foreground">Preparing to accept your invitation…</div>
          )}

          {user && status === "accepting" && (
            <div className="text-sm text-muted-foreground">Accepting invitation…</div>
          )}

          {user && status === "success" && (
            <div className="space-y-3">
              <p className="text-sm">Invitation accepted! Your access has been updated.</p>
              <Button onClick={goDashboard} variant="hero" className="w-full">Go to dashboard</Button>
            </div>
          )}

          {user && status === "error" && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{message}</p>
              <Button onClick={goDashboard} variant="outline" className="w-full">Return to dashboard</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
