import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<
    "checking" | "needs-auth" | "accepting" | "success" | "error"
  >("checking");
  const [message, setMessage] = useState<string>("");
  const [inviteDetails, setInviteDetails] = useState<any>(null);

  // Form state for signup/signin
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dashboardPath = useMemo(() => {
    if (!user) return "/";
    if (user.role === "super_admin") return "/super";
    if (user.role === "admin") return "/admin";
    return "/employee";
  }, [user]);

  // Check invitation validity
  useEffect(() => {
    const checkInvitation = async () => {
      if (!token) {
        setStatus("error");
        setMessage("No invitation token found in the URL.");
        return;
      }

      try {
        // Use the public function to validate the token
        const { data, error } = await supabase.rpc(
          "validate_invitation_token",
          {
            _token: token,
          }
        );

        if (error) {
          console.error("Error validating token:", error);
          setStatus("error");
          setMessage("Failed to validate invitation.");
          return;
        }

        if (!data || !data.valid) {
          setStatus("error");
          setMessage(data?.error || "Invalid invitation token.");
          return;
        }

        // Store invitation details
        setInviteDetails({
          email: data.email,
          role: data.role,
          company_id: data.company_id,
          company_name: data.company_name,
          expires_at: data.expires_at,
        });
        setEmail(data.email);

        // Check if user is authenticated
        if (!user) {
          setStatus("needs-auth");
        } else {
          // User is logged in, check if email matches
          const {
            data: { user: currentUser },
          } = await supabase.auth.getUser();
          if (currentUser?.email !== data.email) {
            setStatus("error");
            setMessage(
              `This invitation is for ${data.email}. Please sign in with that email address.`
            );
            return;
          }
          // Accept the invitation
          acceptInvitation();
        }
      } catch (err: any) {
        console.error("Invitation check error:", err);
        setStatus("error");
        setMessage("Failed to validate invitation.");
      }
    };

    checkInvitation();
  }, [token, user]);

  const acceptInvitation = async () => {
    if (!token) return;

    setStatus("accepting");
    try {
      const { data, error } = await supabase.rpc("accept_invitation", {
        _token: token,
      });

      if (error) {
        console.error("Error accepting invitation:", error);
        setStatus("error");
        setMessage(error.message || "Failed to accept invitation.");
        return;
      }

      if (data !== true) {
        setStatus("error");
        setMessage("Failed to accept invitation. Please try again.");
        return;
      }

      setStatus("success");
      toast.success("Invitation accepted successfully!");

      // Redirect after a short delay
      setTimeout(() => {
        // Force a refresh to update user roles
        window.location.href = dashboardPath;
      }, 2000);
    } catch (err: any) {
      console.error("Accept invitation error:", err);
      setStatus("error");
      setMessage(
        err.message || "An error occurred while accepting the invitation."
      );
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSignUp && password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
          },
        });

        if (error) {
          toast.error(error.message);
        } else if (data?.user?.identities?.length === 0) {
          // User already exists
          toast.error(
            "An account with this email already exists. Please sign in instead."
          );
          setIsSignUp(false);
        } else {
          toast.success(
            "Account created! Please check your email to verify, then return here."
          );
        }
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Signed in successfully!");
          // The useEffect will trigger and accept the invitation
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Seo title="Accept Invitation - Error" />
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Invitation Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button asChild variant="outline" className="flex-1">
                <Link to="/">Go to Home</Link>
              </Button>
              <Button asChild variant="default" className="flex-1">
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Seo title="Invitation Accepted" />
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation Accepted!</h2>
            <p className="text-muted-foreground text-center mb-4">
              You now have {inviteDetails?.role} access to{" "}
              {inviteDetails?.company_name}.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Accepting state
  if (status === "accepting") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Accepting invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Needs authentication state
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
      <Seo
        title="Accept Invitation"
        description="Accept your invitation to join the platform."
      />
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Welcome!</CardTitle>
          <CardDescription>
            You've been invited to join{" "}
            <strong>{inviteDetails?.company_name || "our platform"}</strong> as{" "}
            {inviteDetails?.role === "admin" ? "an" : "an"}{" "}
            <strong>{inviteDetails?.role}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isSignUp
                ? "Create an account with the invited email address to accept this invitation."
                : "Sign in to accept this invitation."}
            </AlertDescription>
          </Alert>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                This is the email address the invitation was sent to
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? "Creating Account..." : "Signing In..."}
                </>
              ) : isSignUp ? (
                "Create Account & Accept Invitation"
              ) : (
                "Sign In & Accept Invitation"
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="text-sm text-primary hover:underline"
              >
                {isSignUp
                  ? "Already have an account? Sign in instead"
                  : "Need an account? Sign up instead"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
