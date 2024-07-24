export const permissionMapping = {
  CAN_REMOVE_EMPLOYEE: "can_remove_employee",
  CAN_EDIT_PERMISSION: "can_edit_permission",
  CAN_DELETE_COMPANY: "can_delete_company",
  CAN_POST_PRODUCT_POSITION_PERMISSION: "can_post_product_position_permission",
  CAN_EDIT_PRODUCT_POSITION_PERMISSION: "can_edit_product_position_permission",
  CAN_ADD_EMPLOYEE: "can_add_employee",
};
  
type PermissionKey = keyof typeof permissionMapping;
type PermissionValue = typeof permissionMapping[PermissionKey];

export function convertPermissionsToBoolean(permissions: string[]): Record<PermissionKey, boolean> {
  const booleanPermissions: Record<PermissionKey, boolean> = {
    CAN_REMOVE_EMPLOYEE: false,
    CAN_EDIT_PERMISSION: false,
    CAN_DELETE_COMPANY: false,
    CAN_POST_PRODUCT_POSITION_PERMISSION: false,
    CAN_EDIT_PRODUCT_POSITION_PERMISSION: false,
    CAN_ADD_EMPLOYEE: false,
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