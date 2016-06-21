/**
 * Created by lundfall on 3/25/16.
 */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency}             from '../meta/TestBootstrap.js';

let should = chai.should();

describe('PrioritisedObject', () => {
    let imports = {};

    before(() => {

        mockDependency('famous/surfaces/InputSurface.js', function () {
            this.options = {};
            this.on = sinon.stub();
        });


        return loadDependencies({
            PrioritisedObject: System.normalizeSync('./src/data/PrioritisedObject.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.PrioritisedObject();
            should.exist(instance);
        });
    });

    describe('#events', () => {
        it('emits ready event only once if no data in dataSource', () => {
            let instance = new imports.PrioritisedObject(undefined, { getPriority: () => 1, val: () => ({}), numChildren: () => 0, ref: {} });
            let stub = sinon.stub();
            instance.on('ready', stub);
            should.equal(stub.callCount, 1);
        });
    });
});