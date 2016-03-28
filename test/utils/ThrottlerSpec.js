/**
 * Created by lundfall on 3/28/16.
 */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency}             from '../meta/TestBootstrap.js';

let should = chai.should();

describe('Throttler', () => {
    let imports = {};

    before(() => {

        return loadDependencies({
            Throttler: System.normalizeSync('./src/utils/Throttler.js'),
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.Throttler('', {});
            should.exist(instance);
        });
    });
});