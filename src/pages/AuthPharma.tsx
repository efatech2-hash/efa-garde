import React from 'react';
import { PharmacienLoginPage } from './PharmacienLoginPage';

interface AuthPharmaProps {
  onSuccess: (pharmaId: string) => void;
  onBackToRoles?: () => void;
}

export const AuthPharma: React.FC<AuthPharmaProps> = ({ onSuccess, onBackToRoles }) => {
  return (
    <PharmacienLoginPage
      onSuccess={onSuccess}
      onBackToMap={onBackToRoles || (() => window.history.back())}
    />
  );
};
