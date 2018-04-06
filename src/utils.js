
// eslint-disable-next-line import/prefer-default-export
export function handlePromiseRejection(promise) {
  promise.then(null, () => { /* swallow */ });
}
