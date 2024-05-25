'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { fetchUserEmployeePermissions } from '@/actions/user-company-permissions';

const UserCompanyPermission = ({ permissionTag, onCompanySelect }) => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const currentUser = useCurrentUser();

  useEffect(() => {
    async function loadCompanies() {
      if (!currentUser) return;

      try {
        console.log(`Fetching companies for userId: ${currentUser.id} with permissionTag: ${permissionTag}`);

        const response = await fetch(`/api/companies/permission-filter-companies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: currentUser.id,
            permissionTag: permissionTag,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch companies');
        }

        const data = await response.json();
        console.log('Response data:', data);

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

  const handleCompanyChange = async (e) => {
    const companyId = e.target.value;
    await handleCompanySelect(companyId);
  };

  const handleCompanySelect = async (companyId) => {
    console.log(`Selected company ID: ${companyId}`);
    setSelectedCompanyId(companyId);

    // Fetch permissions for the selected company
    try {
      const permissions = await fetchUserEmployeePermissions(currentUser, companyId);
      console.log(`Fetched permissions for company ID ${companyId}:`, permissions);
      onCompanySelect(companyId, permissions);
    } catch (error) {
      console.error('Error fetching permissions for the selected company:', error);
    }
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