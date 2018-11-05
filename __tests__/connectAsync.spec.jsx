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

import React, { Component, Children } from 'react';
import PropTypes from 'prop-types';
import { createStore, applyMiddleware } from 'redux';
import { mount } from 'enzyme';
import asyncBootstrapper from 'react-async-bootstrapper';
import thunk from 'redux-thunk';

import { enableSSR, resetSSR } from '../src/ssr';
import * as utils from '../src/utils';
import config from '../src/config';

// Module under test
import connectAsync from '../src/connectAsync';

jest.mock('../src/config', () => ({
  stateChangeLimiter: jest.fn(func => func),
}));

describe('connectAsync', () => {
  function reducer(state = { param: 'x', x: 'populated data' }, action) {
    switch (action.type) {
      case 'UPDATE_PARAM': {
        return Object.assign({}, state, { param: action.param });
      }
      case 'ADD_DATA': {
        const newData = {};
        newData[action.param] = action.data;
        return Object.assign({}, state, newData);
      }
      default: {
        return state;
      }
    }
  }

  function addData(param) {
    return async (dispatch) => {
      const data = await Promise.resolve('more populated data');
      dispatch({
        type: 'ADD_DATA',
        param,
        data,
      });
    };
  }

  let store;

  const myAsyncLoadFunction = jest.fn();
  const loadDataAsProps = jest.fn(({ store: { getState, dispatch }, ownProps }) => ({
    myAsyncData: myAsyncLoadFunction.mockImplementation(() => {
      const state = getState();
      const someParam = ownProps.param || state.param;
      const data = state[someParam];
      const status = data ? 'complete' : 'loading';
      const promise = data ? Promise.resolve() : dispatch(addData(someParam));
      return { data, status, promise };
    }),
  }));

  const renderSpy = jest.fn();
  const Presentation = () => { renderSpy(); return null; };
  const Container = connectAsync({ loadDataAsProps })(Presentation);

  beforeEach(() => {
    store = createStore(reducer, applyMiddleware(thunk));
    loadDataAsProps.ssr = false;
  });

  afterEach(() => {
    jest.clearAllMocks();
    resetSSR();
  });

  it('should pass reduced data and load status as props', () => {
    const props = mount(<Container />, { context: { store } }).find(Presentation).props();
    expect(props.myAsyncData).toEqual('populated data');
    expect(props.loadStatus).toEqual({ all: 'complete', myAsyncData: 'complete' });
    expect(myAsyncLoadFunction).toHaveBeenCalledTimes(1);
  });

  it('should update data and load status when parent props change', () => {
    const wrapper = mount(<Container />, { context: { store } });
    let props = wrapper.find(Presentation).props();
    expect(props.myAsyncData).toEqual('populated data');
    expect(props.loadStatus).toEqual({ all: 'complete', myAsyncData: 'complete' });
    wrapper.setProps({ param: 'y' });
    props = wrapper.find(Presentation).props();
    expect(props.myAsyncData).not.toBeDefined();
    expect(props.loadStatus).toEqual({ all: 'loading', myAsyncData: 'loading' });
    expect(myAsyncLoadFunction).toHaveBeenCalledTimes(2);
  });

  it('should not update data and load status when parent props have not changed', () => {
    const wrapper = mount(<Container />, { context: { store } });
    wrapper.setProps({ y: true });
    wrapper.setProps({ y: true });
    expect(myAsyncLoadFunction).toHaveBeenCalledTimes(2);
  });

  it('should update data and load status when the store has updated', () => {
    const wrapper = mount(<Container irrelevant="old" />, { context: { store } });
    let props = wrapper.find(Presentation).props();
    expect(props.myAsyncData).toEqual('populated data');
    expect(props.loadStatus).toEqual({ all: 'complete', myAsyncData: 'complete' });
    wrapper.setProps({ irrelevant: 'new' });
    store.dispatch({ type: 'UPDATE_PARAM', param: 'y' });
    wrapper.update();
    props = wrapper.find(Presentation).props();
    expect(loadDataAsProps.mock.calls[2][0].ownProps.irrelevant).toEqual('new');
    expect(props.myAsyncData).not.toBeDefined();
    expect(props.loadStatus).toEqual({ all: 'loading', myAsyncData: 'loading' });
    expect(myAsyncLoadFunction).toHaveBeenCalledTimes(3);
  });

  it('should not rerender when the store has updated, but the data and status are the same', () => {
    mount(<Container />, { context: { store } });
    store.dispatch({ type: 'IRRELEVANT_ACTION' });
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('should not update data and load status when store has updated but it has unmounted', () => {
    const wrapper = mount(<Container />, { context: { store } });
    wrapper.unmount();
    store.dispatch({ type: 'X' });
    expect(loadDataAsProps).toHaveBeenCalledTimes(1);
  });

  it('should catch promises during normal render cycle to avoid unhandledrejection', () => {
    const spy = jest.spyOn(utils, 'handlePromiseRejection');
    const promise = Promise.reject('failed to load data');
    const mockloadDataAsProps = () => ({ myAsyncData: () => ({ promise }) });
    const MockComponent = () => null;
    const MockContainer = connectAsync({ loadDataAsProps: mockloadDataAsProps })(MockComponent);
    mount(<MockContainer />, { context: { store } });
    expect(spy).toHaveBeenCalledWith(promise);
  });

  it('should hoist non react statics', () => {
    const Inner = () => null;
    Inner.someStatic = 'someStatic';
    const Wrapped = connectAsync({ loadDataAsProps })(Inner);
    expect(Wrapped.someStatic).toEqual('someStatic');
  });

  it('should set the correct displayName', () => {
    const Implied = () => null;
    const X = () => null;
    X.displayName = 'Explicit';
    expect(connectAsync({ loadDataAsProps })(Implied).displayName).toBe('connectAsync(Implied)');
    expect(connectAsync({ loadDataAsProps })(X).displayName).toBe('connectAsync(Explicit)');
    expect(connectAsync({ loadDataAsProps })(() => null).displayName).toBe('connectAsync(Component)');
  });

  describe('stateChangeLimiter', () => {
    it('applies a globally provided limiter on redux state change', () => {
      const ContainerLimited = connectAsync({
        loadDataAsProps,
      })(Presentation);
      const wrapper = mount(<ContainerLimited />, { context: { store } });
      const instance = wrapper.instance();
      expect(config.stateChangeLimiter).toHaveBeenCalledWith(instance.onReduxStateChange);
    });
    it('applies a locally provided limiter on redux state change', () => {
      const localStateChangeLimiter = jest.fn(func => func);
      const ContainerLimited = connectAsync({
        loadDataAsProps,
        stateChangeLimiter: localStateChangeLimiter,
      })(Presentation);
      const wrapper = mount(<ContainerLimited />, { context: { store } });
      const instance = wrapper.instance();
      expect(localStateChangeLimiter).toHaveBeenCalledWith(instance.onReduxStateChange);
    });
  });

  describe('isLoading', () => {
    it('should be provided as a prop to the wrapped component', () => {
      const wrapper = mount(<Container />, { context: { store } });
      const props = wrapper.find(Presentation).props();
      expect(props.isLoading).toBe(wrapper.instance().isLoading);
    });

    describe('no props of interest provided', () => {
      it('should return true when any of the async props are in the middle of loading', () => {
        const wrapper = mount(<Container />, { context: { store } });
        wrapper.setState({ status: { a: 'loading', b: 'complete' } });
        expect(wrapper.instance().isLoading()).toBe(true);
      });

      it('should return false when all of the async props are done loading', () => {
        const wrapper = mount(<Container />, { context: { store } });
        wrapper.setState({ status: { a: 'complete', b: 'complete' } });
        expect(wrapper.instance().isLoading()).toBe(false);
      });
    });

    describe('props of interest provided', () => {
      it('should return true when any of the async props of intereset are in the middle of loading', () => {
        const wrapper = mount(<Container />, { context: { store } });
        wrapper.setState({ status: { a: 'loading', b: 'complete', c: 'complete' } });
        expect(wrapper.instance().isLoading(['a', 'c'])).toBe(true);
      });

      it('should return false when all of the async props of interest are done loading', () => {
        const wrapper = mount(<Container />, { context: { store } });
        wrapper.setState({ status: { a: 'loading', b: 'complete', c: 'complete' } });
        expect(wrapper.instance().isLoading(['b', 'c'])).toBe(false);
      });
    });
  });

  describe('loadedWithErrors', () => {
    const loadError = new Error('A wild load error appeared');

    it('should be provided as a prop to the wrapped component', () => {
      const wrapper = mount(<Container />, { context: { store } });
      const props = wrapper.find(Presentation).props();
      expect(props.loadedWithErrors).toBe(wrapper.instance().loadedWithErrors);
    });

    describe('no props of interest provided', () => {
      it('should return true if any of the async props had an error while loading', () => {
        const wrapper = mount(<Container />, { context: { store } });
        wrapper.setState({ errors: { a: loadError, b: undefined } });
        expect(wrapper.instance().loadedWithErrors()).toBe(true);
      });

      it('should return false if all of the async props loaded without errors', () => {
        const wrapper = mount(<Container />, { context: { store } });
        wrapper.setState({ errors: {} });
        expect(wrapper.instance().loadedWithErrors()).toBe(false);
      });
    });

    describe('props of interest provided', () => {
      it('should return true when any of the async props of interest had an error while loading', () => {
        const wrapper = mount(<Container />, { context: { store } });
        wrapper.setState({ errors: { a: loadError } });
        expect(wrapper.instance().loadedWithErrors(['a'])).toBe(true);
      });

      it('should return false if all of the async props of interest loaded without errors', () => {
        const wrapper = mount(<Container />, { context: { store } });
        wrapper.setState({ errors: { a: loadError } });
        expect(wrapper.instance().loadedWithErrors(['b', 'c'])).toBe(false);
      });
    });
  });

  describe('SSR', () => {
    class ProviderMock extends Component {
      getChildContext() {
        return { store: this.props.store }; // eslint-disable-line react/prop-types
      }

      render() {
        return Children.only(this.props.children); // eslint-disable-line react/prop-types
      }
    }
    ProviderMock.childContextTypes = {
      store: PropTypes.object.isRequired,
    };

    it('should work with react-async-bootstrapper to preload data', async () => {
      enableSSR();
      loadDataAsProps.ssr = true;
      const Wrapped = connectAsync({ loadDataAsProps })(Presentation);
      const app = (
        <ProviderMock store={store}>
          <Wrapped param="y" />
        </ProviderMock>
      );
      await asyncBootstrapper(app);
      const wrapper = mount(app);
      const props = wrapper.find(Presentation).props();
      expect(props.myAsyncData).toEqual('more populated data');
      expect(props.loadStatus).toEqual({ all: 'complete', myAsyncData: 'complete' });
      // once in asyncBootstrap, once in componentWillMount during ssr tree walk
      // and once in componentWillMount during mount
      expect(myAsyncLoadFunction).toHaveBeenCalledTimes(3);
    });

    it('should skip preloading if ssr option is not set', async () => {
      enableSSR();
      const app = (
        <ProviderMock store={store}>
          <Container />
        </ProviderMock>
      );
      await asyncBootstrapper(app);
      mount(app);
      expect(myAsyncLoadFunction).not.toHaveBeenCalled();
    });
  });
});
