import React from 'react';
import ReactDOM from 'react-dom/client';

// --- Sport plugins (side-effect imports) ---
// IMPORTANT: these MUST be imported ABOVE the store import so each plugin
// registers itself with sportRegistry before store.ts reads sportRegistry.list().
// To add a new sport: drop a folder under client/src/sports/<sport>/ with an
// index.ts that calls sportRegistry.register(...), then add one import line here.
import '@/sports/badminton';
import '@/sports/cricket';
// --- /Sport plugins ---

import App from './App';
import './index.css';
import { Provider } from 'react-redux';
import { store } from './store/store';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Provider store={store}>
            <App />
        </Provider>
    </React.StrictMode>
);
