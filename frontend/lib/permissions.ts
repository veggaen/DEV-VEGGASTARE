export const permissionMapping = {
  // Employee Management
  CAN_ADD_EMPLOYEE: "can_add_employee",
  CAN_REMOVE_EMPLOYEE: "can_remove_employee",
  CAN_EDIT_EMPLOYEE_ROLE: "can_edit_employee_role",
  CAN_EDIT_PERMISSION: "can_edit_permission",
  
  // Company Management
  CAN_DELETE_COMPANY: "can_delete_company",
  CAN_EDIT_COMPANY_DETAILS: "can_edit_company_details",
  CAN_MANAGE_WAREHOUSES: "can_manage_warehouses",
  
  // Product Management
  CAN_POST_PRODUCT_POSITION_PERMISSION: "can_post_product_position_permission",
  CAN_EDIT_PRODUCT_POSITION_PERMISSION: "can_edit_product_position_permission",
  CAN_DELETE_PRODUCT: "can_delete_product",
  CAN_MANAGE_PRODUCT_VISIBILITY: "can_manage_product_visibility",
  CAN_CREATE_PHYSICAL_PRODUCT: "can_create_physical_product",
  CAN_EDIT_PHYSICAL_PRODUCT: "can_edit_physical_product",
  CAN_DELETE_PHYSICAL_PRODUCT: "can_delete_physical_product",
  CAN_CREATE_DIGITAL_PRODUCT: "can_create_digital_product",
  CAN_EDIT_DIGITAL_PRODUCT: "can_edit_digital_product",
  CAN_DELETE_DIGITAL_PRODUCT: "can_delete_digital_product",
  CAN_UPLOAD_DIGITAL_ASSETS: "can_upload_digital_assets",
  CAN_MANAGE_DOWNLOAD_SETTINGS: "can_manage_download_settings",
  CAN_VIEW_DOWNLOAD_STATS: "can_view_download_stats",
  CAN_REVOKE_DOWNLOAD_TOKENS: "can_revoke_download_tokens",
  CAN_EDIT_PRODUCT_TITLE: "can_edit_product_title",
  CAN_EDIT_PRODUCT_DESCRIPTION: "can_edit_product_description",
  CAN_EDIT_PRODUCT_PRICE: "can_edit_product_price",
  CAN_EDIT_PRODUCT_IMAGES: "can_edit_product_images",
  CAN_EDIT_PRODUCT_STOCK: "can_edit_product_stock",
  CAN_EDIT_PRODUCT_CATEGORY: "can_edit_product_category",
  CAN_EDIT_ACCEPTED_PAYMENTS: "can_edit_accepted_payments",
  CAN_EDIT_SHIPPING_SETTINGS: "can_edit_shipping_settings",
  CAN_VIEW_ANALYTICS: "can_view_analytics",
  
  // Financial
  CAN_VIEW_SALES: "can_view_sales",
  CAN_MANAGE_PRICING: "can_manage_pricing",
  CAN_PROCESS_REFUNDS: "can_process_refunds",
};
  
type PermissionKey = keyof typeof permissionMapping;
type PermissionValue = typeof permissionMapping[PermissionKey];

export function convertPermissionsToBoolean(permissions: string[]): Record<PermissionKey, boolean> {
  const booleanPermissions: Record<PermissionKey, boolean> = {
    // Employee Management
    CAN_ADD_EMPLOYEE: false,
    CAN_REMOVE_EMPLOYEE: false,
    CAN_EDIT_EMPLOYEE_ROLE: false,
    CAN_EDIT_PERMISSION: false,
    
    // Company Management
    CAN_DELETE_COMPANY: false,
    CAN_EDIT_COMPANY_DETAILS: false,
    CAN_MANAGE_WAREHOUSES: false,
    
    // Product Management
    CAN_POST_PRODUCT_POSITION_PERMISSION: false,
    CAN_EDIT_PRODUCT_POSITION_PERMISSION: false,
    CAN_DELETE_PRODUCT: false,
    CAN_MANAGE_PRODUCT_VISIBILITY: false,
    CAN_CREATE_PHYSICAL_PRODUCT: false,
    CAN_EDIT_PHYSICAL_PRODUCT: false,
    CAN_DELETE_PHYSICAL_PRODUCT: false,
    CAN_CREATE_DIGITAL_PRODUCT: false,
    CAN_EDIT_DIGITAL_PRODUCT: false,
    CAN_DELETE_DIGITAL_PRODUCT: false,
    CAN_UPLOAD_DIGITAL_ASSETS: false,
    CAN_MANAGE_DOWNLOAD_SETTINGS: false,
    CAN_VIEW_DOWNLOAD_STATS: false,
    CAN_REVOKE_DOWNLOAD_TOKENS: false,
    CAN_EDIT_PRODUCT_TITLE: false,
    CAN_EDIT_PRODUCT_DESCRIPTION: false,
    CAN_EDIT_PRODUCT_PRICE: false,
    CAN_EDIT_PRODUCT_IMAGES: false,
    CAN_EDIT_PRODUCT_STOCK: false,
    CAN_EDIT_PRODUCT_CATEGORY: false,
    CAN_EDIT_ACCEPTED_PAYMENTS: false,
    CAN_EDIT_SHIPPING_SETTINGS: false,
    CAN_VIEW_ANALYTICS: false,
    
    // Financial
    CAN_VIEW_SALES: false,
    CAN_MANAGE_PRICING: false,
    CAN_PROCESS_REFUNDS: false,
  };

  permissions.forEach(permission => {
    const key = Object.keys(permissionMapping).find(k => permissionMapping[k as PermissionKey] === permission) as PermissionKey;
    if (key) {
      booleanPermissions[key] = true;
    }
  });

  return booleanPermissions;
}

export function convertPermissionsToString(permissions: Record<PermissionKey, boolean>): string[] {
  return Object.keys(permissions).filter(key => permissions[key as PermissionKey]).map(key => permissionMapping[key as PermissionKey]);
}

/**
 * Permission groups for better UI organization
 */
export const PERMISSION_GROUPS = {
  EMPLOYEE: {
    label: "Employee Management",
    permissions: ["CAN_ADD_EMPLOYEE", "CAN_REMOVE_EMPLOYEE", "CAN_EDIT_EMPLOYEE_ROLE", "CAN_EDIT_PERMISSION"],
  },
  COMPANY: {
    label: "Company Management", 
    permissions: ["CAN_DELETE_COMPANY", "CAN_EDIT_COMPANY_DETAILS", "CAN_MANAGE_WAREHOUSES"],
  },
  PRODUCT: {
    label: "Product Management",
    permissions: [
      "CAN_POST_PRODUCT_POSITION_PERMISSION",
      "CAN_EDIT_PRODUCT_POSITION_PERMISSION",
      "CAN_DELETE_PRODUCT",
      "CAN_MANAGE_PRODUCT_VISIBILITY",
      "CAN_CREATE_PHYSICAL_PRODUCT",
      "CAN_EDIT_PHYSICAL_PRODUCT",
      "CAN_DELETE_PHYSICAL_PRODUCT",
      "CAN_CREATE_DIGITAL_PRODUCT",
      "CAN_EDIT_DIGITAL_PRODUCT",
      "CAN_DELETE_DIGITAL_PRODUCT",
      "CAN_UPLOAD_DIGITAL_ASSETS",
      "CAN_MANAGE_DOWNLOAD_SETTINGS",
      "CAN_VIEW_DOWNLOAD_STATS",
      "CAN_REVOKE_DOWNLOAD_TOKENS",
      "CAN_EDIT_PRODUCT_TITLE",
      "CAN_EDIT_PRODUCT_DESCRIPTION",
      "CAN_EDIT_PRODUCT_PRICE",
      "CAN_EDIT_PRODUCT_IMAGES",
      "CAN_EDIT_PRODUCT_STOCK",
      "CAN_EDIT_PRODUCT_CATEGORY",
      "CAN_EDIT_ACCEPTED_PAYMENTS",
      "CAN_EDIT_SHIPPING_SETTINGS",
      "CAN_VIEW_ANALYTICS",
    ],
  },
  FINANCIAL: {
    label: "Financial",
    permissions: ["CAN_VIEW_SALES", "CAN_MANAGE_PRICING", "CAN_PROCESS_REFUNDS"],
  },
} as const;

/**
 * Human-readable permission labels
 */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  CAN_ADD_EMPLOYEE: "Add Employees",
  CAN_REMOVE_EMPLOYEE: "Remove Employees",
  CAN_EDIT_EMPLOYEE_ROLE: "Change Employee Roles",
  CAN_EDIT_PERMISSION: "Manage Permissions",
  CAN_DELETE_COMPANY: "Delete Company",
  CAN_EDIT_COMPANY_DETAILS: "Edit Company Details",
  CAN_MANAGE_WAREHOUSES: "Manage Warehouses",
  CAN_POST_PRODUCT_POSITION_PERMISSION: "Create Products",
  CAN_EDIT_PRODUCT_POSITION_PERMISSION: "Edit Products",
  CAN_DELETE_PRODUCT: "Delete Products",
  CAN_MANAGE_PRODUCT_VISIBILITY: "Publish, Hide, or Archive Products",
  CAN_CREATE_PHYSICAL_PRODUCT: "Create Physical Products",
  CAN_EDIT_PHYSICAL_PRODUCT: "Edit Physical Products",
  CAN_DELETE_PHYSICAL_PRODUCT: "Archive Physical Products",
  CAN_CREATE_DIGITAL_PRODUCT: "Create Digital Products",
  CAN_EDIT_DIGITAL_PRODUCT: "Edit Digital Products",
  CAN_DELETE_DIGITAL_PRODUCT: "Archive Digital Products",
  CAN_UPLOAD_DIGITAL_ASSETS: "Upload Digital Assets",
  CAN_MANAGE_DOWNLOAD_SETTINGS: "Manage Download Settings",
  CAN_VIEW_DOWNLOAD_STATS: "View Download Stats",
  CAN_REVOKE_DOWNLOAD_TOKENS: "Revoke Download Tokens",
  CAN_EDIT_PRODUCT_TITLE: "Edit Product Titles",
  CAN_EDIT_PRODUCT_DESCRIPTION: "Edit Product Descriptions",
  CAN_EDIT_PRODUCT_PRICE: "Edit Product Prices",
  CAN_EDIT_PRODUCT_IMAGES: "Edit Product Images",
  CAN_EDIT_PRODUCT_STOCK: "Edit Product Stock",
  CAN_EDIT_PRODUCT_CATEGORY: "Edit Product Categories",
  CAN_EDIT_ACCEPTED_PAYMENTS: "Edit Accepted Payments",
  CAN_EDIT_SHIPPING_SETTINGS: "Edit Shipping Settings",
  CAN_VIEW_ANALYTICS: "View Analytics",
  CAN_VIEW_SALES: "View Sales",
  CAN_MANAGE_PRICING: "Manage Pricing",
  CAN_PROCESS_REFUNDS: "Process Refunds",
};
