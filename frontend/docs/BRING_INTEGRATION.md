# Bring Shipping Integration Guide

This document covers the complete Bring API integration for VeggaStare, including setup, testing, and production deployment.

## 🔑 Required Environment Variables

Add these to your `.env.local`:

```bash
# Bring API Credentials (get from MyBring: https://www.mybring.com/)
BRING_API_KEY=your-api-key-here
BRING_API_UID=your-mybring-email@example.com
BRING_CUSTOMER_NUMBER=TESTUSER_123  # Use test number for testing!

# Test Mode - ALWAYS use "true" during development
BRING_TEST_MODE=true
```

### Getting Your Credentials

1. **Create MyBring Account**: https://www.mybring.com/
2. **Generate API Key**: 
   - Log in to MyBring
   - Go to Settings → API
   - Create a new API key
3. **Test Customer Number**:
   - For testing, use Bring's test customer numbers
   - Check: https://developer.bring.com/api/testing/
   - Common test number: `TESTUSER` or similar (check docs)

---

## 📦 Implemented APIs

### 1. Shipping Guide API (`/api/bring-shipping`)
**Purpose**: Get shipping rates, delivery times, available services

```typescript
// Example request
POST /api/bring-shipping
{
  "fromPostalCode": "0001",
  "toPostalCode": "4310",
  "packages": [{
    "length": 30,
    "width": 20,
    "height": 10,
    "grossWeight": 500  // grams
  }]
}

// Response
{
  "consignments": [{
    "products": [{
      "id": "5800",
      "guiInformation": {
        "displayName": "Pakke til hentested",
        "descriptionText": "...",
        "logoUrl": "..."
      },
      "price": {
        "listPrice": {
          "priceWithAdditionalServices": {
            "amountWithVAT": "89.00",
            "currencyCode": "NOK"
          }
        }
      }
    }]
  }]
}
```

### 2. Booking API (`/api/bring-booking`) ✨ NEW
**Purpose**: Create actual shipments, generate labels, get tracking numbers

```typescript
// Example request
POST /api/bring-booking
{
  "sender": {
    "name": "Seller Name",
    "address": "Street 123",
    "postalCode": "0001",
    "city": "Oslo",
    "email": "seller@example.com",
    "phone": "+4712345678"
  },
  "recipient": {
    "name": "Buyer Name",
    "address": "Recipient Street 456",
    "postalCode": "4310",
    "city": "Hommersåk",
    "email": "buyer@example.com",
    "phone": "+4787654321"
  },
  "packages": [{
    "weight": 500,  // grams
    "dimensions": { "length": 30, "width": 20, "height": 10 },
    "description": "Electronics"
  }],
  "serviceCode": "5800",  // Pakke til hentested
  "orderId": "order_12345"
}

// Response (TEST MODE)
{
  "success": true,
  "testMode": true,
  "booking": {
    "consignmentNumber": "70438101015432789NO",
    "labelUrl": "https://api.bring.com/booking/api/booking/labels/...",
    "trackingUrl": "https://tracking.bring.com/tracking/70438101015432789NO",
    "packages": [{
      "packageNumber": "00370438101015432789",
      "correlationId": "pkg-1"
    }]
  },
  "orderId": "order_12345"
}
```

### 3. Address API (`/api/bring-address`)
**Purpose**: Address autocomplete, validation

```typescript
GET /api/bring-address?q=oslo+gate+1&country=no

// Response
{
  "suggestions": [{
    "id": "12345",
    "street": "Oslo gate",
    "houseNumber": "1",
    "postalCode": "0001",
    "city": "Oslo",
    "type": "STREET",
    "display": "Oslo gate 1, 0001 Oslo"
  }]
}
```

### 4. Pickup Point API (`/api/bring-pickup-points`)
**Purpose**: Find nearby pickup locations

```typescript
GET /api/bring-pickup-points?postalCode=4310&limit=5

// Response
{
  "pickupPoints": [{
    "id": "123456",
    "name": "Extra Hommersåk",
    "address": "Strandveien 1",
    "postalCode": "4310",
    "city": "Hommersåk",
    "openingHoursEnglish": "Mon-Sat: 07:00-23:00",
    "distanceInKm": 0.5,
    "latitude": 58.927,
    "longitude": 5.838
  }]
}
```

### 5. Tracking API (`/api/bring-tracking`)
**Purpose**: Track shipment status

```typescript
GET /api/bring-tracking?q=70438101015432789NO

// Response
{
  "trackingNumber": "70438101015432789NO",
  "status": "In transit",
  "lastUpdate": {
    "description": "Shipment arrived at terminal",
    "date": "2026-02-02",
    "time": "14:30",
    "location": "Oslo"
  },
  "delivered": false,
  "trackingUrl": "https://tracking.bring.com/tracking/70438101015432789NO",
  "consignments": [...]
}
```

---

## 🧪 Testing Strategy

### Level 1: Unit Tests (Mocked)
No real API calls, instant, free.

```typescript
// Example with MSW (Mock Service Worker)
import { rest } from 'msw';

const handlers = [
  rest.post('/api/bring-booking', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      testMode: true,
      booking: {
        consignmentNumber: 'MOCK-12345',
        labelUrl: 'https://example.com/label.pdf',
        trackingUrl: 'https://example.com/track',
      }
    }));
  }),
];
```

### Level 2: Integration Tests (Test Mode)
Real API calls but no real shipments/charges.

```bash
# Ensure test mode is enabled
BRING_TEST_MODE=true

# Headers sent automatically when BRING_TEST_MODE=true:
# X-Bring-Test-Indicator: true
```

**What happens in test mode:**
- ✅ Real API validation (catches format errors)
- ✅ Returns realistic responses (fake tracking numbers)
- ✅ Generates sample labels (marked as TEST/VOID)
- ❌ No real shipment created
- ❌ No charges to your account
- ❌ Tracking won't update (it's not a real package)

### Level 3: Real Test Purchase
After all other tests pass, do a real small purchase:

1. Set `BRING_TEST_MODE=false`
2. Create a cheap product (NOK 20-50)
3. Use your friend's address as recipient
4. Complete purchase with real payment (Stripe)
5. Booking creates real label → print it
6. Drop package at post office
7. Track delivery via app
8. **Cost**: Product + ~NOK 50-150 shipping

---

## 🔄 Complete Purchase Flow

```
1. Customer adds product to cart
         │
2. Customer enters shipping address
         │
         ▼
   ┌─────────────────┐
   │ Address API     │──▶ Validate & autocomplete
   └─────────────────┘
         │
         ▼
   ┌─────────────────┐
   │ Pickup Point API│──▶ Show nearby pickup locations
   └─────────────────┘
         │
3. Customer selects delivery method
         │
         ▼
   ┌─────────────────┐
   │ Shipping Guide  │──▶ Calculate rates
   └─────────────────┘
         │
4. Customer completes payment (Stripe)
         │
         ▼
   ┌─────────────────┐
   │ Booking API     │──▶ Create shipment
   └─────────────────┘
         │
         ├──▶ Generate label PDF
         │
         ├──▶ Get tracking number
         │
         ▼
   ┌─────────────────┐
   │ Resend Email    │──▶ Send confirmation to buyer
   └─────────────────┘    (tracking link, label, order details)
         │
5. Seller prints label, ships package
         │
         ▼
   ┌─────────────────┐
   │ Tracking API    │──▶ Customer tracks package
   └─────────────────┘
         │
6. Package delivered ✓
```

---

## 📧 Email Integration (Resend)

After successful booking, send email with:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'orders@veggastare.com',
  to: buyer.email,
  subject: `Your order #${orderId} has shipped!`,
  react: ShippingConfirmationEmail({
    orderNumber: orderId,
    trackingNumber: booking.consignmentNumber,
    trackingUrl: booking.trackingUrl,
    estimatedDelivery: '2-4 business days',
    pickupLocation: selectedPickupPoint,
  }),
});
```

---

## 🏭 Warehouse Management Extension

For your warehouse software idea, additional APIs:

### Warehousing API
- Use if you integrate with Bring's fulfillment centers
- Sync stock levels, manage inbound/outbound
- Not needed if you manage your own inventory

### Order Management API
- For multi-user dashboards with order lifecycle
- Create packaging lists for warehouse workers
- Track order status across systems

### Suggested Dashboard Features:
1. **Stock Overview** - Current inventory per warehouse
2. **Incoming Shipments** - Expected deliveries
3. **Order Queue** - Orders awaiting fulfillment
4. **Label Generation** - Bulk print shipping labels
5. **Partner Permissions** - Role-based access (view/edit)

---

## 🚨 Error Handling

Common errors and solutions:

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `BOOK-AUTH-001` | Auth failed | Check API key/UID |
| `BOOK-AUTH-002` | Invalid customer | Verify customer number |
| `BOOK-INPUT-022` | Bad postal code | Validate with Address API first |
| `BOOK-INPUT-023` | Weight too high | Check package limits |
| `BOOK-INPUT-031` | Service unavailable | Use Shipping Guide to check valid services |

---

## 📚 Official Documentation

- **Main Portal**: https://developer.bring.com/api/
- **Shipping Guide**: https://developer.bring.com/api/shipping-guide_2/
- **Booking**: https://developer.bring.com/api/booking/
- **Tracking**: https://developer.bring.com/api/tracking/
- **Pickup Points**: https://developer.bring.com/api/pickup-point/
- **Address**: https://developer.bring.com/api/address/
- **Testing**: https://developer.bring.com/api/testing/
- **Support**: developer-booking@bring.com

