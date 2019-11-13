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


// eslint-disable-next-line import/prefer-default-export
export function handlePromiseRejection(promise) {
  return promise.then(null, () => { /* swallow */ });
}

export function pick(obj, keys) {
  let index = keys.length - 1;
  const nextObj = {};
  while (index > -1) {
    nextObj[keys[index]] = obj[keys[index]];
    index -= 1;
  }
  return nextObj;
}

export function mapValues(obj, callback) {
  const keys = Object.keys(obj);
  let index = keys.length - 1;
  const nextObj = {};
  while (index > -1) {
    nextObj[keys[index]] = callback(obj[keys[index]]);
    index -= 1;
  }
  return nextObj;
}

export function zipObject(firstArray, secondArray) {
  const len = firstArray.length;
  let index = 0;
  const nextObj = {};
  while (index < len) {
    nextObj[firstArray[index]] = secondArray[index];
    index += 1;
  }
  return nextObj;
}

export function isServer() {
  return typeof window === 'undefined';
}
