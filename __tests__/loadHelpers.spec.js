/*
 * Copyright 2017 American Express
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import * as utils from '../src/utils';

import iguazuReduce from '../src/reduce';
import {
  defer,
  noncritical,
  sequence,
} from '../src/loadHelpers';

const { mapValues } = utils;

const isServer = jest.spyOn(utils, 'isServer');

describe('loadHelpers', () => {
  afterEach(() => {
    isServer.mockImplementation(() => false);
  });

  describe('defer', () => {
    const loadFunc = jest.fn(() => {
      const data = 'x data';
      const status = data ? 'complete' : 'loading';
      const promise = Promise.resolve(data);

      return { data, status, promise };
    });

    beforeEach(loadFunc.mockClear);

    it('should skip the load function and just return a loading response when on server', async () => {
      isServer.mockImplementation(() => true);
      const wrappedLoadFunc = defer(loadFunc);
      let loadResponse = wrappedLoadFunc();
      await Promise.all([loadResponse.promise]);
      loadResponse = wrappedLoadFunc();
      expect(loadFunc).not.toHaveBeenCalled();
      expect(loadResponse.data).not.toBeDefined();
      expect(loadResponse.status).toBe('loading');
      expect(loadResponse.promise).toBeInstanceOf(Promise);
      await expect(loadResponse.promise).resolves.toBeUndefined();
    });

    it('should use the wrapped load function when not on the server', async () => {
      const wrappedLoadFunc = defer(loadFunc);
      let loadResponse = wrappedLoadFunc();
      await Promise.all([loadResponse.promise]);
      loadResponse = wrappedLoadFunc();
      expect(loadFunc).toHaveBeenCalled();
      expect(loadResponse.data).toBe('x data');
      expect(loadResponse.status).toBe('complete');
      expect(loadResponse.promise).toBeInstanceOf(Promise);
      await expect(loadResponse.promise).resolves.toEqual('x data');
    });
  });

  describe('noncritical', () => {
    it('should catch the promise so it does not cause Promise.all to reject', async () => {
      const loadFunc = () => {
        const promise = Promise.reject(new Error('rejected!'));
        return { promise };
      };
      await expect(noncritical(loadFunc)().promise).resolves.toBeUndefined();
    });
  });

  describe('sequence', () => {
    it('should return a map of load functions where each function is based on the result of the previous functions', async () => {
      const seq1 = jest.fn(() => ({ status: 'loading', promise: Promise.resolve('seq1 data') }));
      const seq2 = jest.fn(() => ({ status: 'loading', promise: Promise.resolve('seq2 data') }));
      const seq3 = jest.fn(() => ({ status: 'loading', promise: Promise.resolve('seq3 data') }));

      const sequenceFuncs = sequence([
        { key: 'seq1', handler: seq1 },
        { key: 'seq2', handler: seq2 },
        { key: 'seq3', handler: seq3 },
      ]);

      const resultMap = mapValues(sequenceFuncs, (value) => value());
      await Promise.all(Object.values(resultMap).map(({ promise }) => promise));

      expect(seq1).toHaveBeenCalled();
      expect(seq2).toHaveBeenCalledWith({ seq1: 'seq1 data' });
      expect(seq3).toHaveBeenCalledWith({ seq1: 'seq1 data', seq2: 'seq2 data' });
    });

    it('should chain promises', async () => {
      const seq1 = jest.fn(() => ({ status: 'loading', data: 'seq1 data', promise: Promise.resolve('seq1 data') }));
      const seq2 = jest.fn(() => ({ status: 'loading', data: 'seq2 data', promise: Promise.resolve('seq2 data') }));
      const seq3 = jest.fn(() => ({ status: 'loading', promise: Promise.resolve('seq3 data') }));

      const sequenceFuncs = sequence([
        { key: 'seq1', handler: seq1 },
        { key: 'seq2', handler: seq2 },
        { key: 'seq3', handler: seq3 },
      ]);

      const resultMap = mapValues(sequenceFuncs, (value) => value());

      const seq2Resolve = await resultMap.seq2.promise;
      expect(seq2Resolve).toEqual({ seq1: 'seq1 data', seq2: 'seq2 data' });
      expect(seq2).toHaveBeenCalledWith({ seq1: 'seq1 data' });

      const seq3Resolve = await resultMap.seq3.promise;
      expect(seq3Resolve).toEqual({ seq1: 'seq1 data', seq2: 'seq2 data', seq3: 'seq3 data' });
      expect(seq3).toHaveBeenCalledWith({ seq1: 'seq1 data', seq2: 'seq2 data' });
    });

    it('should handle a previous function that had an error', async () => {
      expect.assertions(4);
      const error = new Error('woops');
      const rejectPromise = Promise.reject();
      const seq1 = jest.fn(() => ({ status: 'complete', error, promise: rejectPromise }));
      const seq2 = jest.fn();

      const sequenceFuncs = sequence([
        { key: 'seq1', handler: seq1 },
        { key: 'seq2', handler: seq2 },
      ]);

      const resultMap = mapValues(sequenceFuncs, (value) => value());

      await Promise.all(Object.values(resultMap).map(({ promise }) => promise)).catch(() => 0);

      expect(resultMap.seq1).toEqual({ status: 'complete', error, promise: rejectPromise });
      expect(resultMap.seq2).toEqual({ status: 'complete', error, promise: rejectPromise });

      expect(seq1).toHaveBeenCalled();
      expect(seq2).not.toHaveBeenCalled();
    });

    it('should handle a previous function that had a noncritical error', async () => {
      const error = new Error('woops');
      const seq1 = jest.fn(() => ({ status: 'complete', error, promise: Promise.reject() }));
      const seq2 = jest.fn(() => ({ status: 'loading', promise: Promise.resolve('seq2 data') }));

      const sequenceFuncs = sequence([
        { key: 'seq1', handler: noncritical(seq1) },
        { key: 'seq2', handler: seq2 },
      ]);

      const resultMap = mapValues(sequenceFuncs, (value) => value());

      const seq2Resolve = await resultMap.seq2.promise;
      expect(seq2Resolve).toEqual({ seq1: undefined, seq2: 'seq2 data' });
      expect(seq2).toHaveBeenCalledWith({ seq1: undefined });
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

      mapValues(sequenceFuncs, (value) => value());
      expect(seq2).toHaveBeenCalledWith({ seq1: { seq1A: 'seq1A data', seq1B: 'seq1B data' } });
    });

    it('should work with iguazuReduce options and return promise as an object', async () => {
      const seq2 = jest.fn(() => ({ status: 'loading' }));
      const sequenceFuncs = sequence([{
        key: 'seq1',
        handler: iguazuReduce(() => ({
          seq1A: () => ({ status: 'loading', promise: Promise.resolve('seq1A data') }),
          seq1B: () => ({ status: 'complete', promise: Promise.resolve('seq1B data') }),
        }), { promiseAsObject: true }),
      }, {
        key: 'seq2', handler: seq2,
      }]);

      const seqValues = mapValues(sequenceFuncs, (value) => value());
      const seqPromises = Object.values(seqValues).map(({ promise }) => promise);
      await Promise.all(seqPromises);
      expect(seq2).toHaveBeenCalledWith({ seq1: { seq1A: 'seq1A data', seq1B: 'seq1B data' } });
    });

    it('should work with deferred functions on the server', async () => {
      isServer.mockImplementation(() => true);
      const seq1 = jest.fn(() => ({ status: 'loading', data: 'seq1 data', promise: Promise.resolve('seq1 data') }));
      const seq2 = jest.fn(() => ({ status: 'loading', data: 'seq2 data', promise: Promise.resolve('seq2 data') }));
      const seq3 = jest.fn(() => ({ status: 'loading', data: 'seq3 data', promise: Promise.resolve('seq3 data') }));

      const sequenceFuncs = sequence([
        { key: 'seq1', handler: seq1 },
        { key: 'seq2', handler: defer(seq2) },
        { key: 'seq3', handler: defer(seq3) },
      ]);

      const resultMap = mapValues(sequenceFuncs, (value) => value());

      const seq2Resolve = await resultMap.seq2.promise;
      expect(seq2).not.toHaveBeenCalled();
      expect(seq2Resolve).toEqual({ seq1: 'seq1 data', seq2: undefined });

      const seq3Resolve = await resultMap.seq3.promise;
      expect(seq3).not.toHaveBeenCalled();
      expect(seq3Resolve).toEqual({ seq1: 'seq1 data', seq2: undefined, seq3: undefined });
    });

    it('should work with deferred functions on the client', async () => {
      const seq1 = jest.fn(() => ({ status: 'loading', data: 'seq1 data', promise: Promise.resolve('seq1 data') }));
      const seq2 = jest.fn(() => ({ status: 'loading', data: 'seq2 data', promise: Promise.resolve('seq2 data') }));
      const seq3 = jest.fn(() => ({ status: 'loading', data: 'seq3 data', promise: Promise.resolve('seq3 data') }));

      const sequenceFuncs = sequence([
        { key: 'seq1', handler: seq1 },
        { key: 'seq2', handler: defer(seq2) },
        { key: 'seq3', handler: defer(seq3) },
      ]);

      const resultMap = mapValues(sequenceFuncs, (value) => value());

      const seq2Resolve = await resultMap.seq2.promise;
      expect(seq2).toHaveBeenCalled();
      expect(seq2Resolve).toEqual({ seq1: 'seq1 data', seq2: 'seq2 data' });

      const seq3Resolve = await resultMap.seq3.promise;
      expect(seq3).toHaveBeenCalled();
      expect(seq3Resolve).toEqual({ seq1: 'seq1 data', seq2: 'seq2 data', seq3: 'seq3 data' });
    });
  });
});
