import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const LoadingSpinner = ({
  className,
  size = "md",
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex justify-center items-center p-4", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
    </div>
  );
};

export const LoadingCard = ({
  message = "Loading...",
}: {
  message?: string;
}) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-4">
    <LoadingSpinner size="lg" />
    <p className="text-muted-foreground">{message}</p>
  </div>
);
