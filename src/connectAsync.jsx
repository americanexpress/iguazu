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

import React from 'react';
import { ReactReduxContext } from 'react-redux';
import hoistStatics from 'hoist-non-react-statics';
import PropTypes from 'prop-types';
import shallowequal from 'shallowequal';
import { reduceData, reduceStatus, reduceErrors, reducePromise } from './reduce';
import { handlePromiseRejection, pick, mapValues, isServer } from './utils';
import config from './config';

export default function connectAsync({
  loadDataAsProps,
  stateChangeLimiter: localStateChangeLimiter,
  stateChangeComparator: localStateChangeComparator,
}) {
  const ssrEnabled = loadDataAsProps.ssr;
  function buildState({ store, ownProps }) {
    const propFuncs = loadDataAsProps({ store, ownProps });

    let propResultMap;
    if (isServer() && !ssrEnabled) {
      propResultMap = mapValues(propFuncs, () => ({ status: 'loading' }));
    } else {
      propResultMap = mapValues(propFuncs, value => value({ isServer: isServer() }));
    }

    const promise = reducePromise(propResultMap);

    /*
     * The promise is only used during SSR. During the normal render cycle, it is not as important,
     * as everything is driven by state changes. If the promises are ignored, it could lead to an
     * unhandledrejection event, so we catch here to avoid that.
    */
    handlePromiseRejection(promise);

    return {
      data: reduceData(propResultMap),
      status: reduceStatus(propResultMap),
      errors: reduceErrors(propResultMap),
    };
  }

  return function wrapWithConnectAsync(WrappedComponent) {
    class ConnectAsync extends React.Component {
      constructor(props) {
        super(props);
        const { reduxStore, ...restOfProps } = props;
        this.state = buildState({ store: reduxStore, ownProps: restOfProps });
        this.setStateIfNecessary = this.setStateIfNecessary.bind(this);
        this.onReduxStateChange = this.onReduxStateChange.bind(this);
        this.isLoading = this.isLoading.bind(this);
        this.loadedWithErrors = this.loadedWithErrors.bind(this);
      }

      componentDidMount() {
        this.mounted = true;
        const store = this.props.reduxStore;
        const { stateChangeLimiter: globalStateChangeLimiter } = config;
        const stateChangeLimiter = localStateChangeLimiter || globalStateChangeLimiter;
        const onReduxStateChangeLimited = stateChangeLimiter(this.onReduxStateChange);
        this.unsubscribe = store.subscribe(
          () => (this.mounted && onReduxStateChangeLimited())
        );
      }

      // eslint-disable-next-line camelcase
      UNSAFE_componentWillReceiveProps(nextProps) {
        const { reduxStore, ...restOfProps } = this.props;
        const { reduxStore: nextReduxStore, ...nextRestOfProps } = nextProps;
        if (!shallowequal(restOfProps, nextRestOfProps)) {
          this.setStateIfNecessary(buildState({
            store: nextReduxStore,
            ownProps: nextRestOfProps,
          }));
        }
      }

      componentWillUnmount() {
        this.mounted = false;
        this.unsubscribe();
      }

      onReduxStateChange() {
        const { reduxStore, ...restOfProps } = this.props;
        this.setStateIfNecessary(buildState({ store: reduxStore, ownProps: restOfProps }));
      }

      setStateIfNecessary(newState) {
        const { stateChangeComparator: globalStateChangeComparator } = config;
        const stateChangeComparator = localStateChangeComparator || globalStateChangeComparator;
        const dataIsEqual = stateChangeComparator(this.state.data, newState.data);
        const statusIsEqual = stateChangeComparator(this.state.status, newState.status);
        const errorsAreEqual = stateChangeComparator(this.state.errors, newState.errors);
        if (!dataIsEqual || !statusIsEqual || !errorsAreEqual) {
          this.setState(newState);
        }
      }

      isLoading(propsOfInterest) {
        const loadStatusMap = this.state.status;
        const statusesOfInterest =
          Object.values(propsOfInterest ? pick(loadStatusMap, propsOfInterest) : loadStatusMap);

        return statusesOfInterest.some(status => status === 'loading');
      }

      loadedWithErrors(propsOfInterest) {
        const loadErrorMap = this.state.errors;
        const errorsOfInterest =
          Object.values(propsOfInterest ? pick(loadErrorMap, propsOfInterest) : loadErrorMap);

        return errorsOfInterest.some(error => error);
      }

      render() {
        const { data, status, errors } = this.state;
        const { reduxStore, ...restOfProps } = this.props;
        return (
          <WrappedComponent
            {...data}
            {...restOfProps}
            loadStatus={status}
            isLoading={this.isLoading}
            loadErrors={errors}
            loadedWithErrors={this.loadedWithErrors}
          />
        );
      }
    }

    ConnectAsync.propTypes = {
      reduxStore: PropTypes.shape({
        subscribe: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired,
        getState: PropTypes.func.isRequired,
      }).isRequired,
    };
    hoistStatics(ConnectAsync, WrappedComponent);
    ConnectAsync.loadDataAsProps = loadDataAsProps;
    ConnectAsync.displayName =
      `connectAsync(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

    function ReduxConsumerWrapper(props) {
      return (
        <ReactReduxContext.Consumer>
          {({ store }) => <ConnectAsync {...props} reduxStore={store} />}
        </ReactReduxContext.Consumer>
      );
    }

    hoistStatics(ReduxConsumerWrapper, ConnectAsync);
    ReduxConsumerWrapper.displayName = `ReduxConsumerWrapper(${ConnectAsync.displayName})`;

    return ReduxConsumerWrapper;
  };
}
