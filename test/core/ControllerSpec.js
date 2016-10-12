/* global describe, it, before, beforeEach, after, afterEach */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,mockDOMGlobals,restoreDOMGlobals,restoreDependency,
    mockDependency}                 from '../meta/TestBootstrap.js';

let expect = chai.expect;
let should = chai.should();

describe('Controller', () => {
    let imports = {};

    before(() => {
        /* Mock famous-flex's FlexScrollView so no attempt to insert anything into the DOM is made. */
        mockDependency('famous-flex/AnimationController.js', System.newModule({default: function () { this.options = {}; }}));
        return loadDependencies({
            Controller: System.normalizeSync('./src/core/Controller.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    after(() => {
        restoreDependency('famous-flex/AnimationController.js');
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.Controller({add: sinon.stub()});
            should.exist(instance);
        });
    });

    describe('#router path', () => {
        it('sets the router path correctly', () => {
            let addFunction = sinon.spy();
            class MyCustomController extends imports.Controller {};
            let instance = new MyCustomController({add: addFunction});
            expect(addFunction.withArgs('MyCustom/:method',instance.onRouteCalled).calledOnce).to.be.true;
        });
    });
});