# Iguazu

An asynchronous data flow solution for React/Redux applications.

> Want to get paid for your contributions to `iguazu`?
> Send your resume to oneamex.careers@aexp.com

## Motivation
[react-redux](https://github.com/reduxjs/react-redux) works great for when you want to take data that already exists in state and inject it as props into a React component, but it doesn't help you at all with the flow of loading asynchronous data into state. If a react component relies on asynchronous data you typically have to do three things:

1. Define a load action responsible for fetching the asynchronous data, which should be triggered on mount and when the component receives new props that change what data should be loaded
2. Define a `mapStateToProps` function and use selectors to get the data out of state
3. Determine whether the state is actually loaded based on the props the selectors return

Iguazu seeks to simplify this flow into one step.

## Usage
Iguazu exports a Higher Order Component (HOC) `connectAsync` similar to React Redux's `connect`.  Instead of taking a `mapStateToProps` function, it takes a `loadDataAsProps` function. It should return a map where each key is the name of a prop that will contain some asynchronous data and the value is the load function that will load that data if it is not already loaded.  The load function must synchronously return an object with the keys `data`, `status`, `error`, and `promise`. The key `data` should be the data returned from the asynchronous call. The key `status` should be either `loading` to signal the asynchronous call is in flight or `complete` to signal it has returned. The key `error` should be a truthy value if there was an error while loading. The key `promise` should be the promise of the asynchronous call.

For each key defined in the `loadDataAsProps` function, the HOC will pass a prop to the wrapped component that contains the data. It will also pass two function props, `isLoading` and `loadedWithErrors`, which will tell you if any of the async props are still loading or loaded with errors respecitively. If you are only interested in a subset of async props, you can pass an array of the props names as the first argument. There will also be a prop named `loadErrors` that maps the load error, if there is one, for each prop. You can use this if you want to more granularly dig into what failed.

Example:

```javascript
/* MyContainer.jsx */
import React from 'react';
import { connectAsync } from 'iguazu';

function MyContainer({ isLoading, loadedWithErrors, myData, myOtherData }) {
  if (isLoading()) {
    return <div>Loading...</div>
  }

  if (loadedWithErrors()) {
    return <div>Oh no! Something went wrong</div>
  }

  return <div>myData = {myData} myOtherData = {myOtherData}</div>
}

function loadDataAsProps({ store, ownProps }) {
  const { dispatch, getState } = store;
  return {
    myData: () => dispatch(queryMyData(ownProps.someParam)),
    myOtherData: () => dispatch(queryMyOtherData(getState().someOtherParam))
  }
}

export default connectAsync({ loadDataAsProps })(MyContainer);

/* actions.js */
export function queryMyData(param) {
  return (dispatch, getState) => {
    const data = getState().path.to.myData[param];
    const status = data ? 'complete' : 'loading';
    const promise = data ? Promise.resolve : dispatch(fetchMyData(param));

    return { data, status, promise };
  }
}

export function queryMyOtherData(param) {/* Essentially the same as queryMyData */};
```

You can see that by moving the logic responsible for selecting out the cached data and triggering a fetch if needed into the actions makes the components much simpler.

## Advanced Usage
### SSR
The main benefits of server side rendering are improved perceived speed and SEO. With perceived speed, the general best practice is to get something in front of the user's eyes as fast as possible. Typically that means you shouldn't wait for any data before rendering to string. For SEO, it's more important that you render the full content, and if that content is dynamic, you'll need to wait on some data. Usually not every view is important for SEO, such as logged in views, so the best option is to only preload data you absolutely have to for SEO. For this reason, Iguazu makes SSR data preloading opt in. If you would like a component's data to be loaded prior to rendering on the server, you can add a property named `ssr` with the value of true.

**Note:** Whether or not you are planning on waiting for data to load before doing a server side render, you will need to tell Iguazu it is running on node by calling `enableSSR`. Otherwise it will assume it is running on the client and will execute the load functions in `componentWillMount` during `renderToString` whether you opted in or not. If you're not running `renderToString`, you don't have to worry.

Example:

```javascript
/* server.js */
import { enableSSR } from 'iguazu';
import express from 'express';

enableSSR();

const app = express();
// Set up express app

/* Component.jsx */
function loadDataAsProps() {...}
loadDataAsProps.ssr = true;
```

Iguazu supports react-async-bootstrapper so that you are not restricted to using iguazu for ssr data preloading.  See react-async-bootstrapper's documentation for instructions on how to wait on SSR data preloading.

#### Helper methods
Sometimes you might want to enable SSR preloading for a component, but only for some of its data. Iguazu provides some helper methods, `defer` and `noncritical`, to more granularly load data on the server. If you wrap a load function with `defer`, it will not execute the load function at all and will just return a status of `loading`. If you wrap a function with `noncritical`, the load function will execute, but its promise will be caught so that if it rejects it won't cause the Promise.all to reject and return before the other more critical pieces of data have returned.

Example:

```javascript
import { defer, noncritical } from 'iguazu';

function loadDataAsProps() {
  return {
    clientOnlyData: defer(() => dispatch(loadClientData())),
    tryToLoadOnServerData: noncritical(() => dispatch(loadIffyData()))
  }
}
```

Iguazu will also pass a parameter to the load function that tells it whether it is running on the server or not. You might want to use this if you expect data to have a specific shape when it is not loaded, because `defer` will just return data as undefined.

Example:

```javascript
function MyComponent({ someData }) {
  return <ul>{someData.list.map(item => <li key={item.toString()}>{item}</li>)}</ul>
}

function loadDataAsProps() {
  return {
    someData: ({ ssr }) =>
      (ssr ? { data: { list: [] }, status: 'loading' } : dispatch(loadSomeData()))
  }
}
```

### Synchronization
Let's say you have a dynamic dashboard of components that are all responsible for loading their own data, but you want to wait until they are all loaded to render them so that you don't see a bunch of spinners or a partially loaded page. Since Iguazu attaches the loadDataAsProps function as a static, parent components can easily wait until their children's data is loaded before rendering them.

```javascript
import React from 'react';
import { iguazuReduce } from 'iguazu';
import ComponentA from './ComponentA';
import ComponentB from './ComponentB';

function MyComponent({ isLoading }) {
  if (isLoading()) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <ComponentA someParam="someParam" />
      <ComponentB />
    <div>
  );
}

function loadDataAsProps({ store, ownProps }) {
  return {
    ComponentA: () => iguazuReduce(ComponentA.loadDataAsProps)({
      store, ownProps: { someParam: 'someParam' }
    }),
    ComponentB: () => iguazuReduce(ComponentB.loadDataAsProps)({ store, ownProps: {} })
  }
}
```

### Sequencing

Quite often you need the results of one asynchronous call to get the inputs for another call. One way to do this is by simply using components.

Example:

```javascript
import React from 'react';
import { connectAsync } from 'iguazu';

function Parent({ isLoading, parent }) {
  if (isLoading()) {
    return <div>Loading Your Profile...</div>;
  }

  return (
    <div>
      <div>
        You:
        <PersonInfo info={parent} />
      </div>
      <KidsContainer parentId={parent.id} />
    </div>
  );
}

function parentLoadDataAsProps({ store: { dispatch } }) {
  return {
    parents: dispatch(loadLoggedInParent()),
  };
}

const ParentContainer = connectAsync({ loadDataAsProps: parentLoadDataAsProps })(Parent)

function Kids({ isLoading, kids }) {
  if (isLoading()) {
    return <div>Loading Kids...</div>;
  }

  return (
    <div>
      Kids:
      {kids.map((kid) => (<PersonInfo info={kid} />))}
    </div>
  );
}

function kidsLoadDataAsProps({ store: { dispatch }, ownProps: { parentId } }) {
  return {
    kids: dispatch(loadKidsByParent(parentId)),
  };
}

const KidsContainer = connectAsync({ loadDataAsProps: kidsLoadDataAsProps })(Kids)

function PersonInfo({ info: { name, age } }) {
  return {
    <div>
      <span>name: {name}</span>
      <span>age: {age}</span>
    </div>
  }
}
```

Suppose you want to synchronize the parent and kid components so that you show a loading spinner until they are both done loading their data. Or maybe you only have one component that needs some sequenced data and it doesn't make sense to create a new component for each nested piece of data. In these cases you can use the load helper, `sequence`. You can pass it an array of load functions that need to run in order and depend on data returned from previous functions.

Example:

```javascript
import React from 'react';
import { connectAsync, sequence } from 'iguazu';

function Parent({ isLoading, parent, kids }) {
  if (isLoading()) {
    return <div>Loading Your Profile...</div>;
  }

  return (
    <div>
      <div>
        You:
        <PersonInfo info={parent} />
      </div>
      <Kids kids={kids} />
    </div>
  );
}

function parentLoadDataAsProps({ store: { dispatch } }) {
  const sequenceLoadFunctions = sequence([
    { key: 'parent', handler: () => dispatch(loadLoggedInParent()) },
    { key: 'kids', handler: ({ parent }) => dispatch(loadKidsByParent(parent.id)) }
  ]);

  return {
    ...sequenceLoadFunctions
  };
}

const ParentContainer = connectAsync({ loadDataAsProps: parentLoadDataAsProps })(Parent)

function Kids({ kids }) {
  return (
    <div>
      Kids:
      {kids.map((kid) => (<PersonInfo info={kid} />))}
    </div>
  );
}

function PersonInfo({ info: { name, age } }) {
  return {
    <div>
      <span>name: {name}</span>
      <span>age: {age}</span>
    </div>
  }
}

```

Sequenced function handlers are called with the results from all previous functions in case your inputs need to be derived from more than one previous call.

```javascript
const sequenceLoadFunctions = sequence([
  { key: 'first', handler: () => dispatch(loadFirst()) },
  { key: 'second', handler: ({ first }) => dispatch(loadSecond(first.someParam)) },
  { key: 'third', handler: ({ first, second }) => dispatch(loadThird(first.someParam, second.anotherParam)) }
]);
```

If you need to make two calls in parallel before you make a third, you can use a combination of `iguazuReduce` and `sequence` to accomplish your goal.

```javascript
const sequenceLoadFunctions = sequence([
  {
    key: 'first',
    handler: iguazuReduce(() => ({
      firstA: () => dispatch(loadFirstA()),
      firstB: () => dispatch(loadFirstB())
    }))
  },
  {
    key: 'second', handler: ({ first: { firstA, firstB } }) => dispatch(loadSecond(firstA, firstB))
  }
]);
```

### Limiting

As some functions called within `loadDataAsProps` can be expensive when ran on every Redux state change, you are able to declare a limiter function when calling `connectAsync`. Calls to `loadDataAsProps` are not limited by default.

```javascript
function loadDataAsProps({ store, ownProps }) {
  const { dispatch, getState } = store;
  return {
    myData: () => dispatch(expensiveQueryToData(ownProps.someParam)),
    myOtherData: () => dispatch(queryMyOtherData(getState().someOtherParam))
  }
}

export default connectAsync({
  loadDataAsProps,
  stateChangeLimiter: onStateChange => debounce(onStateChange, 100),
})(MyContainer);
```

### Fetching On User Action

In the case that `loadDataAsProps` needs to be called on a user action, the initial render can be controlled by the result of the expected user input.

```javascript
/* ComponentA.jsx */
import React, { Component, Fragment } from 'react';
import ComponentB from './ComponentB';

export default class ComponentA extends Component {
  constructor(props) {
    super(props);
    this.state = { buttonClicked: false };
  }

  handleClick = () => this.setState({ buttonClicked: true });

  render() {
    const { buttonClicked } = this.state;
    return (
      <Fragment>
        <button onClick={this.handleClick}>Click to Load</button>
        {
          buttonClicked && <ComponentB />
        }
      </Fragment>
    )
  }
};

/* ComponentB.jsx */
import React from 'react';
import { connectAsync } from 'iguazu';

function ComponentB({ isLoading, loadedWithErrors, myData, myOtherData }) {
  if (isLoading()) {
    return <div>Loading...</div>
  }

  if (loadedWithErrors()) {
    return <div>Oh no! Something went wrong</div>
  }

  return <div>myData = {myData} myOtherData = {myOtherData}</div>
};

function loadDataAsProps({ store, ownProps }) {
  const { dispatch, getState } = store;
  return {
    myData: () => {
      if (!ownProps.someParam) {
        return { status: 'complete', promise: Promise.resolve() }; // data & error should be undefined.
      }
      return dispatch(queryMyData(ownProps.someParam));
    },
    myOtherData: () => dispatch(queryMyOtherData(getState().someOtherParam))
  }
};

export default connectAsync({ loadDataAsProps })(ComponentB);
```

## Global Configuration

Iguazu is also capable of consuming global configuration that will be applied to all instances of `connectAsync`. These options will be applied unless otherwise overridden by providing the equivalent setting in the `connectAsync` call.

```javascript
import { configureIguazu } from 'iguazu';

configureIguazu({
  stateChangeLimiter: onStateChange => debounce(onStateChange, 100), // applied globally.
});

...

function loadDataAsProps({ store, ownProps }) {
  const { dispatch, getState } = store;
  return {
    myData: () => dispatch(expensiveQueryToData(ownProps.someParam)),
    myOtherData: () => dispatch(queryMyOtherData(getState().someOtherParam))
  }
}

export default connectAsync({
  loadDataAsProps,
  stateChangeLimiter: onStateChange => debounce(onStateChange, 500), // override global setting.
})(MyContainer);
```

## Why is it called Iguazu?
This library is all about helping you manage data flow from many different sources. Data flow -> water -> waterfalls -> Iguazu falls - the largest waterfalls system in the world. It could have been named something like react-redux-async, but Iguazu also expects a certain pattern, which means there could potentially be many libraries that follow this pattern that could plug in to Iguazu. A unique name will make them more discoverable. Also it sounds cool.

## Contributing
We welcome Your interest in the American Express Open Source Community on Github.
Any Contributor to any Open Source Project managed by the American Express Open
Source Community must accept and sign an Agreement indicating agreement to the
terms below. Except for the rights granted in this Agreement to American Express
and to recipients of software distributed by American Express, You reserve all
right, title, and interest, if any, in and to Your Contributions. Please [fill
out the Agreement](https://cla-assistant.io/americanexpress/iguazu).

Please feel free to open pull requests and see [CONTRIBUTING.md](./CONTRIBUTING.md) for commit formatting details.

## License
Any contributions made under this project will be governed by the [Apache License
2.0](https://github.com/americanexpress/iguazu/blob/master/LICENSE.txt).

## Code of Conduct
This project adheres to the [American Express Community Guidelines](./CODE_OF_CONDUCT.md).
By participating, you are expected to honor these guidelines.
