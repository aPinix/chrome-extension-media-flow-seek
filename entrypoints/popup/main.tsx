import React from 'react';
import ReactDOM from 'react-dom/client';

import Popup from './popup';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Popup root element was not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
