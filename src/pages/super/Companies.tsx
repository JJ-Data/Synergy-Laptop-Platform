import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";

const Companies = () => {
  return (
    <AppLayout title="Companies">
      <Seo title="Companies | Super Admin" description="Manage tenant companies in the multi-tenant laptop financing platform." />
      <section aria-labelledby="companies-heading" className="space-y-4">
        <h2 id="companies-heading" className="sr-only">Companies list</h2>
        <p className="text-muted-foreground">This section will allow Super Admins to view, create, and manage tenant companies.</p>
        <div className="rounded-md border p-6">
          <p>Coming soon: company directory, search, and onboarding workflow.</p>
        </div>
      </section>
    </AppLayout>
  );
};

export default Companies;
