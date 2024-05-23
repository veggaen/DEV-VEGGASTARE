'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { fetchUserEmployeePermissions } from '@/actions/user-company-permissions';

const UserCompanyPermission = ({ permissionTag }) => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const currentUser = useCurrentUser();

  useEffect(() => {
    async function loadCompanies() {
      if (!currentUser) return;
      
      try {
        // Adjust this call according to how your actual API function is structured
        // This is a placeholder for fetching companies with a specific permission
        const response = await fetch(`/api/companies/permission-filter-companies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: currentUser.id,
            permissionTag: 'CAN_POST_PRODUCT_POSITION_PERMISSION',
          }),
        });
        
        if (!response.ok) throw new Error('Failed to fetch companies');
        
        const data = await response.json();
        if (Array.isArray(data)) {
          setCompanies(data);
        } else {
          console.error('Expected an array for companies, received:', data);
        }
      } catch (error) {
        console.error('Error fetching companies with permissions:', error);
      }
    }

    loadCompanies();
  }, [currentUser, permissionTag]);

  const handleCompanyChange = (e) => {
    const companyId = e.target.value;
    handleCompanySelect(companyId);
  };

  const handleCompanySelect = (companyId) => {
    console.log(`Selected company ID: ${companyId}`);
    setSelectedCompanyId(companyId);
    // Perform additional actions with the selected company ID, such as:
    // - Fetching and displaying company details
    // - Updating application state or context
    // - Triggering side effects related to the company selection
  };

  return (
    <div>
      {companies.length > 0 ? (
        <select value={selectedCompanyId} onChange={handleCompanyChange}>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      ) : (
        <p>No companies available or you lack permissions.</p>
      )}
    </div>
  );
};

export default UserCompanyPermission;