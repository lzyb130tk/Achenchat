import { startApp } from './app.js';
import { initStore } from './services/store.js';

initStore()
  .catch((error) => {
    console.error('Store initialization failed', error);
  })
  .finally(startApp);
