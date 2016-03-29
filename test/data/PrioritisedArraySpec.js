/**
 * Created by lundfall on 3/24/16.
 */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency,
    restoreDependency}              from '../meta/TestBootstrap.js';

let should = chai.should();

describe('PrioritisedArray', () => {
    let imports = {};
    let on, once, off;

    before(() => {
        mockDependency('./src/utils/Context.js', {
            Context: {
                getContext: () => ({
                    'get': () => ({on, once, off, child: () => ({on, once, off})})
                })
            }
        });

        return loadDependencies({
            PrioritisedArray: System.normalizeSync('./src/data/PrioritisedArray.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    beforeEach(() => {
        on = sinon.stub();
        once = sinon.stub();
        off = sinon.stub();
    });

    after(() => {
        restoreDependency('./src/utils/Context.js');
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.PrioritisedArray({});
            should.exist(instance);
        });
    });
})
;