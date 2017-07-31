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
    const promise = reducePromise(loadResponseMap);

    return {
      data,
      status,
      promise,
    };
  };
}
