// src/pages/auth/AcceptInvite.tsx (Simplified Version)
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { InvitationService } from "@/services/invitationService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Mail } from "lucide-react";

const supabase = supabaseBrowser();

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState<
    "loading" | "valid" | "invalid" | "success"
  >("loading");
  const [invitationData, setInvitationData] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isNewUser, setIsNewUser] = useState(true);

  useEffect(() => {
    validateInvitation();
  }, [token]);

  const validateInvitation = async () => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const result = await InvitationService.validateInvitation(token);

    if (!result.valid) {
      setStatus("invalid");
      toast.error(result.error || "Invalid invitation");
      return;
    }

    setInvitationData(result.invitation);
    setEmail(result.invitation.email);
    setStatus("valid");

    // If user is already logged in with the correct email, auto-accept
    if (user && user.email === result.invitation.email) {
      await acceptInvitation();
    }
  };

  const acceptInvitation = async () => {
    if (!token || !user) return;

    try {
      await InvitationService.acceptInvitation(token, user.id);
      setStatus("success");
      toast.success("Invitation accepted successfully!");

      setTimeout(() => {
        navigate(invitationData.role === "admin" ? "/admin" : "/employee");
      }, 2000);
    } catch (error) {
      toast.error("Failed to accept invitation");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isNewUser) {
        // Sign up new user
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.href,
          },
        });

        if (error) throw error;

        toast.success(
          "Account created! Check your email to verify, then return here."
        );
      } else {
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Will auto-accept via useEffect
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-8">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground text-center mb-4">
              This invitation link is invalid or has expired.
            </p>
            <Button onClick={() => navigate("/login")}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome!</h2>
            <p className="text-muted-foreground text-center">
              Redirecting to your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Accept Invitation
          </CardTitle>
          <CardDescription>
            You've been invited to join{" "}
            <strong>{invitationData?.companies?.name}</strong> as{" "}
            {invitationData?.role === "admin" ? "an admin" : "an employee"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input value={email} disabled className="bg-muted" />
              </div>

              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="existing"
                  checked={!isNewUser}
                  onChange={(e) => setIsNewUser(!e.target.checked)}
                />
                <Label htmlFor="existing" className="text-sm cursor-pointer">
                  I already have an account
                </Label>
              </div>

              <Button type="submit" className="w-full">
                {isNewUser ? "Create Account & Accept" : "Sign In & Accept"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>Signed in as {user.email}</AlertDescription>
              </Alert>
              <Button onClick={acceptInvitation} className="w-full">
                Accept Invitation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
