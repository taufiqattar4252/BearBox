import React from 'react';
import ReactDOM from 'react-dom/client';
import { ManagerApp } from './ManagerApp';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ManagerApp />
    </React.StrictMode>
  );
}
