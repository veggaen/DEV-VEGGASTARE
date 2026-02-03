// frontend/hooks/use-addresses.ts
// Hook for managing user addresses with SWR

import useSWR from 'swr';
import { useState } from 'react';
import type { AddressLabel } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface Address {
  id: string;
  userId: string;
  label: AddressLabel;
  customLabel: string | null;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  municipality: string | null;
  county: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressData {
  label?: AddressLabel;
  customLabel?: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  municipality?: string;
  county?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface UpdateAddressData extends Partial<CreateAddressData> {}

// =============================================================================
// FETCHER
// =============================================================================

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
};

// =============================================================================
// HOOK
// =============================================================================

export function useAddresses() {
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, mutate, isLoading } = useSWR<{ addresses: Address[] }>(
    '/api/users/addresses',
    fetcher
  );

  const addresses = data?.addresses ?? [];
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];

  // Create a new address
  const createAddress = async (addressData: CreateAddressData): Promise<Address | null> => {
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/users/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressData),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to create address');
      }

      // Revalidate the addresses list
      await mutate();
      return json.address;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create address';
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  // Update an existing address
  const updateAddress = async (
    addressId: string,
    addressData: UpdateAddressData
  ): Promise<Address | null> => {
    setIsUpdating(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/addresses/${addressId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressData),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to update address');
      }

      // Revalidate the addresses list
      await mutate();
      return json.address;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update address';
      setError(message);
      return null;
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete an address
  const deleteAddress = async (addressId: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/addresses/${addressId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete address');
      }

      // Revalidate the addresses list
      await mutate();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete address';
      setError(message);
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  // Set an address as default
  const setDefaultAddress = async (addressId: string): Promise<boolean> => {
    return !!(await updateAddress(addressId, { isDefault: true }));
  };

  return {
    addresses,
    defaultAddress,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    refresh: mutate,
  };
}

// =============================================================================
// LABEL HELPERS
// =============================================================================

export function getAddressLabelIcon(label: AddressLabel): string {
  switch (label) {
    case 'HOME':
      return '🏠';
    case 'WORK':
      return '🏢';
    case 'WAREHOUSE':
      return '📦';
    case 'PICKUP_POINT':
      return '📍';
    case 'OTHER':
    default:
      return '📌';
  }
}

export function getAddressLabelText(label: AddressLabel, customLabel?: string | null): string {
  switch (label) {
    case 'HOME':
      return 'Home';
    case 'WORK':
      return 'Work';
    case 'WAREHOUSE':
      return 'Warehouse';
    case 'PICKUP_POINT':
      return 'Pickup Point';
    case 'OTHER':
      return customLabel || 'Other';
    default:
      return customLabel || 'Address';
  }
}

export function formatAddressOneLine(address: Address): string {
  const parts = [address.addressLine1];
  if (address.addressLine2) parts.push(address.addressLine2);
  parts.push(`${address.postalCode} ${address.city}`);
  return parts.join(', ');
}
