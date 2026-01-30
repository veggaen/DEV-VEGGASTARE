
type AddEmployeeResult =
  | { success: false; error: string }
  | { success: true; message: string; data: unknown };

export const MyAddEmployeeAction = async (data: any): Promise<AddEmployeeResult> => {
    console.log('MyAddEmployeeAction()',data.clientUser.name,'is Attempting to add new employee with data:', data);  
    const url = `/api/companies/employees/add`;
    console.log('URL', url);

    if (!data.clientUser.id) {
      console.error('Error adding employee, no session user ID found.');
      //throw new Error('Error adding employee');
      return { success: false, error: 'No session user found' };
    }
    
    try {
      console.log('clientUser.ID is found:', data.clientUser.id)
      const response = await fetch('/api/companies/employees/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
      });
      
      const result = await response.json(); // Parse JSON in any case for detailed error/success message
  
      if (!response.ok) {
        console.error('Error adding employee:', result);
        throw new Error(result.message || 'Error adding employee');
      }
  
      console.log('Employee added successfully:', result);
      return { success: true, message: 'Employee added successfully', data: result };
    } catch (error) {
      console.error('Exception caught in MyAddEmployeeAction:', error);
      return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred' };
    }
  };