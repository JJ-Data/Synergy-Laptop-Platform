const AdminRepayments = () => {
  const { companyId } = useCompany();

  const { data: repayments } = useQuery({
    queryKey: ["company-repayments", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("repayments")
        .select(
          `
          *,
          loans(
            employee_id,
            profiles:employee_id(display_name, email)
          )
        `
        )
        .eq("company_id", companyId)
        .eq("status", "due")
        .order("due_date");
      return data;
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (repaymentId: string) => {
      const { error } = await supabase
        .from("repayments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", repaymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["company-repayments"]);
      toast.success("Payment marked as received");
    },
  });

  return (
    <div className="space-y-4">
      <h2>Pending Repayments</h2>
      {repayments?.map((payment) => (
        <div
          key={payment.id}
          className="flex justify-between items-center p-4 border rounded"
        >
          <div>
            <p className="font-medium">
              {payment.loans?.profiles?.display_name}
            </p>
            <p className="text-sm text-muted-foreground">
              Due: {new Date(payment.due_date).toLocaleDateString()}
            </p>
            <p className="font-semibold">
              ₦{(payment.amount_cents / 100).toLocaleString()}
            </p>
          </div>
          <Button
            onClick={() => markPaidMutation.mutate(payment.id)}
            disabled={markPaidMutation.isPending}
          >
            Mark as Paid
          </Button>
        </div>
      ))}
    </div>
  );
};
