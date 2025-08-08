import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";

const Policies = () => {
  return (
    <AppLayout title="Policies">
      <Seo title="Policies | Company Admin" description="Configure repayment policies and eligibility rules." />
      <section aria-labelledby="policies-heading" className="space-y-4">
        <h2 id="policies-heading" className="sr-only">Repayment policies</h2>
        <p className="text-muted-foreground">Set max amounts, durations, and interest policies for your company.</p>
        <div className="rounded-md border p-6">
          <p>Coming soon: policy editor with validation and previews.</p>
        </div>
      </section>
    </AppLayout>
  );
};

export default Policies;
