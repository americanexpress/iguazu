import React from 'react';
import hoistStatics from 'hoist-non-react-statics';
import PropTypes from 'prop-types';
import shallowequal from 'shallowequal';
import mapValues from 'lodash/mapValues';

import { reduceData, reduceStatus, reducePromise } from './reduce';
import { isSSR } from './ssr';

export default function connectAsync({ loadDataAsProps }) {
  const ssrEnabled = loadDataAsProps.ssr;
  function buildState({ store, ownProps }) {
    const propFuncs = loadDataAsProps({ store, ownProps });
    const ssr = isSSR();

    let state;
    if (ssr && !ssrEnabled) {
      state = mapValues(propFuncs, () => ({ status: 'loading' }));
    } else {
      state = mapValues(propFuncs, value => value({ ssr }));
    }

    return state;
  }

  return function wrapWithConnectAsync(WrappedComponent) {
    class ConnectAsync extends React.Component {

      componentWillMount() {
        this.mounted = true;
        this.setState(buildState({ store: this.context.store, ownProps: this.props }));
      }

      componentDidMount() {
        const { store } = this.context;
        this.unsubscribe = store.subscribe(
          () => (this.mounted && this.setState(buildState({ store, ownProps: this.props })))
        );
      }

      componentWillReceiveProps(nextProps) {
        if (!shallowequal(this.props, nextProps)) {
          this.setState(buildState({ store: this.context.store, ownProps: nextProps }));
        }
      }

      componentWillUnmount() {
        this.mounted = false;
        this.unsubscribe();
      }

      asyncBootstrap() {
        if (!ssrEnabled) return false;

        return reducePromise(buildState({ store: this.context.store, ownProps: this.props }))
            .then(() => true);
      }

      render() {
        const data = reduceData(this.state);
        const status = reduceStatus(this.state);
        return <WrappedComponent loadStatus={status} {...data} {...this.props} />;
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
