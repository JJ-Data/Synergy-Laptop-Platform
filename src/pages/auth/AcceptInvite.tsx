// Fixed AcceptInvite.tsx - Uses validation function instead of direct table access
// Replace your current AcceptInvite component with this version

import { useEffect, useState } from "react";
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
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debug: Log all steps
  const debugLog = (step: string, data: any) => {
    console.log(`DEBUG [${step}]:`, data);
    setDebugInfo((prev) => ({ ...prev, [step]: data }));
  };

  useEffect(() => {
    const checkInvitation = async () => {
      debugLog("1. Starting validation", { token });

      if (!token) {
        setStatus("error");
        setMessage("No invitation token found in the URL.");
        return;
      }

      try {
        setStatus("checking");

        // Use the validation function instead of direct table access
        debugLog("2. Calling validate_invitation_token function", { token });

        const { data: validationResult, error: validationError } =
          await supabase.rpc("validate_invitation_token", { _token: token });

        debugLog("3. Validation function result", {
          validationResult,
          validationError,
        });

        if (validationError) {
          setStatus("error");
          setMessage(
            "Failed to validate invitation: " + validationError.message
          );
          return;
        }

        if (!validationResult || !validationResult.valid) {
          setStatus("error");
          setMessage(validationResult?.error || "Invalid invitation token.");
          return;
        }

        // Extract invitation details from validation result
        const details = {
          email: validationResult.email,
          role: validationResult.role,
          company_id: validationResult.company_id,
          company_name: validationResult.company_name,
          expires_at: validationResult.expires_at,
        };

        debugLog("4. Invitation details extracted", details);
        setInviteDetails(details);
        setEmail(details.email);

        // Check if user is authenticated
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        debugLog("5. Current user check", { currentUser });

        if (!currentUser) {
          setStatus("needs-auth");
        } else {
          // User is logged in, check if email matches
          if (currentUser.email !== details.email) {
            setStatus("error");
            setMessage(
              `This invitation is for ${details.email}. Please sign out and sign in with the correct email.`
            );
            return;
          }
          // Accept the invitation
          acceptInvitation();
        }
      } catch (err: any) {
        debugLog("ERROR in checkInvitation", err);
        console.error("Invitation check error:", err);
        setStatus("error");
        setMessage("Failed to validate invitation: " + err.message);
      }
    };

    checkInvitation();
  }, [token, user]);

  const acceptInvitation = async () => {
    if (!token) return;

    debugLog("6. Starting acceptance", { token });
    setStatus("accepting");

    try {
      const { data, error } = await supabase.rpc("accept_invitation", {
        _token: token,
      });

      debugLog("7. Accept invitation result", { data, error });

      if (error) {
        console.error("Error accepting invitation:", error);
        setStatus("error");
        setMessage("Failed to accept invitation: " + error.message);
        return;
      }

      if (data !== true) {
        setStatus("error");
        setMessage(
          "Failed to accept invitation. Unexpected response: " +
            JSON.stringify(data)
        );
        return;
      }

      setStatus("success");
      toast.success("Invitation accepted successfully!");

      // Determine redirect path based on role
      const redirectPath =
        inviteDetails?.role === "admin" ? "/admin" : "/employee";

      // Redirect after a short delay with page reload to refresh auth context
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 2000);
    } catch (err: any) {
      debugLog("ERROR in acceptInvitation", err);
      console.error("Accept invitation error:", err);
      setStatus("error");
      setMessage("An error occurred: " + err.message);
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
    debugLog("8. Starting authentication", { email, isSignUp });

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
          },
        });

        debugLog("9. SignUp result", { data, error });

        if (error) {
          toast.error(error.message);
        } else if (data?.user?.identities?.length === 0) {
          toast.error(
            "An account with this email already exists. Please sign in instead."
          );
          setIsSignUp(false);
        } else {
          // Check if email confirmation is required
          if (data.user && !data.session) {
            toast.success(
              "Account created! Please check your email to verify, then return here."
            );
          } else {
            toast.success("Account created successfully!");
            // The useEffect will trigger and accept the invitation
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        debugLog("10. SignIn result", { data, error });

        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Signed in successfully!");
          // The useEffect will trigger and accept the invitation
        }
      }
    } catch (err: any) {
      debugLog("ERROR in handleAuth", err);
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
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>

            {/* Debug Information - only show in development */}
            {process.env.NODE_ENV === "development" && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  Debug Information (Dev Only)
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            )}

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
            <h2 className="text-xl font-semibold mb-2">Welcome!</h2>
            <p className="text-muted-foreground text-center mb-4">
              You now have <strong>{inviteDetails?.role}</strong> access to{" "}
              <strong>{inviteDetails?.company_name}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to your dashboard...
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
            <p className="text-sm text-muted-foreground mt-2">
              Setting up your {inviteDetails?.role} access...
            </p>
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
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            You've been invited to join{" "}
            <strong>{inviteDetails?.company_name || "our platform"}</strong> as{" "}
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

          {/* Debug Information - only show in development */}
          {process.env.NODE_ENV === "development" && debugInfo && (
            <details className="mt-4 text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                Debug Information (Dev Only)
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
