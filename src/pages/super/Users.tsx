import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";

const Users = () => {
  return (
    <AppLayout title="Users">
      <Seo title="Users | Super Admin" description="Manage platform users and roles across all companies." />
      <section aria-labelledby="users-heading" className="space-y-4">
        <h2 id="users-heading" className="sr-only">Users list</h2>
        <p className="text-muted-foreground">Super Admins can audit and manage users and roles here.</p>
        <div className="rounded-md border p-6">
          <p>Coming soon: global user search, role assignment, and activity logs.</p>
        </div>
      </section>
    </AppLayout>
  );
};

export default Users;
