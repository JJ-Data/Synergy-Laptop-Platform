import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, Edit2, Plus } from "lucide-react";

const Catalog = () => {
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    cpu: "",
    ram_gb: "",
    storage_gb: "",
    price: "",
  });

  const { data: laptops, isLoading } = useQuery({
    queryKey: ["laptops", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("laptops")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name,
        brand: formData.brand,
        cpu: formData.cpu || null,
        ram_gb: formData.ram_gb ? parseInt(formData.ram_gb) : null,
        storage_gb: formData.storage_gb ? parseInt(formData.storage_gb) : null,
        price_cents: Math.round(parseFloat(formData.price || "0") * 100),
        company_id: companyId,
        active: true,
      };

      if (editingId) {
        const { error } = await supabase
          .from("laptops")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("laptops").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laptops"] });
      toast.success(editingId ? "Laptop updated" : "Laptop added");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save laptop");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("laptops")
        .update({ active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laptops"] });
      toast.success("Laptop removed");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove laptop");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      brand: "",
      cpu: "",
      ram_gb: "",
      storage_gb: "",
      price: "",
    });
    setEditingId(null);
  };

  const startEdit = (laptop: any) => {
    setFormData({
      name: laptop.name,
      brand: laptop.brand || "",
      cpu: laptop.cpu || "",
      ram_gb: laptop.ram_gb?.toString() || "",
      storage_gb: laptop.storage_gb?.toString() || "",
      price: ((laptop.price_cents || 0) / 100).toString(),
    });
    setEditingId(laptop.id);
  };

  if (!companyId) {
    return (
      <AppLayout title="Catalog">
        <div className="text-center py-8 text-muted-foreground">
          No company context. Please log in as an admin.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Catalog">
      <Seo
        title="Catalog | Company Admin"
        description="Manage your company's laptop catalog."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>
                {editingId ? "Edit Laptop" : "Add New Laptop"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Model Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="MacBook Pro 14"
                />
              </div>
              <div>
                <Label htmlFor="brand">Brand *</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) =>
                    setFormData({ ...formData, brand: e.target.value })
                  }
                  placeholder="Apple"
                />
              </div>
              <div>
                <Label htmlFor="price">Price (₦) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="2500000"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ram">RAM (GB)</Label>
                  <Input
                    id="ram"
                    type="number"
                    value={formData.ram_gb}
                    onChange={(e) =>
                      setFormData({ ...formData, ram_gb: e.target.value })
                    }
                    placeholder="16"
                  />
                </div>
                <div>
                  <Label htmlFor="storage">Storage (GB)</Label>
                  <Input
                    id="storage"
                    type="number"
                    value={formData.storage_gb}
                    onChange={(e) =>
                      setFormData({ ...formData, storage_gb: e.target.value })
                    }
                    placeholder="512"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="cpu">CPU</Label>
                <Input
                  id="cpu"
                  value={formData.cpu}
                  onChange={(e) =>
                    setFormData({ ...formData, cpu: e.target.value })
                  }
                  placeholder="M3 Pro"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={
                    !formData.name ||
                    !formData.brand ||
                    !formData.price ||
                    saveMutation.isPending
                  }
                  className="flex-1"
                >
                  {saveMutation.isPending
                    ? "Saving..."
                    : editingId
                    ? "Update"
                    : "Add Laptop"}
                </Button>
                {editingId && (
                  <Button variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Current Catalog ({laptops?.filter((l) => l.active)?.length || 0}{" "}
                items)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading catalog...
                </div>
              ) : laptops?.filter((l) => l.active)?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No laptops in catalog yet.</p>
                  <p className="text-sm mt-2">
                    Add your first laptop using the form.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {laptops
                    ?.filter((l) => l.active)
                    .map((laptop) => (
                      <div
                        key={laptop.id}
                        className="border rounded-lg p-4 flex justify-between items-start"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold">
                            {laptop.brand} {laptop.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {[
                              laptop.cpu,
                              laptop.ram_gb && `${laptop.ram_gb}GB RAM`,
                              laptop.storage_gb &&
                                `${laptop.storage_gb}GB Storage`,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                          <p className="text-lg font-semibold mt-2">
                            ₦
                            {((laptop.price_cents || 0) / 100).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEdit(laptop)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMutation.mutate(laptop.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Catalog;
