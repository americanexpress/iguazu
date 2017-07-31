import { isSSR } from './ssr';

export function defer(func) {
  if (!isSSR()) {
    return func;
  }

  return () => ({ status: 'loading', noncritical: true });
}

export function noncritical(func) {
  return (iguazuInput) => {
    const result = func(iguazuInput);
    return Object.assign(
      {},
      result,
      { promise: result.promise.catch(() => { /* swallow */ }), noncritical: true }
    );
  };
}
