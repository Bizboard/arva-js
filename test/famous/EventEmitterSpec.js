import _                            from 'lodash';
import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,mockDOMGlobals,
    mockDependency}                 from '../meta/TestBootstrap.js';


let expect = chai.expect;
let should = chai.should();

describe('Event emitter', () => {
    let imports = {};

    before(() => {
        mockDOMGlobals();

        mockDependency('./src/utils/Context.js', {
            Context: {
                getContext: () => ({
                    'get': () => ({child: () => ({once: () => 0})})
                })
            }
        });

        return loadDependencies({
            EventEmitter: System.normalizeSync('famous/core/EventEmitter.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let eventEmitter = new imports.EventEmitter();
            should.exist(eventEmitter);
        });
    });

    describe('#once listener', () => {
        it(`Makes a once() registered listener only be called once`, () => {
            let eventEmitter= new imports.EventEmitter();
            let run = sinon.spy();
            eventEmitter.once('ready', run);
            eventEmitter.emit('ready');
            eventEmitter.emit('ready');
            expect(run.calledOnce).to.be.true;
        });

        it(`Handles on() in combination with once() correctly`, () => {
            let eventEmitter= new imports.EventEmitter();
            let onceRunner = sinon.spy();
            let onRunner = sinon.spy();
            let secondOnRunner = sinon.spy();
            eventEmitter.on('ready', onRunner);
            eventEmitter.once('ready', onceRunner);
            eventEmitter.on('ready', secondOnRunner);
            eventEmitter.emit('ready');
            eventEmitter.emit('ready');
            expect(onceRunner.calledOnce).to.be.true;
            expect(onRunner.calledTwice).to.be.true;
            expect(secondOnRunner.calledTwice).to.be.true;
        });

        it(`Doesn't let removeListener invalidate the once() logic`, () => {
            let eventEmitter= new imports.EventEmitter();
            let onceRunner = sinon.spy();
            let onRunner = sinon.spy();
            let secondOnRunner = sinon.spy();
            let selfRemoving = () => {
                eventEmitter.removeListener('ready', selfRemoving);
            };
            eventEmitter.on('ready', selfRemoving);
            eventEmitter.on('ready', onRunner);
            eventEmitter.once('ready', onceRunner);
            eventEmitter.on('ready', secondOnRunner);
            eventEmitter.on('ready', selfRemoving);
            eventEmitter.emit('ready');
            eventEmitter.emit('ready');
            expect(onceRunner.calledOnce).to.be.true;
            expect(onRunner.calledTwice).to.be.true;
            expect(secondOnRunner.calledTwice).to.be.true;
        });
    });

});