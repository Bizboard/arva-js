/**
 * Created by lundfall on 3/28/16.
 */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency}             from '../meta/TestBootstrap.js';

let should = chai.should();
let expect = chai.expect;

describe('Context', () => {
    let imports = {};

    before(() => {


        return loadDependencies({
            Context: System.normalizeSync('./src/utils/Context.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#methods', () => {
        it('can be built without errors', () => {
            let instance = new imports.Context.buildContext();
            should.exist(instance);
        });

        it('can specify an instance which can be reused', () => {
            let instance = new imports.Context.buildContext();
            class Test {};
            class Test2 {};
            let testInstance = instance.get(Test);
            expect(testInstance).to.equal(instance.get(Test));
            expect(testInstance).to.not.equal(instance.get(Test2));
        });
    });
});