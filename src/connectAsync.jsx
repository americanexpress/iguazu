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
import hoistStatics from 'hoist-non-react-statics';
import PropTypes from 'prop-types';
import shallowequal from 'shallowequal';
import pick from 'lodash/pick';
import values from 'lodash/values';
import mapValues from 'lodash/mapValues';

import { reduceData, reduceStatus, reduceErrors, reducePromise } from './reduce';
import { isSSR } from './ssr';
import { handlePromiseRejection } from './utils';
import config from './config';

export default function connectAsync({
  loadDataAsProps,
  stateChangeLimiter: localStateChangeLimiter,
  stateChangeComparator: localStateChangeComparator,
}) {
  const ssrEnabled = loadDataAsProps.ssr;
  function buildState({ store, ownProps, bootstrap }) {
    const propFuncs = loadDataAsProps({ store, ownProps });
    const ssr = isSSR();

    let propResultMap;
    if (ssr && !ssrEnabled) {
      propResultMap = mapValues(propFuncs, () => ({ status: 'loading' }));
    } else {
      propResultMap = mapValues(propFuncs, value => value({ ssr }));
    }

    const promise = reducePromise(propResultMap);
    if (bootstrap) {
      return promise;
    }

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

      constructor(props, context) {
        super(props);
        this.state = buildState({ store: context.store, ownProps: props });
        this.setStateIfNecessary = this.setStateIfNecessary.bind(this);
        this.onReduxStateChange = this.onReduxStateChange.bind(this);
        this.isLoading = this.isLoading.bind(this);
        this.loadedWithErrors = this.loadedWithErrors.bind(this);
      }

      componentDidMount() {
        this.mounted = true;
        const { store } = this.context;
        const { stateChangeLimiter: globalStateChangeLimiter } = config;
        const stateChangeLimiter = localStateChangeLimiter || globalStateChangeLimiter;
        const onReduxStateChangeLimited = stateChangeLimiter(this.onReduxStateChange);
        this.unsubscribe = store.subscribe(
          () => (this.mounted && onReduxStateChangeLimited())
        );
      }

      componentWillReceiveProps(nextProps) {
        if (!shallowequal(this.props, nextProps)) {
          this.setStateIfNecessary(buildState({ store: this.context.store, ownProps: nextProps }));
        }
      }

      componentWillUnmount() {
        this.mounted = false;
        this.unsubscribe();
      }

      onReduxStateChange() {
        const { store } = this.context;
        const ownProps = this.props;
        this.setStateIfNecessary(buildState({ store, ownProps }));
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
          values(propsOfInterest ? pick(loadStatusMap, propsOfInterest) : loadStatusMap);

        return statusesOfInterest.some(status => status === 'loading');
      }

      loadedWithErrors(propsOfInterest) {
        const loadErrorMap = this.state.errors;
        const errorsOfInterest =
          values(propsOfInterest ? pick(loadErrorMap, propsOfInterest) : loadErrorMap);

        return errorsOfInterest.some(error => error);
      }

      asyncBootstrap() {
        if (!ssrEnabled) return false;

        return buildState({ store: this.context.store, ownProps: this.props, bootstrap: true })
          .then(() => true);
      }

      render() {
        const { data, status, errors } = this.state;
        return (
          <WrappedComponent
            {...data}
            {...this.props}
            loadStatus={status}
            isLoading={this.isLoading}
            loadErrors={errors}
            loadedWithErrors={this.loadedWithErrors}
          />
        );
      }
    }

    ConnectAsync.contextTypes = {
      store: PropTypes.shape({
        subscribe: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired,
        getState: PropTypes.func.isRequired,
      }),
    };

    hoistStatics(ConnectAsync, WrappedComponent);
    ConnectAsync.loadDataAsProps = loadDataAsProps;
    ConnectAsync.displayName =
      `connectAsync(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

    return ConnectAsync;
  };
}
