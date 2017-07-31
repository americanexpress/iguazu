import {
  connectAsync,
  iguazuReduce,
  defer,
  noncritical,
  enableSSR,
} from '../src/index';

describe('Public API', () => {
  it('should expose the expected public API', () => {
    expect(connectAsync).toBeDefined();
    expect(iguazuReduce).toBeDefined();
    expect(defer).toBeDefined();
    expect(noncritical).toBeDefined();
    expect(enableSSR).toBeDefined();
  });
});
