import React, { Component, Children } from 'react';
import PropTypes from 'prop-types';
import { createStore, applyMiddleware } from 'redux';
import { mount } from 'enzyme';
import asyncBootstrapper from 'react-async-bootstrapper';
import thunk from 'redux-thunk';

import { enableSSR, resetSSR } from '../src/ssr';

// Module under test
import connectAsync from '../src/connectAsync';

describe('connectAsync', () => {
  class ProviderMock extends Component {
    getChildContext() {
      return { store: this.props.store };
    }

    render() {
      const { store, children, ...rest } = this.props;
      return React.cloneElement(
        Children.only(this.props.children),
        rest
      );
    }
  }
  ProviderMock.childContextTypes = {
    store: PropTypes.object.isRequired,
  };
  ProviderMock.propTypes = {
    store: PropTypes.shape({
      dispatch: PropTypes.func.isRequired,
      getState: PropTypes.func.isRequired,
    }).isRequired,
    children: PropTypes.element.isRequired,
  };

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

  const Presentation = () => null;
  const Container = connectAsync({ loadDataAsProps })(Presentation);

  let iguazuApp;

  beforeEach(() => {
    store = createStore(reducer, applyMiddleware(thunk));
    iguazuApp = (
      <ProviderMock store={store}>
        <Container />
      </ProviderMock>
    );
    loadDataAsProps.ssr = false;
  });

  afterEach(() => {
    jest.clearAllMocks();
    resetSSR();
  });

  it('should pass reduced data and load status as props', () => {
    const props = mount(iguazuApp).find(Presentation).props();
    expect(props.myAsyncData).toEqual('populated data');
    expect(props.loadStatus).toEqual({ all: 'complete', myAsyncData: 'complete' });
    expect(myAsyncLoadFunction).toHaveBeenCalledTimes(1);
  });

  it('should update data and load status when parent props change', () => {
    const wrapper = mount(iguazuApp);
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
    const wrapper = mount(iguazuApp);
    wrapper.setProps({ y: true });
    wrapper.setProps({ y: true });
    expect(myAsyncLoadFunction).toHaveBeenCalledTimes(2);
  });

  it('should update data and load status when the store has updated', () => {
    const wrapper = mount(iguazuApp);
    let props = wrapper.find(Presentation).props();
    expect(props.myAsyncData).toEqual('populated data');
    expect(props.loadStatus).toEqual({ all: 'complete', myAsyncData: 'complete' });
    store.dispatch({ type: 'UPDATE_PARAM', param: 'y' });
    props = wrapper.find(Presentation).props();
    expect(props.myAsyncData).not.toBeDefined();
    expect(props.loadStatus).toEqual({ all: 'loading', myAsyncData: 'loading' });
    expect(myAsyncLoadFunction).toHaveBeenCalledTimes(2);
  });

  it('should not update data and load status when store has updated but it has unmounted', () => {
    const wrapper = mount(iguazuApp);
    wrapper.unmount();
    store.dispatch({ type: 'X' });
    expect(loadDataAsProps).toHaveBeenCalledTimes(1);
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

  describe('SSR', () => {
    it('should work with react-async-bootstrapper to preload data', async () => {
      enableSSR();
      loadDataAsProps.ssr = true;
      const Wrapped = connectAsync({ loadDataAsProps })(Presentation);
      const app = (
        <ProviderMock param="y" store={store}>
          <Wrapped />
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
      await asyncBootstrapper(iguazuApp);
      mount(iguazuApp);
      expect(myAsyncLoadFunction).not.toHaveBeenCalled();
    });
  });
});
