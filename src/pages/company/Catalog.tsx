import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";

const Catalog = () => {
  return (
    <AppLayout title="Catalog">
      <Seo title="Catalog | Company Admin" description="Manage your company's laptop catalog and availability." />
      <section aria-labelledby="catalog-heading" className="space-y-4">
        <h2 id="catalog-heading" className="sr-only">Device catalog</h2>
        <p className="text-muted-foreground">Admins can curate devices, pricing, and stock here.</p>
        <div className="rounded-md border p-6">
          <p>Coming soon: catalog table, add/edit forms, and bulk upload.</p>
        </div>
      </section>
    </AppLayout>
  );
};

export default Catalog;
