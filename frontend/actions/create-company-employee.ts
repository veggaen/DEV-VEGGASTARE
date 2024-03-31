
export const MyAddEmployeeAction = async (employeeData: any) => {
    console.log('Attempting to add new employee with data:', employeeData);
    
    const url = `/api/companies/employees/add`;
    console.log('URL', url);
    try {
      const response = await fetch('/api/companies/employees/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(employeeData),
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