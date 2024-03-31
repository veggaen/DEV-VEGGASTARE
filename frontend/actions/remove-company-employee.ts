const LOG_PREFIX = '[frontend/actions/remove-company-employee.ts]'
export const MyRemoveEmployeeAction = async (userId: string, companyId: string) => {
    console.log(`${LOG_PREFIX} Initiating request to remove employee [User ID: ${userId}, Company ID: ${companyId}]`);

    try {
        const response = await fetch('/api/companies/employees/remove', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId, companyId }),
        });

        if (!response.ok) {
            const errorResponse = await response.json();
            console.error(`${LOG_PREFIX} Failed to remove employee. Server responded with: ${errorResponse.message}`);
            return { success: false, message: `Failed to remove employee. [Error: ${errorResponse.message}]` };
        }
        
        console.log(`${LOG_PREFIX} Employee successfully removed.`);
        return { success: true, message: 'Employee successfully removed from the company.' };
    } catch (error) {
        console.error(`${LOG_PREFIX} Exception caught during removal operation: ${error}`);
        return { success: false, error: `An exception occurred: ${error}. Please try again or contact support.` };
    }
};
