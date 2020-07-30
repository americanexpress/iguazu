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

import { isSSR } from './ssr';

export function defer(func) {
  if (!isSSR()) {
    return func;
  }

  return () => ({ status: 'loading', promise: Promise.resolve(), noncritical: true });
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

export function sequence(funcs) {
  let processedIndex = funcs.length;

  const mappedFuncs = {};
  let sequencedData = {};
  function processPrev() {
    processedIndex -= 1;
    const currIndex = processedIndex;
    const { key, handler } = funcs[currIndex];

    let mappedFunc;
    if (currIndex === 0) {
      mappedFunc = handler;
    } else {
      const prevFunction = processPrev();
      const prevKey = funcs[currIndex - 1].key;

      mappedFunc = () => {
        const result = prevFunction();
        const { promise: prevPromise, status, error, data, noncritical: isNonCritical } = result;
        sequencedData = { [prevKey]: data, ...sequencedData };

        const promise = prevPromise
          .then((prevData) => {
            const prevDataMap = currIndex === 1 ? { [prevKey]: prevData } : prevData;
            return Promise.all([prevDataMap, handler(prevDataMap).promise]);
          })
          .then(([prevDataMap, currData]) => ({ ...prevDataMap, [key]: currData }));

        if (status === 'loading') {
          return { status: 'loading', promise };
        } else if (error && isNonCritical !== true) {
          return { status: 'complete', error, promise };
        }

        return Object.assign(
          handler(sequencedData),
          { promise }
        );
      };
    }

    mappedFuncs[key] = mappedFunc;

    return mappedFunc;
  }

  processPrev();

  return mappedFuncs;
}
