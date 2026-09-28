"use client";

/** @fileOverview Settings › Addresses: the saved shipping address book (max 10). @stability evolving */

import { useState } from "react";
import { toast } from "sonner";
import { FiBriefcase, FiCheck, FiEdit2, FiHome, FiMapPin, FiPackage, FiPlus, FiSave, FiStar, FiTrash2, FiX } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAddresses, type Address } from "@/hooks/use-addresses";
import type { AddressLabel } from "@/generated/prisma/browser";
import { EmptyState, RowList, RowsSkeleton, SectionHeader, SettingsCard, SettingsRow, StatusPill, fieldClass } from "../settings-primitives";

const LABEL_ICON: Record<AddressLabel, React.ReactNode> = { HOME: <FiHome />, WORK: <FiBriefcase />, WAREHOUSE: <FiPackage />, PICKUP_POINT: <FiMapPin />, OTHER: <FiMapPin /> };
const LABEL_TEXT: Record<AddressLabel, string> = { HOME: "Home", WORK: "Work", WAREHOUSE: "Warehouse", PICKUP_POINT: "Pickup point", OTHER: "Other" };
const labelText = (l: AddressLabel, custom?: string | null) => (l === "OTHER" && custom ? custom : LABEL_TEXT[l] ?? custom ?? "Address");

const EMPTY_FORM = { label: "HOME" as AddressLabel, customLabel: "", addressLine1: "", addressLine2: "", postalCode: "", city: "", municipality: "", county: "", country: "NO", isDefault: false };

export function AddressesSettings() {
  const { addresses, isLoading, isCreating, isDeleting, error, createAddress, updateAddress, deleteAddress, setDefaultAddress } = useAddresses();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const startEdit = (addr: Address) => {
    setEditId(addr.id);
    setForm({ label: addr.label, customLabel: addr.customLabel || "", addressLine1: addr.addressLine1, addressLine2: addr.addressLine2 || "", postalCode: addr.postalCode, city: addr.city, municipality: addr.municipality || "", county: addr.county || "", country: addr.country, isDefault: addr.isDefault });
    setShowAdd(false);
  };
  const cancelEdit = () => { setEditId(null); setShowAdd(false); setForm(EMPTY_FORM); };
  const startAdd = () => { setEditId(null); setForm(EMPTY_FORM); setShowAdd(true); };
  const canSave = Boolean(form.addressLine1 && form.postalCode && form.city);

  const handleSave = async () => {
    if (!canSave) return;
    const data = {
      label: form.label, customLabel: form.label === "OTHER" ? form.customLabel : undefined, addressLine1: form.addressLine1, addressLine2: form.addressLine2 || undefined,
      postalCode: form.postalCode, city: form.city, municipality: form.municipality || undefined, county: form.county || undefined, country: form.country, isDefault: form.isDefault,
    };
    if (editId) {
      if (await updateAddress(editId, data)) { cancelEdit(); toast.success("Address updated"); }
    } else if (await createAddress(data)) { cancelEdit(); toast.success("Address saved"); }
  };
  const handleDelete = async (id: string) => {
    if (await deleteAddress(id)) { setDeleteConfirmId(null); toast.success("Address deleted"); }
  };

  const addressForm = (
    <SettingsCard as="form" onSubmit={(e) => { e.preventDefault(); void handleSave(); }} aria-label={editId ? "Edit address" : "New address"} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="addr-type" className="text-sm">Type</Label>
          <Select value={form.label} onValueChange={(v) => setForm({ ...form, label: v as AddressLabel })}>
            <SelectTrigger id="addr-type" className={fieldClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(LABEL_TEXT) as AddressLabel[]).map((l) => <SelectItem key={l} value={l}>{LABEL_TEXT[l]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {form.label === "OTHER" && (
          <div className="space-y-1.5">
            <Label htmlFor="addr-custom" className="text-sm">Custom label</Label>
            <Input id="addr-custom" value={form.customLabel} onChange={(e) => setForm({ ...form, customLabel: e.target.value })} placeholder="e.g. Mum’s house" className={fieldClass} />
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="addr-line1" className="text-sm">Street address <span className="text-destructive">*</span></Label>
          <Input id="addr-line1" autoComplete="address-line1" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} placeholder="Karl Johans gate 1" className={fieldClass} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="addr-line2" className="text-sm">Apartment / floor</Label>
          <Input id="addr-line2" autoComplete="address-line2" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} placeholder="H0301" className={fieldClass} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addr-postal" className="text-sm">Postal code <span className="text-destructive">*</span></Label>
          <Input id="addr-postal" autoComplete="postal-code" inputMode="numeric" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="0154" maxLength={4} className={fieldClass} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addr-city" className="text-sm">City <span className="text-destructive">*</span></Label>
          <Input id="addr-city" autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Oslo" className={fieldClass} />
        </div>
      </div>
      <SettingsRow title="Default shipping address" description="Pre-selected at checkout." htmlFor="addr-default" className="bg-foreground/[0.03]">
        <Switch id="addr-default" checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
      </SettingsRow>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="vegaEmeraldBtn" disabled={isCreating || !canSave} className="min-h-11 gap-1.5"><FiSave className="size-4" aria-hidden="true" />{editId ? "Update address" : "Save address"}</Button>
        <Button type="button" variant="vegaNormalBtn" onClick={cancelEdit} className="min-h-11 gap-1.5"><FiX className="size-4" aria-hidden="true" />Cancel</Button>
      </div>
    </SettingsCard>
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={FiMapPin}
        title="Addresses"
        description="Saved addresses for faster checkout. Up to 10."
        actions={!showAdd && !editId && <Button type="button" variant="vegaEmeraldBtn" onClick={startAdd} disabled={isLoading || addresses.length >= 10} className="min-h-11 gap-1.5"><FiPlus className="size-4" aria-hidden="true" />Add address</Button>}
      />

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {showAdd && addressForm}

      {isLoading ? (
        <RowsSkeleton rows={2} label="Loading addresses" />
      ) : addresses.length === 0 && !showAdd ? (
        <EmptyState icon={<FiMapPin />} title="No saved addresses yet" description="Add an address for faster checkout." action={<Button type="button" variant="vegaNormalBtn" onClick={startAdd} className="min-h-11">Add your first address</Button>} />
      ) : addresses.length > 0 && (
        <RowList aria-label="Saved addresses">
          {addresses.map((addr) => editId === addr.id ? (
            <div key={addr.id} className="p-1">{addressForm}</div>
          ) : (
            <SettingsRow
              key={addr.id}
              icon={LABEL_ICON[addr.label] ?? <FiMapPin />}
              title={<span className="flex items-center gap-2">{labelText(addr.label, addr.customLabel)}{addr.isDefault && <StatusPill tone="accent">Default</StatusPill>}</span>}
              description={<span>{addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ""} · {addr.postalCode} {addr.city}, {addr.country}</span>}
              className="items-start sm:items-center"
            >
              {!addr.isDefault && <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => void setDefaultAddress(addr.id)} aria-label={`Make ${labelText(addr.label, addr.customLabel)} the default`} title="Set as default"><FiStar className="size-4" aria-hidden="true" /></Button>}
              <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => startEdit(addr)} aria-label={`Edit ${labelText(addr.label, addr.customLabel)}`} title="Edit"><FiEdit2 className="size-4" aria-hidden="true" /></Button>
              {deleteConfirmId === addr.id ? (
                <span className="flex items-center gap-1">
                  <Button type="button" variant="destructive" size="icon" className="size-9" onClick={() => void handleDelete(addr.id)} disabled={isDeleting} aria-label="Confirm delete"><FiCheck className="size-4" aria-hidden="true" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => setDeleteConfirmId(null)} aria-label="Keep address"><FiX className="size-4" aria-hidden="true" /></Button>
                </span>
              ) : (
                <Button type="button" variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(addr.id)} aria-label={`Delete ${labelText(addr.label, addr.customLabel)}`} title="Delete"><FiTrash2 className="size-4" aria-hidden="true" /></Button>
              )}
            </SettingsRow>
          ))}
        </RowList>
      )}
    </div>
  );
}
