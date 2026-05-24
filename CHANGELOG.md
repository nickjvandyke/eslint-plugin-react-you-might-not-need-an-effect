# Changelog

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
