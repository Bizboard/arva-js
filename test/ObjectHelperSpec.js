/**
 * Created by tom on 4/12/15.
 */

import chai                         from 'chai';
import {loadDependencies}           from './TestBootstrap.js';

let should = chai.should();

describe('ObjectHelper', () => {
    let imports = {};

    before(() => {
        return loadDependencies({ObjectHelper: './src/utils/ObjectHelper.js'}).then((importedObjects) => { imports = importedObjects; });
    });

    describe('#methods', () => {
        it('returns only enumerable properties of a plain object', () => {
            let ObjectHelper = imports.ObjectHelper;
            let testData = {visible: true};
            Object.defineProperties(testData, {
                enumerableGetter: {
                    enumerable: true,
                    get: function () { return true; }
                },
                nonEnumerableGetter: {
                    enumerable: false,
                    get: function () { return true; }
                },
                enumerableValue: {
                    enumerable: true,
                    value: true
                },
                nonEnumerableValue: {
                    enumerable: false,
                    value: true
                }
            });

            let enumerableProperties = ObjectHelper.getEnumerableProperties(testData);
            enumerableProperties.should.include.keys('visible', 'enumerableGetter', 'enumerableValue');
            enumerableProperties.should.not.include.keys('nonEnumerableGetter', 'nonEnumerableValue');
        });
    });
});