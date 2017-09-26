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

    let propResultMap;
    if (ssr && !ssrEnabled) {
      propResultMap = mapValues(propFuncs, () => ({ status: 'loading' }));
    } else {
      propResultMap = mapValues(propFuncs, value => value({ ssr }));
    }

    return {
      data: reduceData(propResultMap),
      status: reduceStatus(propResultMap),
    };
  }

  return function wrapWithConnectAsync(WrappedComponent) {
    class ConnectAsync extends React.Component {

      constructor(props, context) {
        super(props);
        this.state = buildState({ store: context.store, ownProps: props });
        this.setStateIfNecessary = this.setStateIfNecessary.bind(this);
      }

      componentDidMount() {
        this.mounted = true;
        const { store } = this.context;
        const ownProps = this.props;
        this.unsubscribe = store.subscribe(
          () => (this.mounted && this.setStateIfNecessary(buildState({ store, ownProps })))
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

      setStateIfNecessary(newState) {
        const dataIsEqual = shallowequal(this.state.data, newState.data);
        const statusIsEqual = shallowequal(this.state.status, newState.status);
        if (!dataIsEqual || !statusIsEqual) {
          this.setState(newState);
        }
      }

      asyncBootstrap() {
        if (!ssrEnabled) return false;

        return reducePromise(buildState({ store: this.context.store, ownProps: this.props }))
            .then(() => true);
      }

      render() {
        const { data, status } = this.state;
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
