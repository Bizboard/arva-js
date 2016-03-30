/**
 * Created by lundfall on 3/30/16.
 */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies, mockDOMGlobals,restoreDOMGlobals,
    mockDependency}             from '../meta/TestBootstrap.js';

let should = chai.should();
let expect = chai.expect;

describe('ArvaRouter', () => {
    let imports = {};

    before(() => {
        mockDOMGlobals();
        return loadDependencies({
            ArvaRouter: System.normalizeSync('./src/routers/ArvaRouter.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    after(() => {
        restoreDOMGlobals();
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.ArvaRouter();
            should.exist(instance);
        });
    });


    describe('#route execution triggers', () => {

        it('changes location when executing route', () => {
            let instance = new imports.ArvaRouter();
            let controllerMethod = sinon.spy();
            instance.add('test/:method', controllerMethod);
            instance.go('testController', 'myMethod');
            expect(controllerMethod.calledOnce).to.be.true;
            expect(window.location.hash).to.equal('#/test/myMethod');
        });
        it('executes a route when location changes', () => {
            let instance = new imports.ArvaRouter();
            let controllerMethod = sinon.spy();
            instance.add('test/:method', controllerMethod);
            window.location.hash = '#/test/myMethod';
            instance.run();
            expect(controllerMethod.calledOnce).to.be.true;
        });
    });
    
    describe('#history', () => {
        it('can go back in history without getting too any previous states', () => {
            let instance = new imports.ArvaRouter();
            instance.add('test1/:method', sinon.stub());
            instance.add('test2/:method', sinon.stub());
            instance.add('test3/:method', sinon.stub());
            instance.go('test1Controller', 'myMethod');
            instance.go('test2Controller', 'myMethod');
            instance.go('test1Controller', 'myMethod');
            instance.go('test3Controller', 'myMethod');
            expect(instance.history.length).to.equal(2);
            expect(instance.history[0].url).to.equal('test1/myMethod');
            expect(instance.history[1].url).to.equal('test3/myMethod');
        });
    });




});