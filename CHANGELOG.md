# Changelog

## [1.2.0](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v1.1.0...v1.2.0) (2026-11-07)


### Features

* see through TypeScript-only syntax ([4eeb4ad](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/4eeb4ad935e7a426cf2dafbef10d7cbf31f3133c))
* support popular third-party effect wrappers ([2b32a9e](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/2b32a9e005e4fef60b635b62b25c163b51e5a4fb))
* treat context values as props ([8c1c7ec](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/8c1c7ec7015e6ee5a4be28cb5c0f37dc92717619))


### Bug Fixes

* analyze `const Component = function() {}` components ([d26fee7](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/d26fee7d22569884afd07c4fb7e402e8f54ee865))
* analyze effects with omitted or variable deps ([3e7dc7e](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/3e7dc7e3cf8aa4fd25c7c71b13eb852cfbf60b9b))
* follow member access on aliases ([0faca35](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/0faca35e082b0a334e62a3d24451a56c790ac5de))
* follow only stable, invoked aliases in call chains ([54c13f6](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/54c13f6d3ba794892ee042f1336a35ef2740030d))
* handle defaults in useState destructuring ([36bda5f](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/36bda5f59d555282c2ed88387c4af07a1824162e))
* **no-initialize-state:** treat aliased setters in deps as setters ([997216e](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/997216e2d8e68df6460cb55f6f825445d3d0cb06))
* **no-pass-live-state-to-parent:** remove duplicated quotes from message ([96a22c5](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/96a22c58dce13443cc0aa746545a9004a7761b68))
* **no-reset-all-state-on-prop-change:** count useState calls instead of state reads ([23e5bea](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/23e5bea9d275f4e9095629ed240b2c92ae33accd))
* **no-reset-all-state-on-prop-change:** flag when the same setter is called twice ([80a0ec0](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/80a0ec0501be38d90df276cbb155bc32fc277b72))
* **no-reset-all-state-on-prop-change:** handle wrapper setters ([493d052](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/493d052fad67f8e60a2940cc8634193345854e13))
* report the written state for wrapper setters ([7bf9dc9](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/7bf9dc9bec0fd729c6e4848c75b5be167bd501e0))

## [1.1.0](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v1.0.3...v1.1.0) (2026-11-01)


### Features

* support renamed React hook imports ([a4e0f09](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/a4e0f09c8767ffced39d74ab75abc1fb261b6adb))


### Bug Fixes

* **config:** name the flat configs ([b30550d](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/b30550dabbeebdb023a7a25a603b0650daf643f9))
* **config:** stop adding files to the lint set ([fefa3d1](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/fefa3d1e8002438f05b1288224b54fa9f62dd2e6))
* **no-pass-data-to-parent:** remove duplicated quotes from message ([2b2b42a](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/2b2b42afd1ebbb2b390ebdade3b9251e39530f9c))

## [1.0.3](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v1.0.2...v1.0.3) (2026-10-30)


### Bug Fixes

* stop defining/recommending browser globals for consumers ([b3ed592](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/b3ed592ef14c7c039451d2a68069b39bf446264b))

## [1.0.2](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v1.0.1...v1.0.2) (2026-08-20)


### Miscellaneous Chores

* trigger release ([3bbeb2c](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/3bbeb2caadf93f326e6cef6da0a6e968c8e40180))

## [1.0.1](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v1.0.0...v1.0.1) (2026-06-15)


### Bug Fixes

* add `homepage` and `bugs.url` to package.json ([a5395f8](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/a5395f81966b075773babd322bd157af65fbf0d5))
* update `package.json#description` ([02d3f3f](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/02d3f3fd6a9bc4f5472562e8f5d1d7b87be01f81))

## [1.0.0](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.11.1...v1.0.0) (2026-05-31)

This semantic v1.0.0 release signifies my confidence in the plugin's stability and reliability after many iterations.

Thank you to everyone that contributed real-world issues along the way!

### Miscellaneous Chores

* trigger release ([394a44d](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/394a44d9b66895bad8bc384ed3726f3360798441))

## [0.11.1](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.11.0...v0.11.1) (2026-05-30)


### Features

* add more context to messages for clarity and actionability ([efad9aa](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/efad9aac787c4f906dd4c4445e15baeb77cf9e32))

## [0.11.0](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.10.4...v0.11.0) (2026-05-29)


### ⚠ BREAKING CHANGES

* **no-external-store-subscription:** new recommended rule

### Features

* **no-external-store-subscription:** new recommended rule ([83267dc](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/83267dcde6315a5a1509a8edf554086e2a75ee20))

## [0.10.4](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.10.3...v0.10.4) (2026-05-29)


### Features

* follow call chains involving aliases ([ddbbb5d](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/ddbbb5d7458ee57dddf054a4eb879ad38b9faf05))
* follow named functions passed to `useEffect`s ([d98285e](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/d98285e166d520aa02e9ac7b4c6982a8ea86cc60))

## [0.10.3](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.10.2...v0.10.3) (2026-05-28)


### Features

* **no-derived-state:** remove `avoidSingleSetter` case ([06a1874](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/06a187427904fac4893ce12563fb0e7841d18dbf))


### Bug Fixes

* ignore arguments to upstream calls when searching for state/props ([b457d15](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/b457d153cd733c35fca14665bb23928302a753d4))

## [0.10.2](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.10.1...v0.10.2) (2026-05-24)


### Bug Fixes

* **no-event-handler:** flag at usage instead of declaration ([bffa6ab](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/bffa6ab27236c59e38fba9235c8d7e165a00e899))

## [0.10.1](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.10.0...v0.10.1) (2026-05-06)


### Features

* more idiomatic recommendation for passing to parent inside custom hooks ([b0dacf4](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/b0dacf4bacbe746c635f6f4efd3134b2a76173f0))
* **no-event-handler:** flag props ([d246668](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/d246668dc8f4f1c34bd9cc134d539992b38e8cb5))


### Bug Fixes

* **no-initialize-state:** analyze effects that only have setter in deps ([1a7174f](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/1a7174fc1296165fecaa8ef518d7b5b5faaecd8e))
* when deps is missing, still run rules that don't rely on them ([cefdfcd](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/cefdfcdbd1c199be0747997b0de3a4ed9476e657))

## [0.10.0](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.9.3...v0.10.0) (2026-05-02)


### ⚠ BREAKING CHANGES

* **no-empty-effect:** remove rule ([#67](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/67))

### Features

* **no-empty-effect:** remove rule ([#67](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/67)) ([1fbc74a](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/1fbc74a2833a84fee2f388fb37102d346e520d52))

## [0.9.3](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.9.2...v0.9.3) (2026-04-08)

### Refactors

* **build**: use tsdown, add publish validation ([cc2101a](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/cc2101a28ae83d4e11c421bbfaee11ffaa26bcb8))

### Miscellaneous Chores

* manual release ([f01d76d](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/f01d76d7e58460106c431f7d4357065688396709))

## [0.9.2](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.9.1...v0.9.2) (2026-03-03)


### Bug Fixes

* dont consider calls to be prop callbacks when they merely receive a prop arg ([3feb48f](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/3feb48f09e21548ff14de1185418794e2b63392e))

## [0.9.1](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.9.0...v0.9.1) (2026-02-15)


### Bug Fixes

* **types:** type the recommended strict configs ([e65513d](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/e65513df307ab26525f30fb026ceaa5870f6af32))

## [0.9.0](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/compare/v0.8.5...v0.9.0) (2026-02-14)


### ⚠ BREAKING CHANGES

* **no-pass-ref-to-parent:** remove rule

### Features

* **no-pass-ref-to-parent:** remove rule ([8428e47](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/commit/8428e477d5d54a24c231f5581c92ee4332a88288))
