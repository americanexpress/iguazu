import { enableSSR, resetSSR } from '../src/ssr';
import {
  defer,
  noncritical,
} from '../src/loadHelpers';

describe('', () => {
  afterEach(() => {
    resetSSR();
  });

  describe('defer', () => {
    let globalState;
    const loadFunc = () => {
      const data = globalState.x;
      const status = data ? 'complete' : 'loading';
      const promise = Promise.resolve('x data').then((res) => { globalState.x = res; });

      return { data, status, promise };
    };

    beforeEach(() => {
      globalState = {};
    });

    it('should skip the load function and just return a loading response when on server', async () => {
      enableSSR();
      const wrappedLoadFunc = defer(loadFunc);
      let loadResponse = wrappedLoadFunc();
      await Promise.all([loadResponse.promise]);
      loadResponse = wrappedLoadFunc();
      expect(loadResponse.data).not.toBeDefined();
      expect(loadResponse.status).toBe('loading');
      expect(loadResponse.promise).not.toBeDefined();
    });

    it('should use the wrapped load function when not on the server', async () => {
      const wrappedLoadFunc = defer(loadFunc);
      let loadResponse = wrappedLoadFunc();
      await Promise.all([loadResponse.promise]);
      loadResponse = wrappedLoadFunc();
      expect(loadResponse.data).toBe('x data');
      expect(loadResponse.status).toBe('complete');
      expect(loadResponse.promise).toBeDefined();
    });
  });

  describe('noncritical', () => {
    it('should catch the promise so it does not cause Promise.all to reject', async () => {
      const loadFunc = () => {
        const promise = Promise.reject('rejected!');
        return { promise };
      };
      await expect(noncritical(loadFunc)().promise).resolves.toBeUndefined();
    });
  });
});
