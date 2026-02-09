'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { AddressInput, type AddressData } from './address-input';
import {
  useAddresses,
  getAddressLabelIcon,
  getAddressLabelText,
  formatAddressOneLine,
  type Address,
  type CreateAddressData,
} from '@/hooks/use-addresses';
import {
  Plus,
  Loader2,
  Star,
  MapPin,
  Check,
  Trash2,
  Building2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import type { AddressLabel } from '@/generated/prisma/browser';

// =============================================================================
// TYPES
// =============================================================================

interface AddressSelectorProps {
  /** Currently selected address */
  value?: Address | null;
  /** Called when an address is selected */
  onChange: (address: Address | null) => void;
  /** Custom address data (for one-time use, not saved) */
  customAddress?: Partial<AddressData>;
  /** Called when custom address changes */
  onCustomAddressChange?: (address: Partial<AddressData>) => void;
  /** Allow entering a new address without saving */
  allowCustom?: boolean;
  /** Allow saving new addresses */
  allowSave?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  label?: string;
  error?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AddressSelector({
  value,
  onChange,
  customAddress,
  onCustomAddressChange,
  allowCustom = true,
  allowSave = true,
  disabled = false,
  required = false,
  className,
  label = 'Shipping Address',
  error,
}: AddressSelectorProps) {
  const {
    addresses,
    isLoading,
    isCreating,
    createAddress,
    deleteAddress,
    setDefaultAddress,
  } = useAddresses();

  const [mode, setMode] = useState<'saved' | 'custom'>(
    addresses.length === 0 ? 'custom' : 'saved'
  );
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAddress, setNewAddress] = useState<Partial<AddressData>>({});
  const [newAddressLabel, setNewAddressLabel] = useState<AddressLabel>('HOME');
  const [newAddressCustomLabel, setNewAddressCustomLabel] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Handle selecting a saved address
  const handleSelectSaved = useCallback(
    (addressId: string) => {
      const selected = addresses.find((a) => a.id === addressId);
      onChange(selected ?? null);
    },
    [addresses, onChange]
  );

  // Handle saving a new address
  const handleSaveAddress = useCallback(async () => {
    if (!newAddress.addressLine1 || !newAddress.postalCode || !newAddress.city) {
      return;
    }

    const data: CreateAddressData = {
      label: newAddressLabel,
      customLabel: newAddressLabel === 'OTHER' ? newAddressCustomLabel : undefined,
      addressLine1: newAddress.addressLine1,
      addressLine2: newAddress.addressLine2,
      postalCode: newAddress.postalCode,
      city: newAddress.city,
      municipality: newAddress.municipality,
      county: newAddress.county,
      country: newAddress.country || 'NO',
      latitude: newAddress.latitude ? parseFloat(newAddress.latitude) : undefined,
      longitude: newAddress.longitude ? parseFloat(newAddress.longitude) : undefined,
      isDefault: saveAsDefault,
    };

    const created = await createAddress(data);
    if (created) {
      onChange(created);
      setShowAddDialog(false);
      setNewAddress({});
      setMode('saved');
    }
  }, [
    newAddress,
    newAddressLabel,
    newAddressCustomLabel,
    saveAsDefault,
    createAddress,
    onChange,
  ]);

  // Handle deleting an address
  const handleDelete = useCallback(
    async (addressId: string) => {
      await deleteAddress(addressId);
      if (value?.id === addressId) {
        onChange(null);
      }
      setDeleteConfirm(null);
    },
    [deleteAddress, value, onChange]
  );

  // Update mode when addresses load
  React.useEffect(() => {
    if (!isLoading && addresses.length === 0 && mode === 'saved') {
      setMode('custom');
    }
  }, [isLoading, addresses.length, mode]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {label && (
          <Label className="text-sm text-muted-foreground">{label}</Label>
        )}
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      {label && (
        <Label className="text-sm text-muted-foreground">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      {/* Mode toggle (if has saved addresses and custom allowed) */}
      {addresses.length > 0 && allowCustom && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === 'saved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('saved')}
            disabled={disabled}
          >
            <MapPin className="h-4 w-4 mr-1.5" />
            Saved addresses
          </Button>
          <Button
            type="button"
            variant={mode === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('custom')}
            disabled={disabled}
          >
            <Building2 className="h-4 w-4 mr-1.5" />
            New address
          </Button>
        </div>
      )}

      {/* Saved addresses list */}
      {mode === 'saved' && addresses.length > 0 && (
        <RadioGroup
          value={value?.id ?? ''}
          onValueChange={handleSelectSaved}
          disabled={disabled}
          className="space-y-2"
        >
          {addresses.map((address) => (
            <div
              key={address.id}
              className={cn(
                'relative flex items-start gap-3 p-3 border rounded-lg transition-colors',
                value?.id === address.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <RadioGroupItem
                value={address.id}
                id={`address-${address.id}`}
                className="mt-1"
              />
              <label
                htmlFor={`address-${address.id}`}
                className="flex-1 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>{getAddressLabelIcon(address.label)}</span>
                  <span className="font-medium text-sm">
                    {getAddressLabelText(address.label, address.customLabel)}
                  </span>
                  {address.isDefault && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Star className="h-3 w-3 fill-current" />
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {address.addressLine1}
                  {address.addressLine2 && `, ${address.addressLine2}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {address.postalCode} {address.city}
                </p>
              </label>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {!address.isDefault && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDefaultAddress(address.id);
                    }}
                    title="Set as default"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(address.id);
                  }}
                  title="Delete address"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {/* Add new address button */}
          {allowSave && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowAddDialog(true)}
              disabled={disabled}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add new address
            </Button>
          )}
        </RadioGroup>
      )}

      {/* Custom address input */}
      {mode === 'custom' && (
        <div className="space-y-3">
          <AddressInput
            value={customAddress}
            onChange={(addr) => onCustomAddressChange?.(addr)}
            disabled={disabled}
            required={required}
            showAddressLine2
            hint={
              allowSave
                ? "You can save this address to your account for future orders"
                : undefined
            }
          />

          {/* Save to account option */}
          {allowSave &&
            customAddress?.addressLine1 &&
            customAddress?.postalCode &&
            customAddress?.city && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewAddress(customAddress);
                  setShowAddDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Save to my addresses
              </Button>
            )}

          {/* Show saved addresses link if they exist */}
          {addresses.length > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="text-xs px-0"
              onClick={() => setMode('saved')}
            >
              Or choose from {addresses.length} saved address
              {addresses.length > 1 ? 'es' : ''}
            </Button>
          )}
        </div>
      )}

      {/* No addresses and custom not allowed */}
      {mode === 'saved' && addresses.length === 0 && !allowCustom && (
        <p className="text-sm text-muted-foreground">
          No saved addresses. Add one to continue.
        </p>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Add address dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save Address</DialogTitle>
            <DialogDescription>
              Save this address for quick access on future orders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Label selector */}
            <div className="space-y-2">
              <Label>Address type</Label>
              <Select
                value={newAddressLabel}
                onValueChange={(val) => setNewAddressLabel(val as AddressLabel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOME">🏠 Home</SelectItem>
                  <SelectItem value="WORK">🏢 Work</SelectItem>
                  <SelectItem value="WAREHOUSE">📦 Warehouse</SelectItem>
                  <SelectItem value="PICKUP_POINT">📍 Pickup Point</SelectItem>
                  <SelectItem value="OTHER">📌 Other</SelectItem>
                </SelectContent>
              </Select>

              {newAddressLabel === 'OTHER' && (
                <Input
                  placeholder="Custom label (e.g., Mom's house)"
                  value={newAddressCustomLabel}
                  onChange={(e) => setNewAddressCustomLabel(e.target.value)}
                />
              )}
            </div>

            {/* Address input */}
            <AddressInput
              value={newAddress}
              onChange={setNewAddress}
              showAddressLine2
              label="Address"
              required
            />

            {/* Default checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-default"
                checked={saveAsDefault}
                onCheckedChange={(checked) => setSaveAsDefault(checked === true)}
              />
              <label
                htmlFor="save-default"
                className="text-sm cursor-pointer"
              >
                Set as my default address
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveAddress}
              disabled={
                isCreating ||
                !newAddress.addressLine1 ||
                !newAddress.postalCode ||
                !newAddress.city
              }
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1.5" />
                  Save Address
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Address?</DialogTitle>
            <DialogDescription>
              This will permanently remove this address from your saved
              addresses.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AddressSelector;
