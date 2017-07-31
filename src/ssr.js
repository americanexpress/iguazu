let SSR = false;

export function enableSSR() {
  SSR = true;
}

// used for testing
export function resetSSR() {
  SSR = false;
}

export function isSSR() {
  return SSR;
}
