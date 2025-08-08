import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";

const Repayments = () => {
  return (
    <AppLayout title="Repayments">
      <Seo title="Repayments | Employee" description="View your repayment schedule, deductions, and outstanding balance." />
      <section aria-labelledby="repayments-heading" className="space-y-4">
        <h2 id="repayments-heading" className="sr-only">Repayment details</h2>
        <p className="text-muted-foreground">Stay on top of your current balance and upcoming deductions.</p>
        <div className="rounded-md border p-6">
          <p>Coming soon: repayment timeline and receipts.</p>
        </div>
      </section>
    </AppLayout>
  );
};

export default Repayments;
