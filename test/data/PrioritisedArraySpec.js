/**
 * Created by lundfall on 3/24/16.
 */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency}             from '../meta/TestBootstrap.js';

let should = chai.should();

describe('PrioritisedArray', () => {
    let imports = {};

    before(() => {

        mockDependency('./src/utils/Context.js', {
            Context: {
                getContext: () => ({
                    'get': () => ({child: () => ({once: () => 0})})
                })
            }
        });

        return loadDependencies({
            PrioritisedArray: System.normalizeSync('./src/data/PrioritisedArray.js'),
            DataSource: System.normalizeSync('./src/data/DataSource.js')
        }).then((importedObjects) => {
            imports = importedObjects;

        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.PrioritisedArray();
            should.exist(instance);
        });
    });
})
;