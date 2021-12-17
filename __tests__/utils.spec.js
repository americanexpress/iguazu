import {
  handlePromiseRejection, pick, mapValues, zipObject,
} from '../src/utils';

describe('utils', () => {
  describe('handlePromiseRejection', () => {
    it('should swallow a rejected promise', async () => {
      await expect(handlePromiseRejection(Promise.reject())).resolves.toBe(undefined);
    });
  });
  describe('pick', () => {
    it('should select a subset of an object', () => {
      const startObject = {
        one: 1,
        two: 2,
        three: 3,
      };
      expect(pick(startObject, ['one', 'two'])).toMatchSnapshot();
    });
  });
  describe('mapValues', () => {
    it('should decorate values of object with exclamation', () => {
      const startObject = {
        one: 1,
        two: 2,
        three: 3,
      };
      expect(mapValues(startObject, (item) => `!${item}`)).toMatchSnapshot();
    });
  });
  describe('zipObject', () => {
    it('should make an object from two arrays', () => {
      const firstArray = ['one', 'two', 'three'];
      const secondArray = [1, 2, 3];
      expect(zipObject(firstArray, secondArray)).toMatchSnapshot();
    });
  });
});
