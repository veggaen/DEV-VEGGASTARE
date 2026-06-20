# Veggat Company Order Routing

Company sellers need more than "send one order email to the owner." A serious
commerce system routes order events to the right people, warehouse, department,
or external inbox based on what was sold and how it must be fulfilled.

## Product Idea

When a company sells a product, the company owner should be able to configure
who receives each order event.

Examples:

- Pool products go to the outdoor/warehouse team.
- TVs go to the electronics desk.
- Digital design files go to the digital fulfilment lead.
- Hybrid products notify both warehouse and digital support.
- Expensive items notify owner, finance, and fulfilment.

## Core Concepts

- Routing rule: a condition plus one or more recipients.
- Recipient: employee, role, warehouse, department inbox, custom email, webhook.
- Event: order placed, payment confirmed, packing started, shipment booked,
  delivery failed, refund requested, digital download failed.
- Message template: what each recipient sees.
- Permission: owner can manage all routing, delegated employees can manage only
  assigned routes or warehouses.

## Suggested Rule Conditions

- company id
- product id
- product category
- product type: physical, digital, hybrid
- warehouse location
- SKU or internal product code
- product specifications: weight, dimensions, material, custom fields
- order value
- shipping method
- country/postal region
- digital asset type

## Suggested Data Model

Future Prisma models:

```prisma
model CompanyOrderRoutingRule {
  id          String   @id @default(cuid())
  companyId   String
  name        String
  isActive    Boolean  @default(true)
  priority    Int      @default(100)
  eventTypes  String[]
  conditions  Json
  templateId  String?
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model CompanyOrderRoutingRecipient {
  id        String @id @default(cuid())
  ruleId    String
  kind      String // EMPLOYEE, ROLE, WAREHOUSE, EMAIL, WEBHOOK
  targetId  String?
  email     String?
  label     String?
}
```

## UX

Company settings should include an "Order routing" workspace:

- Rules table with active status, priority, event, and recipient summary.
- Rule builder with plain-language conditions.
- Preview panel: "If this product is bought, these people are notified."
- Test button that simulates a sample order without sending real emails.
- Audit log for who changed a rule and when.

Product creation should also show the matching route:

- "This listing will notify: Electronics desk, Owner, Warehouse Oslo."
- If no route matches: "Falls back to company owner."

## Engineering Path

1. Keep current owner/warehouse notification fallback.
2. Add read-only route preview for existing warehouse/company logic.
3. Add company routing rule models and owner-only CRUD.
4. Add route simulation endpoint.
5. Update `completePaidOrder` to resolve recipients from rules.
6. Add templates and per-recipient message types.
7. Add packing dashboard tasks per warehouse/department.
8. Add Bring booking status and shipment task updates.

## Guardrails

- Never send digital download links to warehouse recipients unless explicitly
  configured.
- Never expose buyer PII to recipients that do not need it.
- Log every recipient resolution for disputes and compliance.
- Keep fallback notifications so orders are never silently dropped.
