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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  Building,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";

type InvitationStatus =
  | "checking"
  | "needs-auth"
  | "accepting"
  | "success"
  | "error";

interface InviteDetails {
  email: string;
  role: string;
  company_id: string;
  company_name: string;
  expires_at: string;
}

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<InvitationStatus>("checking");
  const [message, setMessage] = useState<string>("");
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(
    null
  );
  const [acceptProgress, setAcceptProgress] = useState(0);

  // Form state for signup/signin
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dashboardPath = useMemo(() => {
    if (!user) return "/";
    if (user.role === "super_admin") return "/super";
    if (user.role === "admin") return "/admin";
    return "/employee";
  }, [user]);

  // Enhanced invitation validation
  useEffect(() => {
    const checkInvitation = async () => {
      if (!token) {
        setStatus("error");
        setMessage(
          "Invalid invitation link. Please check the URL and try again."
        );
        return;
      }

      try {
        setStatus("checking");

        // Use the enhanced validation function
        const { data, error } = await supabase.rpc(
          "validate_invitation_token",
          {
            _token: token,
          }
        );

        if (error) {
          console.error("Error validating token:", error);
          setStatus("error");
          setMessage(
            "Failed to validate invitation. Please try again or contact support."
          );
          return;
        }

        if (!data || !data.valid) {
          setStatus("error");
          setMessage(
            data?.error || "This invitation link is invalid or has expired."
          );
          return;
        }

        // Store invitation details
        const details: InviteDetails = {
          email: data.email,
          role: data.role,
          company_id: data.company_id,
          company_name: data.company_name,
          expires_at: data.expires_at,
        };

        setInviteDetails(details);
        setEmail(details.email);

        // Check if user is authenticated
        if (!user) {
          setStatus("needs-auth");
        } else {
          // User is logged in, check if email matches
          const {
            data: { user: currentUser },
          } = await supabase.auth.getUser();
          if (currentUser?.email !== details.email) {
            setStatus("error");
            setMessage(
              `This invitation is for ${details.email}. Please sign out and sign in with the correct email address.`
            );
            return;
          }
          // Accept the invitation
          acceptInvitation();
        }
      } catch (err: any) {
        console.error("Invitation check error:", err);
        setStatus("error");
        setMessage(
          "Something went wrong. Please try again or contact support."
        );
      }
    };

    checkInvitation();
  }, [token, user]);

  const acceptInvitation = async () => {
    if (!token) return;

    setStatus("accepting");
    setAcceptProgress(20);

    try {
      // Progress simulation for better UX
      const progressInterval = setInterval(() => {
        setAcceptProgress((prev) => Math.min(prev + 15, 80));
      }, 200);

      const { data, error } = await supabase.rpc("accept_invitation", {
        _token: token,
      });

      clearInterval(progressInterval);
      setAcceptProgress(100);

      if (error) {
        console.error("Error accepting invitation:", error);
        setStatus("error");
        setMessage(
          error.message || "Failed to accept invitation. Please try again."
        );
        return;
      }

      if (data !== true) {
        setStatus("error");
        setMessage(
          "Failed to accept invitation. Please try again or contact support."
        );
        return;
      }

      setStatus("success");
      toast.success("Welcome to your new role!");

      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = dashboardPath;
      }, 2000);
    } catch (err: any) {
      console.error("Accept invitation error:", err);
      setStatus("error");
      setMessage(
        err.message || "An unexpected error occurred. Please try again."
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
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Signed in successfully!");
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleInfo = (role: string) => {
    switch (role) {
      case "admin":
        return {
          icon: Building,
          title: "Company Administrator",
          description: "Manage laptops, policies, and employee requests",
          color: "text-blue-600",
        };
      case "super_admin":
        return {
          icon: Shield,
          title: "Super Administrator",
          description: "Manage companies and platform-wide settings",
          color: "text-purple-600",
        };
      default:
        return {
          icon: Mail,
          title: "Employee",
          description: "Request financing and manage repayments",
          color: "text-green-600",
        };
    }
  };

  // Loading state
  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/50">
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/50">
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
    const roleInfo = inviteDetails ? getRoleInfo(inviteDetails.role) : null;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/50">
        <Seo title="Invitation Accepted" />
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-3">Welcome Aboard!</h2>

            {roleInfo && (
              <div className="bg-muted rounded-lg p-4 mb-4 w-full">
                <div className="flex items-center gap-3 mb-2">
                  <roleInfo.icon className={`h-5 w-5 ${roleInfo.color}`} />
                  <span className="font-medium">{roleInfo.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {roleInfo.description}
                </p>
              </div>
            )}

            <p className="text-muted-foreground mb-6">
              You now have access to{" "}
              <strong>{inviteDetails?.company_name}</strong>
            </p>

            <div className="text-sm text-muted-foreground mb-4">
              Redirecting to your dashboard...
            </div>
            <Progress value={100} className="w-full h-2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Accepting state
  if (status === "accepting") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/50">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground mb-4">
              Setting up your access...
            </p>
            <Progress value={acceptProgress} className="w-full h-2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Enhanced needs authentication state
  const roleInfo = inviteDetails ? getRoleInfo(inviteDetails.role) : null;
  const daysUntilExpiry = inviteDetails
    ? Math.ceil(
        (new Date(inviteDetails.expires_at).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/50">
      <Seo
        title="Accept Invitation"
        description="Accept your invitation to join the platform."
      />

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            You're Invited!
          </CardTitle>
          <CardDescription>
            {inviteDetails && (
              <>
                Join <strong>{inviteDetails.company_name}</strong> as{" "}
                {roleInfo && (
                  <span className={roleInfo.color}>
                    {roleInfo.title.toLowerCase()}
                  </span>
                )}
              </>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Role Information */}
          {roleInfo && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <roleInfo.icon className={`h-5 w-5 ${roleInfo.color}`} />
                <span className="font-medium">{roleInfo.title}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {roleInfo.description}
              </p>
            </div>
          )}

          {/* Expiry Warning */}
          {daysUntilExpiry <= 2 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This invitation expires in {daysUntilExpiry} day
                {daysUntilExpiry !== 1 ? "s" : ""}!
              </AlertDescription>
            </Alert>
          )}

          <Alert>
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
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
