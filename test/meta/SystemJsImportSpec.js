/**
 * Created by tom on 15/03/16.
 */

import chai                         from 'chai';
import sinon                        from 'sinon';
import System                       from '../../node_modules/systemjs/index.js';
import {loadDependencies}           from './TestBootstrap.js';

let ContextMock = sinon.stub();
ContextMock.returns({});


let should = chai.should();

describe('SystemJS', () => {
    let imports = {};
    let customModule = sinon.stub().returns({});

    before(() => {
        System.set(System.normalizeSync('custom/Module.js'), System.newModule({default: customModule}));

        return loadDependencies({
            Module: 'custom/Module.js'
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    after(() => {
        System.delete(System.normalizeSync('custom/Module.js'));
    });

    describe('#import', () => {
        it('imports manually set dependencies', () => {
            imports.Module.should.equal(customModule);
        });
    });
});
