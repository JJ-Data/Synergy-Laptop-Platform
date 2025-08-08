import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";

const Requests = () => {
  return (
    <AppLayout title="Requests">
      <Seo title="Requests | Company Admin" description="Review and approve employee device financing requests." />
      <section aria-labelledby="requests-heading" className="space-y-4">
        <h2 id="requests-heading" className="sr-only">Requests list</h2>
        <p className="text-muted-foreground">Track pending approvals and decision history.</p>
        <div className="rounded-md border p-6">
          <p>Coming soon: request queue and approval workflow.</p>
        </div>
      </section>
    </AppLayout>
  );
};

export default Requests;
