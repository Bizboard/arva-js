/**
 * Created by lundfall on 3/24/16.
 */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency}             from '../../meta/TestBootstrap.js';

let should = chai.should();

describe('FirebaseDataSource', () => {
    let imports = {};

    before(() => {

        mockDependency('firebase');

        return loadDependencies({
            FirebaseDataSource: System.normalizeSync('./src/data/datasources/FirebaseDataSource.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.FirebaseDataSource('', {});
            should.exist(instance);
        });
    });
});