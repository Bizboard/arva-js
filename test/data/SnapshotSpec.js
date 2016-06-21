/**
 * Created by lundfall on 3/25/16.
 */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency}             from '../meta/TestBootstrap.js';

let should = chai.should();

describe('Snapshot', () => {
    let imports = {};

    before(() => {

        return loadDependencies({
            Snapshot: System.normalizeSync('./src/data/Snapshot.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.Snapshot();
            should.exist(instance);
        });
        it('has property based key and ref references', () => {
            let instance = new imports.Snapshot('', {});
            should.not.equal(typeof instance.key, 'function');
            should.not.equal(typeof instance.ref, 'function');
        });
    });
});