// src/components/company/BulkEmployeeUpload.tsx - Fixed version with proper imports
import { useState } from "react";
import { parse } from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface BulkEmployeeUploadProps {
  companyId: string;
}

export const BulkEmployeeUpload = ({ companyId }: BulkEmployeeUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [processed, setProcessed] = useState<{
    successes: string[];
    failures: Array<{ email: string; error: string }>;
  } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
      setProcessed(null);
      parseCSV(selectedFile);
    } else {
      toast.error("Please upload a CSV file");
    }
  };

  const parseCSV = (file: File) => {
    parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("CSV parsed:", results);

        // Validate that we have email column
        const data = results.data as Array<Record<string, string>>;
        const validEmails = data.filter(
          (row) =>
            row.email &&
            typeof row.email === "string" &&
            row.email.includes("@")
        );

        if (validEmails.length === 0) {
          toast.error("No valid email addresses found in CSV");
          setResults(null);
          return;
        }

        setResults(validEmails);
        toast.success(`Found ${validEmails.length} valid email addresses`);
      },
      error: (error) => {
        console.error("CSV parse error:", error);
        toast.error("Failed to parse CSV: " + error.message);
        setResults(null);
      },
    });
  };

  const sendInvitations = async () => {
    if (!results || results.length === 0) {
      toast.error("No valid email addresses to process");
      return;
    }

    setUploading(true);
    const successes: string[] = [];
    const failures: Array<{ email: string; error: string }> = [];

    console.log(`Processing ${results.length} invitations...`);

    for (const row of results) {
      if (!row.email) continue;

      try {
        console.log(`Creating invitation for: ${row.email}`);

        const { data, error } = await supabase.rpc("create_invitation", {
          _email: row.email.trim(),
          _role: "employee",
          _company_id: companyId,
        });

        if (error) {
          console.error(`Invitation error for ${row.email}:`, error);
          throw error;
        }

        console.log(`Invitation created for ${row.email}:`, data);
        successes.push(row.email);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`Failed to invite ${row.email}:`, error);
        failures.push({
          email: row.email,
          error: error.message || "Unknown error",
        });
      }
    }

    setUploading(false);
    setProcessed({ successes, failures });

    // Show results
    if (successes.length > 0) {
      toast.success(`Successfully sent ${successes.length} invitations`);
    }
    if (failures.length > 0) {
      toast.error(`Failed to send ${failures.length} invitations`);
    }

    console.log("Bulk invitation results:", { successes, failures });
  };

  const resetUpload = () => {
    setFile(null);
    setResults(null);
    setProcessed(null);
    // Reset file input
    const fileInput = document.getElementById("csv-upload") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Bulk Employee Upload</h3>

      <div className="space-y-4">
        {!processed ? (
          <>
            {/* File Upload Area */}
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Upload a CSV file with employee email addresses
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" className="cursor-pointer" asChild>
                  <span>
                    <FileText className="h-4 w-4 mr-2" />
                    Choose CSV File
                  </span>
                </Button>
              </label>
            </div>

            {/* File Info */}
            {file && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium">File: {file.name}</p>
                <p className="text-sm text-muted-foreground">
                  Size: {(file.size / 1024).toFixed(1)} KB
                </p>
                {results && (
                  <p className="text-sm text-green-600 mt-1">
                    ✓ {results.length} valid email addresses found
                  </p>
                )}
              </div>
            )}

            {/* Preview */}
            {results && results.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Email Preview:</h4>
                <div className="max-h-32 overflow-y-auto border rounded p-3 bg-muted/50">
                  {results.slice(0, 10).map((row: any, i: number) => (
                    <div key={i} className="text-sm py-1">
                      {i + 1}. {row.email}
                    </div>
                  ))}
                  {results.length > 10 && (
                    <div className="text-sm text-muted-foreground py-1">
                      ... and {results.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {results && results.length > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={sendInvitations}
                  disabled={uploading}
                  className="flex-1"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending Invitations...
                    </>
                  ) : (
                    `Send ${results.length} Invitations`
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetUpload}
                  disabled={uploading}
                >
                  Reset
                </Button>
              </div>
            )}
          </>
        ) : (
          /* Results Display */
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
              <h4 className="text-lg font-semibold">
                Bulk Invitation Complete
              </h4>
              <p className="text-muted-foreground">
                Processed{" "}
                {processed.successes.length + processed.failures.length} email
                addresses
              </p>
            </div>

            {/* Success List */}
            {processed.successes.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-green-700 mb-2 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Successfully Sent ({processed.successes.length})
                </h5>
                <div className="max-h-32 overflow-y-auto border rounded p-3 bg-green-50">
                  {processed.successes.map((email, i) => (
                    <div key={i} className="text-sm py-1 text-green-700">
                      ✓ {email}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failure List */}
            {processed.failures.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-red-700 mb-2 flex items-center">
                  <XCircle className="h-4 w-4 mr-1" />
                  Failed to Send ({processed.failures.length})
                </h5>
                <div className="max-h-32 overflow-y-auto border rounded p-3 bg-red-50">
                  {processed.failures.map((failure, i) => (
                    <div key={i} className="text-sm py-1 text-red-700">
                      ✗ {failure.email}: {failure.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reset Button */}
            <Button onClick={resetUpload} variant="outline" className="w-full">
              Upload Another File
            </Button>
          </div>
        )}

        {/* Usage Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>CSV Format:</strong> Your file should have an "email" column
            header.
            <br />
            Example:
            <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
              email
              <br />
              john@company.com
              <br />
              jane@company.com
              <br />
              mike@company.com
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </Card>
  );
};
