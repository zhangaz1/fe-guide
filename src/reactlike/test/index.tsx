import * as React from 'react';
// import { Provider } from 'react-redux';
// import React, { hydrate } from '../src/react';
import { Provider } from './provider';
import App from './App';
import store from './store';

React.hydrate(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root'),
)