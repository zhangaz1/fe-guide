import React from 'react';
import { render } from 'react-dom';
import {
  Provider,
} from 'mobx-react';
import {
  observable,
} from 'mobx';

import App from './app/main.jsx';
import stores from './stores';

if (process.env.NODE_ENV !== 'production') {
  const { reactopt } = require('reactopt');
  reactopt(React);
}

render(
  <Provider store={observable(stores)}>
    <App />
  </Provider>,
  document.getElementById('root'),
);
