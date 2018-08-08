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

import { enableSSR, resetSSR } from '../src/ssr';

import iguazuReduce, {
  reduceData,
  reduceStatus,
  reducePromise,
  reduceErrors,
} from '../src/reduce';

describe('reducers', () => {
  describe('reduceData', () => {
    it('should return a map of the data', () => {
      const loadResponseMap = {
        x: { data: 'x data' },
        y: { data: 'y data' },
      };
      const allData = reduceData(loadResponseMap);
      expect(allData).toEqual({
        x: 'x data',
        y: 'y data',
      });
    });
  });

  describe('reduceStatus', () => {
    it('should return the expected output when all responses are loaded', () => {
      const loadResponseMap = {
        x: { status: 'complete' },
        y: { status: 'complete' },
      };
      expect(reduceStatus(loadResponseMap)).toEqual({ all: 'complete', x: 'complete', y: 'complete' });
    });

    it('should return the expected output when all responses are not loaded', () => {
      const loadResponseMap = {
        x: { status: 'complete' },
        y: { status: 'loading' },
      };
      expect(reduceStatus(loadResponseMap)).toEqual({ all: 'loading', x: 'complete', y: 'loading' });
    });
  });

  describe('reduceErrors', () => {
    it('should return the expected output when all responses loaded without errors', () => {
      const loadResponseMap = {
        x: { error: undefined },
        y: {},
      };
      expect(reduceErrors(loadResponseMap)).toEqual({ any: false });
    });

    it('should return the expected output when some responses loaded with errors', () => {
      const loadError = new Error('Async data loaded with an error');
      const loadResponseMap = {
        x: { error: loadError },
        y: {},
      };
      expect(reduceErrors(loadResponseMap)).toEqual({ any: true, x: loadError });
    });
  });

  describe('reducePromise', () => {
    it('should return an array of the promises wrapped in Promise.all', async () => {
      const loadResponseMap = {
        x: { promise: Promise.resolve('x result') },
        y: { promise: Promise.resolve('y result') },
      };
      const promiseResults = await reducePromise(loadResponseMap);
      expect(promiseResults).toEqual(['x result', 'y result']);
    });
  });

  describe('iguazuReduce', () => {
    afterEach(() => {
      resetSSR();
    });

    it('should use the data, status, and promise reducers to return one object', async () => {
      const loadDataAsProps = () => ({
        x: () => ({ data: 'x data', status: 'complete', promise: Promise.resolve('x result') }),
        y: () => ({ data: 'y data', status: 'loading', promise: Promise.resolve('y result') }),
      });
      const reducedLoadResponse = iguazuReduce(loadDataAsProps)();
      expect(reducedLoadResponse.data).toEqual({
        x: 'x data',
        y: 'y data',
      });
      expect(reducedLoadResponse.status).toBe('loading');
      const promiseResults = await reducedLoadResponse.promise;
      expect(promiseResults).toEqual(['x result', 'y result']);
    });

    it('should not execute the load function on server if the load function is not ssr enabled', () => {
      enableSSR();
      const loadDataAsProps = jest.fn();
      const reducedLoadResponse = iguazuReduce(loadDataAsProps)();
      expect(reducedLoadResponse).toEqual({ status: 'loading' });
      expect(loadDataAsProps).not.toHaveBeenCalled();
    });
  });
});
