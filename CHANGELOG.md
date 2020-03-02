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
