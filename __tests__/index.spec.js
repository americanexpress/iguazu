import {
  connectAsync,
  iguazuReduce,
  defer,
  noncritical,
  sequence,
  enableSSR,
} from '../src/index';

describe('Public API', () => {
  it('should expose the expected public API', () => {
    expect(connectAsync).toBeDefined();
    expect(iguazuReduce).toBeDefined();
    expect(defer).toBeDefined();
    expect(noncritical).toBeDefined();
    expect(sequence).toBeDefined();
    expect(enableSSR).toBeDefined();
  });
});
