import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";

const supabase = supabaseBrowser();

const laptopSchema = z.object({
  name: z.string().min(1, "Name is required"),
  brand: z.string().min(1, "Brand is required"),
  cpu: z.string().optional(),
  ram_gb: z.coerce.number().min(1, "RAM must be at least 1GB"),
  storage_gb: z.coerce.number().min(1, "Storage must be at least 1GB"),
  price_cents: z.coerce.number().min(1, "Price must be greater than 0"),
  image_url: z.string().url().optional().or(z.literal("")),
});

type LaptopFormData = z.infer<typeof laptopSchema>;

const AdminDashboard = () => {
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const [isLaptopDialogOpen, setIsLaptopDialogOpen] = useState(false);
  const [editingLaptop, setEditingLaptop] = useState<Tables<"laptops"> | null>(
    null
  );

  const laptopForm = useForm<LaptopFormData>({
    resolver: zodResolver(laptopSchema),
    defaultValues: {
      name: "",
      brand: "",
      cpu: "",
      ram_gb: 8,
      storage_gb: 256,
      price_cents: 0,
      image_url: "",
    },
  });

  const { data: policy, isLoading: loadingPolicy } = useQuery({
    queryKey: ["policy", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("policies")
        .select("max_amount_cents, interest_rate, durations_months")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: laptops, isLoading: loadingLaptops } = useQuery({
    queryKey: ["laptops", companyId],
    queryFn: async () => {
      if (!companyId) return [] as Tables<"laptops">[];
      const { data, error } = await supabase
        .from("laptops")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const createLaptopMutation = useMutation({
    mutationFn: async (data: LaptopFormData) => {
      if (!companyId) throw new Error("No company selected");

      const { error } = await supabase.from("laptops").insert([
        {
          company_id: companyId,
          name: data.name,
          brand: data.brand,
          cpu: data.cpu || null,
          ram_gb: data.ram_gb,
          storage_gb: data.storage_gb,
          price_cents: Math.round(data.price_cents * 100), // Convert to cents
          image_url: data.image_url || null,
        },
      ]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laptops"] });
      toast.success("Laptop added successfully");
      setIsLaptopDialogOpen(false);
      laptopForm.reset();
      setEditingLaptop(null);
    },
    onError: (error) => {
      toast.error("Failed to add laptop: " + error.message);
    },
  });

  const updateLaptopMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LaptopFormData }) => {
      const { error } = await supabase
        .from("laptops")
        .update({
          name: data.name,
          brand: data.brand,
          cpu: data.cpu || null,
          ram_gb: data.ram_gb,
          storage_gb: data.storage_gb,
          price_cents: Math.round(data.price_cents * 100),
          image_url: data.image_url || null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laptops"] });
      toast.success("Laptop updated successfully");
      setIsLaptopDialogOpen(false);
      laptopForm.reset();
      setEditingLaptop(null);
    },
    onError: (error) => {
      toast.error("Failed to update laptop: " + error.message);
    },
  });

  const deleteLaptopMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("laptops")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laptops"] });
      toast.success("Laptop removed from catalog");
    },
    onError: (error) => {
      toast.error("Failed to remove laptop: " + error.message);
    },
  });

  const handleCreateLaptop = () => {
    setEditingLaptop(null);
    laptopForm.reset({
      name: "",
      brand: "",
      cpu: "",
      ram_gb: 8,
      storage_gb: 256,
      price_cents: 0,
      image_url: "",
    });
    setIsLaptopDialogOpen(true);
  };

  const handleEditLaptop = (laptop: Tables<"laptops">) => {
    setEditingLaptop(laptop);
    laptopForm.reset({
      name: laptop.name,
      brand: laptop.brand || "",
      cpu: laptop.cpu || "",
      ram_gb: laptop.ram_gb || 8,
      storage_gb: laptop.storage_gb || 256,
      price_cents: Math.round((laptop.price_cents || 0) / 100), // Convert from cents
      image_url: laptop.image_url || "",
    });
    setIsLaptopDialogOpen(true);
  };

  const onSubmitLaptop = (data: LaptopFormData) => {
    if (editingLaptop) {
      updateLaptopMutation.mutate({ id: editingLaptop.id, data });
    } else {
      createLaptopMutation.mutate(data);
    }
  };

  const isSubmitting =
    createLaptopMutation.isPending || updateLaptopMutation.isPending;

  return (
    <AppLayout title="Company Admin">
      <Seo
        title="Company Admin | Dashboard"
        description="Manage catalog, policies, and financing requests."
        canonical="/admin"
      />

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Repayment Policy</CardTitle>
            <CardDescription>Control max budgets and terms</CardDescription>
          </CardHeader>
          <CardContent>
            {!companyId && (
              <div className="text-sm text-muted-foreground">
                No company context. Log in as an Admin to view policies.
              </div>
            )}
            {companyId && loadingPolicy && (
              <div className="text-sm text-muted-foreground">
                Loading policy…
              </div>
            )}
            {companyId && !loadingPolicy && !policy && (
              <div className="text-sm text-muted-foreground">
                No policy configured yet. Use the Policies page to create one.
              </div>
            )}
            {companyId && policy && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Max Amount (₦)</Label>
                  <Input
                    value={(policy.max_amount_cents ?? 0) / 100}
                    readOnly
                  />
                </div>
                <div>
                  <Label>Interest Rate (%)</Label>
                  <Input value={policy.interest_rate ?? 0} readOnly />
                </div>
                <div className="sm:col-span-2">
                  <Label>Allowed Durations</Label>
                  <Select disabled>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={policy.durations_months?.join(", ") || "—"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(policy.durations_months || []).map((m: number) => (
                        <SelectItem key={m} value={String(m)}>
                          {m} months
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Upload className="mr-2 h-4 w-4" />
              Invite Employees
            </Button>
            <Button variant="outline" className="w-full justify-start">
              View Pending Requests
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Generate Reports
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Laptop Catalog</h2>
            <p className="text-sm text-muted-foreground">
              Manage available devices for employee financing
            </p>
          </div>
          <Button variant="hero" onClick={handleCreateLaptop}>
            <Plus className="mr-2 h-4 w-4" />
            Add Laptop
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {!companyId && (
            <div className="text-sm text-muted-foreground">
              No company context.
            </div>
          )}
          {companyId && loadingLaptops && (
            <div className="text-sm text-muted-foreground">
              Loading laptops…
            </div>
          )}
          {companyId && !loadingLaptops && (laptops?.length ?? 0) === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-muted-foreground mb-4">
                  No laptops in catalog yet
                </div>
                <Button variant="hero" onClick={handleCreateLaptop}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Laptop
                </Button>
              </CardContent>
            </Card>
          )}
          {companyId &&
            (laptops || []).map((laptop) => (
              <Card
                key={laptop.id}
                className="group overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="h-44 overflow-hidden">
                  <img
                    src={laptop.image_url || "/placeholder.svg"}
                    alt={`${laptop.name} laptop image`}
                    className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                    loading="lazy"
                  />
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {laptop.brand
                      ? `${laptop.brand} ${laptop.name}`
                      : laptop.name}
                  </CardTitle>
                  <CardDescription>
                    {[
                      laptop.cpu,
                      laptop.ram_gb ? `${laptop.ram_gb}GB RAM` : null,
                      laptop.storage_gb
                        ? `${laptop.storage_gb}GB Storage`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-semibold text-lg">
                      ₦
                      {Math.round(
                        (laptop.price_cents ?? 0) / 100
                      ).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEditLaptop(laptop)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteLaptopMutation.mutate(laptop.id)}
                      disabled={deleteLaptopMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </section>

      {/* Laptop Form Dialog */}
      <Dialog open={isLaptopDialogOpen} onOpenChange={setIsLaptopDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLaptop ? "Edit Laptop" : "Add New Laptop"}
            </DialogTitle>
            <DialogDescription>
              {editingLaptop
                ? "Update laptop specifications and pricing"
                : "Add a new laptop to your company catalog"}
            </DialogDescription>
          </DialogHeader>

          <Form {...laptopForm}>
            <form
              onSubmit={laptopForm.handleSubmit(onSubmitLaptop)}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={laptopForm.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Apple, HP, Dell" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={laptopForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., MacBook Pro, EliteBook"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={laptopForm.control}
                name="cpu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Processor (CPU)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Intel Core i7, Apple M2"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={laptopForm.control}
                  name="ram_gb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RAM (GB)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="8" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={laptopForm.control}
                  name="storage_gb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Storage (GB)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="256" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={laptopForm.control}
                name="price_cents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (₦)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="500000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={laptopForm.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/laptop-image.jpg"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLaptopDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Saving..."
                    : editingLaptop
                    ? "Update Laptop"
                    : "Add Laptop"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminDashboard;
