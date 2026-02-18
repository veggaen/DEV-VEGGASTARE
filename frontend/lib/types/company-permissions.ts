export interface EmployeePermissions {
  // Employee Management
  CAN_ADD_EMPLOYEE?: boolean;
  CAN_REMOVE_EMPLOYEE?: boolean;
  CAN_EDIT_EMPLOYEE_ROLE?: boolean;
  CAN_EDIT_PERMISSION?: boolean;
  
  // Company Management
  CAN_DELETE_COMPANY?: boolean;
  CAN_EDIT_COMPANY_DETAILS?: boolean;
  CAN_MANAGE_WAREHOUSES?: boolean;
  
  // Product Management - General (legacy)
  CAN_POST_PRODUCT_POSITION_PERMISSION?: boolean;
  CAN_EDIT_PRODUCT_POSITION_PERMISSION?: boolean;
  CAN_DELETE_PRODUCT?: boolean;
  CAN_VIEW_ANALYTICS?: boolean;
  
  // Physical Products
  CAN_CREATE_PHYSICAL_PRODUCT?: boolean;
  CAN_EDIT_PHYSICAL_PRODUCT?: boolean;
  CAN_DELETE_PHYSICAL_PRODUCT?: boolean;
  
  // Digital Products
  CAN_CREATE_DIGITAL_PRODUCT?: boolean;
  CAN_EDIT_DIGITAL_PRODUCT?: boolean;
  CAN_DELETE_DIGITAL_PRODUCT?: boolean;
  CAN_UPLOAD_DIGITAL_ASSETS?: boolean;
  CAN_MANAGE_DOWNLOAD_SETTINGS?: boolean;
  CAN_VIEW_DOWNLOAD_STATS?: boolean;
  CAN_REVOKE_DOWNLOAD_TOKENS?: boolean;
  
  // Field-level edit permissions
  CAN_EDIT_PRODUCT_TITLE?: boolean;
  CAN_EDIT_PRODUCT_DESCRIPTION?: boolean;
  CAN_EDIT_PRODUCT_PRICE?: boolean;
  CAN_EDIT_PRODUCT_IMAGES?: boolean;
  CAN_EDIT_PRODUCT_STOCK?: boolean;
  CAN_EDIT_PRODUCT_CATEGORY?: boolean;
  CAN_EDIT_ACCEPTED_PAYMENTS?: boolean;
  CAN_EDIT_SHIPPING_SETTINGS?: boolean;
  
  // Financial
  CAN_VIEW_SALES?: boolean;
  CAN_MANAGE_PRICING?: boolean;
  CAN_PROCESS_REFUNDS?: boolean;

  // Tax Helper
  CAN_VIEW_TAX_REPORTS?: boolean;
  CAN_EDIT_TAX_DATA?: boolean;
  CAN_MANAGE_EXPENSES?: boolean;
  CAN_MANAGE_SALARIES?: boolean;
  CAN_COMMENT_TAX_REPORTS?: boolean;

  // Warehouse & Fulfilment
  CAN_VIEW_ORDERS?: boolean;
  CAN_PROCESS_ORDERS?: boolean;
  CAN_SHIP_ORDERS?: boolean;
  CAN_MANAGE_SHIPMENTS?: boolean;
  CAN_VIEW_INVENTORY?: boolean;
  CAN_EDIT_INVENTORY?: boolean;
}
