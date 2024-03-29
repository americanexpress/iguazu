# [3.2.0](https://github.com/americanexpress/iguazu/compare/v3.1.0...v3.2.0) (2021-12-17)


### Features

* **peerDeps:** more permissive react compatibility ([63012d0](https://github.com/americanexpress/iguazu/commit/63012d0f28fdc720f9d05122e0865dacd147ae8f))

# [3.1.0](https://github.com/americanexpress/iguazu/compare/v3.0.2...v3.1.0) (2020-08-14)


### Bug Fixes

* **release:** fix release process ([b35f735](https://github.com/americanexpress/iguazu/commit/b35f735d76030234334be45716d1d84c0fe5cde3))


### Features

* **loadHelpers:** return promise from defer ([da93881](https://github.com/americanexpress/iguazu/commit/da93881ca5a4f48e7ea0efe07979783091fae256))

## [3.0.2](https://github.com/americanexpress/iguazu/compare/v3.0.1...v3.0.2) (2020-03-02)


### Bug Fixes

* **reduce:** handle reduced promise rejection ([7789c44](https://github.com/americanexpress/iguazu/commit/7789c44bcdbe76dbc337f1420a6374b9c90b8d77))

## [3.0.1](https://github.com/americanexpress/iguazu/compare/v3.0.0...v3.0.1) (2020-03-02)


### Bug Fixes

* **release:** needs to update package json version ([260ff6b](https://github.com/americanexpress/iguazu/commit/260ff6bc1e8cd555d77d059771a9971f331e4eab))

# [3.0.0](https://github.com/americanexpress/iguazu/compare/v2.5.2...v3.0.0) (2020-01-08)


### chore

* **version:** release v3.0.0 ([976a761](https://github.com/americanexpress/iguazu/commit/976a761cf124d001d688644bffdea5be109be768))


### Features

* **sequence:** Continue sequences with noncritical errors. ([e75dd1f](https://github.com/americanexpress/iguazu/commit/e75dd1fe032ad842312381d26da132ec28e7d37d))
* **ssr:** replaced ssr methods with isServer ([a8474aa](https://github.com/americanexpress/iguazu/commit/a8474aaa224a317cd008f940759cd8f7020cc86b))
* **v3:** using new react context, latest redux, and removed lodash ([da6bc8e](https://github.com/americanexpress/iguazu/commit/da6bc8e50a59229d257d659ab3d22cb001e395a6)), closes [#3](https://github.com/americanexpress/iguazu/issues/3)


### BREAKING CHANGES

* **version:** major internal upgrades to support React 16's new Context API, Redux 4.x.x, React Redux 7.x.x.
Removed enableSSR, disableSSR, and isSSR methods in favor of checking for window to determine Server versus Client in SSR mode.
loadDataAsProps functions receive isServer as an argument rather than ssr now.
Moved react, react-dom, react-redux, redux, and redux-thunk to peerDependencies
Removed lodash
