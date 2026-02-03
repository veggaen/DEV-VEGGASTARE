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
  
  // Product Management
  CAN_POST_PRODUCT_POSITION_PERMISSION?: boolean;
  CAN_EDIT_PRODUCT_POSITION_PERMISSION?: boolean;
  CAN_DELETE_PRODUCT?: boolean;
  CAN_VIEW_ANALYTICS?: boolean;
  
  // Financial
  CAN_VIEW_SALES?: boolean;
  CAN_MANAGE_PRICING?: boolean;
  CAN_PROCESS_REFUNDS?: boolean;
}
