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

import values from 'lodash/values';
import mapValues from 'lodash/mapValues';

import { isSSR } from './ssr';

export function reduceData(loadResponseMap) {
  return mapValues(loadResponseMap, response => response.data);
}

export function reduceStatus(loadResponseMap) {
  const responses = values(loadResponseMap);

  const loadStatusMap = mapValues(loadResponseMap, response => response.status);
  loadStatusMap.all =
    responses
      .filter(response => !response.noncritical)
      .map(response => response.status)
      .every(s => s === 'complete') ? 'complete' : 'loading';

  return loadStatusMap;
}

export function reduceErrors(loadResponseMap) {
  const responses = values(loadResponseMap);

  const loadErrorMap = mapValues(loadResponseMap, response => response.error);
  loadErrorMap.any =
    responses
      .filter(response => !response.noncritical)
      .map(response => response.error)
      .some(error => error);

  return loadErrorMap;
}

export function reducePromise(loadResponseMap) {
  return Promise.all(values(loadResponseMap).map(response => response.promise));
}

export default function iguazuReduce(loadFunc) {
  return (loadInputs) => {
    const ssr = isSSR();
    if (ssr && !loadFunc.ssr) { return { status: 'loading' }; }

    const loadFuncMap = loadFunc(loadInputs);
    const loadResponseMap = mapValues(loadFuncMap, func => func({ ssr }));

    const data = reduceData(loadResponseMap);
    const status = reduceStatus(loadResponseMap).all;
    const error = reduceErrors(loadResponseMap).any;
    const promise = reducePromise(loadResponseMap);

    return {
      data,
      status,
      error,
      promise,
    };
  };
}
