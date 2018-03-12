import { isSSR } from './ssr';

export function defer(func) {
  if (!isSSR()) {
    return func;
  }

  return () => ({ status: 'loading', noncritical: true });
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
        const { promise: prevPromise, status, error, data } = result;
        sequencedData = { [prevKey]: data, ...sequencedData };

        let promise;
        if (isSSR()) {
          promise = prevPromise
            .then((prevData) => {
              const prevDataMap = currIndex === 1 ? { [prevKey]: prevData } : prevData;
              return Promise.all([prevDataMap, handler(prevDataMap).promise]);
            })
            .then(([prevDataMap, currData]) => ({ ...prevDataMap, [key]: currData }));
        }

        if (status === 'loading') {
          return { status: 'loading', promise };
        } else if (error) {
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
