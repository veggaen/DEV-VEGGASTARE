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
    permissions: ["CAN_POST_PRODUCT_POSITION_PERMISSION", "CAN_EDIT_PRODUCT_POSITION_PERMISSION", "CAN_DELETE_PRODUCT", "CAN_VIEW_ANALYTICS"],
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
  CAN_VIEW_ANALYTICS: "View Analytics",
  CAN_VIEW_SALES: "View Sales",
  CAN_MANAGE_PRICING: "Manage Pricing",
  CAN_PROCESS_REFUNDS: "Process Refunds",
};