import mapValues from 'lodash/mapValues';

import { enableSSR, resetSSR } from '../src/ssr';
import iguazuReduce from '../src/reduce';
import {
  defer,
  noncritical,
  sequence,
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

  describe('sequence', () => {
    it('should return a map of load functions where each function is based on the result of the previous functions', () => {
      const seq1 = jest.fn(() => ({ status: 'complete', data: 'seq1 data' }));
      const seq2 = jest.fn(() => ({ status: 'complete', data: 'seq2 data' }));
      const seq3 = jest.fn(() => ({ status: 'loading' }));

      const sequenceFuncs = sequence([
        { key: 'seq1', handler: seq1 },
        { key: 'seq2', handler: seq2 },
        { key: 'seq3', handler: seq3 },
      ]);

      const resultMap = mapValues(sequenceFuncs, value => value());
      expect(resultMap.seq1).toEqual({ status: 'complete', data: 'seq1 data' });
      expect(resultMap.seq2).toEqual({ status: 'complete', data: 'seq2 data' });
      expect(resultMap.seq3).toEqual({ status: 'loading' });

      expect(seq1).toHaveBeenCalled();
      expect(seq2).toHaveBeenCalledWith({ seq1: 'seq1 data' });
      expect(seq3).toHaveBeenCalledWith({ seq1: 'seq1 data', seq2: 'seq2 data' });
    });

    it('should handle a previous function that is still loading', () => {
      const seq1 = jest.fn(() => ({ status: 'loading' }));
      const seq2 = jest.fn();

      const sequenceFuncs = sequence([
        { key: 'seq1', handler: seq1 },
        { key: 'seq2', handler: seq2 },
      ]);

      const resultMap = mapValues(sequenceFuncs, value => value());
      expect(resultMap.seq1).toEqual({ status: 'loading' });
      expect(resultMap.seq2).toEqual({ status: 'loading' });

      expect(seq1).toHaveBeenCalled();
      expect(seq2).not.toHaveBeenCalled();
    });

    it('should handle a previous function that had an error', () => {
      const error = new Error('woops');
      const seq1 = jest.fn(() => ({ status: 'complete', error }));
      const seq2 = jest.fn();

      const sequenceFuncs = sequence([
        { key: 'seq1', handler: seq1 },
        { key: 'seq2', handler: seq2 },
      ]);

      const resultMap = mapValues(sequenceFuncs, value => value());
      expect(resultMap.seq1).toEqual({ status: 'complete', error });
      expect(resultMap.seq2).toEqual({ status: 'complete', error });

      expect(seq1).toHaveBeenCalled();
      expect(seq2).not.toHaveBeenCalled();
    });

    it('should chain promises if it is a server side render', async () => {
      enableSSR();

      const seq1 = jest.fn(() => ({ status: 'loading', data: 'seq1 data', promise: Promise.resolve('seq1 data') }));
      const seq2 = jest.fn(() => ({ status: 'loading', data: 'seq2 data', promise: Promise.resolve('seq2 data') }));
      const seq3 = jest.fn(() => ({ status: 'loading', promise: Promise.resolve('seq3 data') }));

      const sequenceFuncs = sequence([
        { key: 'seq1', handler: seq1 },
        { key: 'seq2', handler: seq2 },
        { key: 'seq3', handler: seq3 },
      ]);

      const resultMap = mapValues(sequenceFuncs, value => value());

      expect(seq2).not.toHaveBeenCalled();
      const seq2Resolve = await resultMap.seq2.promise;
      expect(seq2Resolve).toEqual({ seq1: 'seq1 data', seq2: 'seq2 data' });
      expect(seq2).toHaveBeenCalledWith({ seq1: 'seq1 data' });

      expect(seq3).not.toHaveBeenCalled();
      const seq3Resolve = await resultMap.seq3.promise;
      expect(seq3Resolve).toEqual({ seq1: 'seq1 data', seq2: 'seq2 data', seq3: 'seq3 data' });
      expect(seq3).toHaveBeenCalledWith({ seq1: 'seq1 data', seq2: 'seq2 data' });
    });

    it('should work with iguazuReduce to run functions in parallel as part of the sequence', () => {
      const seq2 = jest.fn(() => ({ status: 'loading' }));
      const sequenceFuncs = sequence([{
        key: 'seq1',
        handler: iguazuReduce(() => ({
          seq1A: () => ({ status: 'complete', data: 'seq1A data' }),
          seq1B: () => ({ status: 'complete', data: 'seq1B data' }),
        })),
      }, {
        key: 'seq2', handler: seq2,
      }]);

      mapValues(sequenceFuncs, value => value());
      expect(seq2).toHaveBeenCalledWith({ seq1: { seq1A: 'seq1A data', seq1B: 'seq1B data' } });
    });
  });
});
