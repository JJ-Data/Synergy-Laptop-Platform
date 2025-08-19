import { useState } from "react";
import { parse } from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, XCircle } from "lucide-react";

export const BulkEmployeeUpload = ({ companyId }: { companyId: string }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "text/csv") {
      setFile(file);
      parseCSV(file);
    } else {
      toast.error("Please upload a CSV file");
    }
  };

  const parseCSV = (file: File) => {
    parse(file, {
      header: true,
      complete: (results) => {
        setResults(results.data);
      },
      error: (error) => {
        toast.error("Failed to parse CSV: " + error.message);
      },
    });
  };

  const sendInvitations = async () => {
    if (!results || results.length === 0) return;

    setUploading(true);
    const successes: string[] = [];
    const failures: { email: string; error: any }[] = [];
    const batchSize = 10;

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);

      const promises = batch.map((row: any) => {
        if (!row.email) {
          return Promise.resolve({ email: row.email, error: new Error("Invalid email") });
        }

        return supabase
          .rpc("create_invitation", {
            _email: row.email,
            _role: "employee",
            _company_id: companyId,
          })
          .then(({ error }) => {
            if (error) throw error;
            return { email: row.email };
          })
          .catch((error) => ({ email: row.email, error }));
      });

      const batchResults = await Promise.all(promises);

      batchResults.forEach((res) => {
        if (res.error) {
          failures.push({ email: res.email, error: res.error });
        } else {
          successes.push(res.email);
        }
      });
    }

    setUploading(false);

    if (failures.length === 0) {
      toast.success(`Sent ${successes.length} invitations successfully`);
    } else if (successes.length === 0) {
      toast.error(`Failed to send ${failures.length} invitations`);
    } else {
      toast(`Sent ${successes.length} invitations, failed to send ${failures.length}`);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Bulk Employee Upload</h3>

      <div className="space-y-4">
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">
            Upload a CSV file with employee emails
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload">
            <Button variant="outline" as="span" className="cursor-pointer">
              <FileText className="h-4 w-4 mr-2" />
              Choose CSV File
            </Button>
          </label>
        </div>

        {file && (
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm">File: {file.name}</p>
            <p className="text-sm text-muted-foreground">
              {results ? `${results.length} emails found` : "Processing..."}
            </p>
          </div>
        )}

        {results && results.length > 0 && (
          <>
            <div className="max-h-40 overflow-y-auto border rounded p-2">
              {results.slice(0, 5).map((row: any, i: number) => (
                <div key={i} className="text-sm py-1">
                  {row.email || "Invalid row"}
                </div>
              ))}
              {results.length > 5 && (
                <p className="text-sm text-muted-foreground">
                  ...and {results.length - 5} more
                </p>
              )}
            </div>

            <Button
              onClick={sendInvitations}
              disabled={uploading}
              className="w-full"
            >
              {uploading
                ? "Sending Invitations..."
                : `Send ${results.length} Invitations`}
            </Button>
          </>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            CSV should have an "email" column. Example:
            <pre className="mt-2 text-xs">
              email john@company.com jane@company.com
            </pre>
          </AlertDescription>
        </Alert>
      </div>
    </Card>
  );
};
