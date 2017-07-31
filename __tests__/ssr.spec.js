import {
  enableSSR,
  isSSR,
  resetSSR,
} from '../src/ssr';

describe('SSR', () => {
  afterEach(() => {
    resetSSR();
  });

  it('should allow you to inform iguazu it is running on the server', () => {
    expect(isSSR()).toBe(false);
    enableSSR();
    expect(isSSR()).toBe(true);
  });
});
