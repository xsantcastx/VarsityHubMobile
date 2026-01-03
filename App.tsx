// Polyfill __extends FIRST, before any imports that might need it
if (typeof (global as any).__extends !== 'function') {
  (global as any).__extends = function (d: any, b: any) {
    if (typeof Object.setPrototypeOf === 'function') {
      Object.setPrototypeOf(d, b);
    } else {
      (d as any).__proto__ = b;
    }
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new (__ as any)());
  };
}

import { Slot } from 'expo-router';
import './sentry';

export default function App() {
  return <Slot />;
}
