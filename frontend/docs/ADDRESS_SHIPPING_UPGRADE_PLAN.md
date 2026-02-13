# Address & Shipping System Upgrade Plan

> **Status**: Planning Document  
> **Created**: 2026-02-03  
> **Priority**: High - Required for MVP shipping functionality

## 📊 Current State Analysis

### ✅ What You Already Have (Good Foundation!)

| Component | Status | Location |
|-----------|--------|----------|
| **Bring Shipping Guide API** | ✅ Working | `backend/src/integrations/bring/client.ts` |
| **Bring Address Autocomplete** | ✅ Implemented | `frontend/lib/bring-address.ts` |
| **Resend Email** | ✅ Configured | `frontend/lib/mail.ts` (2FA, verification, etc.) |
| **WarehouseLocation Model** | ✅ Exists | Has `address`, `postalCode`, `city`, `country` fields |
| **Order Model** | ✅ Has shipping fields | `shippingAddress`, `shippingCity`, `shippingPostalCode`, etc. |
| **Product Form** | 🔄 Partial | Uses postal code only, no full address |

### ❌ What's Missing

1. **User Address Book** - Users can't save multiple addresses (home, work, etc.)
2. **Full Address in Product Form** - Only postal code, not street/apartment
3. **Shipping Method Selection** - No "self-drop at post office" vs "home pickup" options
4. **Bring Booking API** - Route exists but not integrated into purchase flow
5. **Order Confirmation Emails** - Resend set up but no buyer/seller shipping emails
6. **Address Validation** - `bring-address.ts` exists but not used in forms

---

## 🏗️ Upgrade Plan (3 Phases)

### Phase 1: Address Schema & User Address Book (Week 1)

#### 1.1 Schema Updates

```prisma
// Add to frontend/prisma/schema.prisma

enum AddressType {
  HOME
  WORK
  WAREHOUSE
  OTHER
}

model Address {
  id                String      @id @default(cuid())
  userId            String?
  companyId         String?
  
  // Core address fields (compatible with Bring API)
  name              String      // "Home", "Office", "Main Warehouse"
  contactName       String?     // Person to contact at this address
  addressLine1      String      // Street + house number (max 35 chars for Bring)
  addressLine2      String?     // Apartment, floor, basement, etc. (max 35 chars)
  postalCode        String      // Required for Bring (4 digits for NO)
  city              String      // Required
  countryCode       String      @default("NO")
  
  // Contact info (required for Bring sender/recipient)
  phone             String?     // E.164 format preferred (+47...)
  email             String?
  
  // Custom instructions for delivery
  deliveryInstructions String?  // "Gate code: 1234", "Ring bell #3", "Leave at back door"
  
  // Metadata
  type              AddressType @default(HOME)
  isDefault         Boolean     @default(false)
  latitude          Float?
  longitude         Float?
  
  // Relations
  User              User?       @relation(fields: [userId], references: [id], onDelete: Cascade)
  Company           Company?    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  // Products shipping from this address
  ProductsShippingFrom Product[] @relation("ShippingFromAddress")
  
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  @@index([userId])
  @@index([companyId])
  @@index([userId, isDefault])
}

// Update Product model
model Product {
  // ... existing fields ...
  
  // Replace shipFromPostalId with proper address relation
  shippingFromAddressId String?
  shippingFromAddress   Address? @relation("ShippingFromAddress", fields: [shippingFromAddressId], references: [id])
  
  // Shipping method for this product
  shippingMethod        ShippingMethod @default(HOME_PICKUP)
}

enum ShippingMethod {
  HOME_PICKUP       // Bring picks up from seller
  POST_OFFICE_DROP  // Seller drops at post office (cheaper)
  WAREHOUSE         // Ships from company warehouse
  SELF_DELIVER      // Seller delivers personally (no Bring)
  DIGITAL_ONLY      // No physical shipping needed
}
```

#### 1.2 API Routes to Add

```typescript
// POST/GET/PUT/DELETE /api/addresses
// GET /api/addresses/user/[userId]
// GET /api/addresses/company/[companyId]
// POST /api/addresses/validate (uses Bring Address API)
```

#### 1.3 UI Components

1. **AddressForm Component** - Reusable form with:
   - Street address autocomplete (using existing `bring-address.ts`)
   - Apartment/unit field
   - Delivery instructions textarea
   - Phone (required for shipping)
   - "Save to profile" checkbox

2. **AddressSelector Component** - Dropdown showing:
   - User's saved addresses
   - Company warehouses (if company product)
   - "+ Add new address" option

3. **User Profile > Addresses Tab** - CRUD for saved addresses

---

### Phase 2: Enhanced Product Form Shipping (Week 2)

#### 2.1 Product Form Upgrades

Replace the current postal code input with:

```tsx
// In product-form.tsx shipping section

<div className="space-y-4">
  <h4>Shipping Location</h4>
  
  {/* Address Selection */}
  <RadioGroup value={shippingSource} onChange={setShippingSource}>
    <RadioOption value="saved">Use saved address</RadioOption>
    <RadioOption value="warehouse">Use company warehouse</RadioOption>
    <RadioOption value="new">Enter new address</RadioOption>
  </RadioGroup>
  
  {shippingSource === 'saved' && (
    <AddressSelector 
      addresses={userAddresses}
      value={selectedAddressId}
      onChange={setSelectedAddressId}
    />
  )}
  
  {shippingSource === 'warehouse' && isCompanyProduct && (
    <WarehouseSelector
      companyId={companyId}
      value={selectedWarehouseId}
      onChange={setSelectedWarehouseId}
    />
  )}
  
  {shippingSource === 'new' && (
    <AddressForm
      onSubmit={handleNewAddress}
      showSaveOption
    />
  )}
  
  {/* Shipping Method */}
  <h4>How will you ship?</h4>
  <RadioGroup value={shippingMethod} onChange={setShippingMethod}>
    <RadioOption value="POST_OFFICE_DROP">
      📮 I'll drop it at the post office
      <span className="text-sm text-muted-foreground">
        Cheaper - you print label and bring package to post office
      </span>
    </RadioOption>
    <RadioOption value="HOME_PICKUP">
      🏠 Bring picks up from my address
      <span className="text-sm text-muted-foreground">
        Convenient - courier comes to you (may cost extra)
      </span>
    </RadioOption>
    {productType === 'DIGITAL' && (
      <RadioOption value="DIGITAL_ONLY">
        💾 Digital delivery only
        <span className="text-sm text-muted-foreground">
          No physical shipping - file download only
        </span>
      </RadioOption>
    )}
  </RadioGroup>
</div>
```

#### 2.2 "Use My Location" Enhancement

Upgrade the existing geolocation feature:

```typescript
// When user clicks "Use my location"
async function handleUseMyLocation() {
  // 1. Get coordinates (existing)
  const coords = await getCurrentPosition();
  
  // 2. Reverse geocode to get full address (NEW)
  const address = await reverseGeocode(coords.latitude, coords.longitude);
  
  // 3. Validate with Bring Address API (NEW)
  const validated = await validateAddress(address);
  
  // 4. Populate form with full address
  setAddressForm({
    addressLine1: validated.streetAddress,
    postalCode: validated.postalCode,
    city: validated.city,
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
  
  // 5. Show confirmation modal: "Is this your address?"
  setShowAddressConfirmation(true);
}
```

---

### Phase 3: Order Flow & Emails (Week 3)

#### 3.1 Checkout Flow with Full Addresses

```
1. Buyer clicks "Buy Now"
2. → Enter/select delivery address (AddressForm)
3. → Select delivery method (pickup point, home delivery)
4. → Show Bring shipping rates (Shipping Guide API)
5. → Payment (Stripe)
6. → Create Order with full addresses
7. → Create Bring Booking (if not SELF_DELIVER)
8. → Send emails (buyer confirmation, seller instructions)
```

#### 3.2 Email Templates to Add

**Buyer - Order Confirmation:**
```typescript
// Add to frontend/lib/mail.ts

export const sendOrderConfirmationEmail = async (
  buyerEmail: string,
  order: {
    orderId: string;
    items: { title: string; quantity: number; price: number }[];
    total: number;
    shippingAddress: Address;
    trackingNumber?: string;
    trackingUrl?: string;
    estimatedDelivery?: string;
  }
): Promise<void> => {
  await resend.emails.send({
    from: 'Veggat-Orders@veggat.com',
    to: buyerEmail,
    subject: `Order Confirmed - #${order.orderId}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thank you for your order! 🎉</h2>
        
        <h3>Order #${order.orderId}</h3>
        <table>
          ${order.items.map(item => `
            <tr>
              <td>${item.title}</td>
              <td>x${item.quantity}</td>
              <td>kr ${item.price}</td>
            </tr>
          `).join('')}
        </table>
        <p><strong>Total: kr ${order.total}</strong></p>
        
        <h3>Shipping to:</h3>
        <p>
          ${order.shippingAddress.addressLine1}<br>
          ${order.shippingAddress.addressLine2 ? `${order.shippingAddress.addressLine2}<br>` : ''}
          ${order.shippingAddress.postalCode} ${order.shippingAddress.city}
        </p>
        
        ${order.trackingNumber ? `
          <h3>Track your package:</h3>
          <p>Tracking number: ${order.trackingNumber}</p>
          <a href="${order.trackingUrl}" style="background: #0070f3; color: white; padding: 12px 24px; border-radius: 6px;">
            Track Package
          </a>
        ` : ''}
        
        ${order.estimatedDelivery ? `
          <p>Estimated delivery: ${order.estimatedDelivery}</p>
        ` : ''}
      </div>
    `
  });
};
```

**Seller - New Order + Shipping Instructions:**
```typescript
export const sendSellerOrderNotification = async (
  sellerEmail: string,
  order: {
    orderId: string;
    items: { title: string; quantity: number }[];
    buyerAddress: Address;
    shippingMethod: ShippingMethod;
    labelUrl?: string;  // From Bring Booking
    labelPdf?: Buffer;  // Attachment
    pickupDate?: string;
  }
): Promise<void> => {
  const shippingInstructions = {
    POST_OFFICE_DROP: `
      📮 <strong>Drop at Post Office</strong><br>
      1. Print the shipping label (attached or link below)<br>
      2. Attach label to your package<br>
      3. Drop it at your nearest post office or parcel machine<br>
      ${order.labelUrl ? `<a href="${order.labelUrl}">Download Label</a>` : ''}
    `,
    HOME_PICKUP: `
      🏠 <strong>Home Pickup Scheduled</strong><br>
      Bring will pick up from your address on ${order.pickupDate}<br>
      Have your package ready with the label attached<br>
      ${order.labelUrl ? `<a href="${order.labelUrl}">Download Label</a>` : ''}
    `,
    WAREHOUSE: `
      🏭 <strong>Ships from Warehouse</strong><br>
      This order will be fulfilled from your company warehouse.
    `,
  };
  
  await resend.emails.send({
    from: 'Veggat-Orders@veggat.com',
    to: sellerEmail,
    subject: `New Order! #${order.orderId} - Action Required`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2>You have a new order! 🎉</h2>
        
        <h3>Order #${order.orderId}</h3>
        <ul>
          ${order.items.map(item => `<li>${item.title} x${item.quantity}</li>`).join('')}
        </ul>
        
        <h3>Ship to:</h3>
        <p>
          ${order.buyerAddress.contactName}<br>
          ${order.buyerAddress.addressLine1}<br>
          ${order.buyerAddress.addressLine2 ? `${order.buyerAddress.addressLine2}<br>` : ''}
          ${order.buyerAddress.postalCode} ${order.buyerAddress.city}<br>
          📞 ${order.buyerAddress.phone}
        </p>
        
        <h3>Shipping Instructions:</h3>
        ${shippingInstructions[order.shippingMethod]}
      </div>
    `,
    attachments: order.labelPdf ? [{
      filename: `shipping-label-${order.orderId}.pdf`,
      content: order.labelPdf.toString('base64'),
    }] : undefined,
  });
};
```

---

## 🧪 Bring API Testing Strategy

### Test Mode Configuration

```bash
# .env.local
BRING_TEST_MODE=true  # ALWAYS true during development

# This adds header: X-Bring-Test-Indicator: true
# - Creates realistic responses
# - No real shipments/charges
# - Labels marked "TEST/VOID"
```

### Test Customer Numbers (from Bring docs)

| Service | Test Customer Number |
|---------|---------------------|
| Parcel Norway | `5` |
| Express Norway | `PARCELS_NORWAY_INTERNATIONAL_-_TEST` |
| General Test | `TESTUSER` |

### Test Addresses (Valid for Bring API)

```javascript
// Use these for testing - real Norwegian addresses
const TEST_ADDRESSES = {
  oslo: {
    addressLine1: "Karl Johans gate 1",
    postalCode: "0154",
    city: "Oslo",
    countryCode: "NO",
  },
  bergen: {
    addressLine1: "Torgallmenningen 1",
    postalCode: "5014", 
    city: "Bergen",
    countryCode: "NO",
  },
  trondheim: {
    addressLine1: "Munkegata 1",
    postalCode: "7011",
    city: "Trondheim", 
    countryCode: "NO",
  },
};

// Dummy phone for testing (Bring requires phone for sender)
const TEST_PHONE = "+4712345678";
```

---

## 📁 Files to Create/Modify

### New Files
```
frontend/
├── prisma/
│   └── migrations/XXXXXXX_add_address_model/
├── components/
│   └── uicustom/
│       ├── address-form.tsx           # Full address form with autocomplete
│       ├── address-selector.tsx       # Dropdown for saved addresses
│       └── shipping-method-selector.tsx
├── app/
│   └── api/
│       ├── addresses/
│       │   ├── route.ts              # CRUD for user addresses
│       │   └── validate/route.ts     # Validate with Bring
│       └── orders/
│           └── [orderId]/
│               └── shipping/route.ts  # Create Bring booking
├── lib/
│   └── mail.ts                       # ADD: order emails
└── app/
    └── profile/
        └── addresses/
            └── page.tsx              # User address management
```

### Files to Modify
```
frontend/
├── prisma/schema.prisma              # ADD: Address model, update Product
├── components/uicustom/product/forms/
│   └── product-form.tsx              # Upgrade shipping section
├── lib/bring-address.ts              # ADD: reverse geocode function
└── app/checkout/page.tsx             # Full address form for buyer
```

---

## ⏱️ Implementation Timeline

| Week | Tasks |
|------|-------|
| **Week 1** | Schema migration, Address CRUD API, AddressForm component |
| **Week 2** | Product form upgrade, warehouse selector, shipping method |
| **Week 3** | Checkout flow, Bring Booking integration, email templates |
| **Week 4** | Testing, edge cases, production deployment |

---

## 🚀 Quick Win: Minimal Changes for MVP

If you need something working faster, here's the **minimum viable upgrade**:

1. **Add `addressLine1` and `addressLine2` fields to Product** (next to `shipFromPostalId`)
2. **Add simple text inputs** in product form for street address
3. **Validate postal code** before submission
4. **Use existing Bring Shipping Guide** with postal codes for rate estimates

This gets you past the "postal code only" limitation quickly, while the full plan can be implemented over weeks.

---

## ✅ Validation Notes

The following recommendations have been reviewed and are mostly accurate, with caveats:

| Recommendation | Accuracy | Notes |
|------------|----------|-------|
| Full addresses required for Booking | ✅ Correct | Shipping Guide works with postal only, but Booking needs full address |
| Address model schema | ✅ Correct | The fields suggested match Bring API requirements |
| `X-Bring-Test-Indicator: true` | ✅ Correct | You already have this pattern in your code |
| Test customer number "5" | ✅ Correct | Valid for Parcel Norway domestic |
| `postingAtPostoffice: true` | ✅ Correct | For self-drop scenarios |
| Resend integration | ✅ Correct | You already have it set up |
| 35 char limit for address lines | ✅ Correct | Bring API limitation |

One correction: references claiming "no official Node SDK" are not operational blockers here because this project already has a working abstraction in `backend/src/integrations/bring/`.

---

## 📞 Next Steps

1. Review this plan and prioritize what's needed first
2. Start with schema migration for Address model
3. Build AddressForm component (reusable across product form + checkout)
4. Integrate into product creation
5. Add order flow emails

Let me know which part you want to implement first!
