import React from 'react';
import { EspacePubPage } from './EspacePubPage';

interface AppMobileProps {
  onBackToMap?: () => void;
}

export const AppMobile: React.FC<AppMobileProps> = ({ onBackToMap }) => {
  return <EspacePubPage onBackToMap={onBackToMap} />;
};

export default AppMobile;
