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

    describe('#events', () => {
        it('triggers a single time on once() without context', () => {
            let instance = new imports.PrioritisedArray({});
            let eventhandler = sinon.stub();
            instance.once('value', eventhandler);

            for(let i = 0; i < 5; i++) {
                instance._eventEmitter.emit('value', instance);
            }

            should.equal(eventhandler.callCount, 1);
        });

        it('triggers a single time on once() with context', () => {
            let instance = new imports.PrioritisedArray({});
            let eventhandler = sinon.stub();
            instance.once('value', eventhandler, this);

            for(let i = 0; i < 5; i++) {
                instance._eventEmitter.emit('value', instance);
            }

            should.equal(eventhandler.callCount, 1);
        });

        it('doesn\'t loop when causing a change event inside once()', () => {
            let instance = new imports.PrioritisedArray({});
            let maxExecutionTimes = 10;
            let eventhandler = sinon.spy(function(){ 
                if(maxExecutionTimes-- > 0){
                    instance._eventEmitter.emit('value', instance);
                } 
            });
            instance.once('value', eventhandler, this);

            for(let i = 0; i < 5; i++) {
                instance._eventEmitter.emit('value', instance);
            }

            should.equal(eventhandler.callCount, 1);
        });

        it('_onChildChanged changes the existing model instead of creating a new one', () => {
            class ModelMock { _onChildValue = sinon.stub(); }
            let instance = new imports.PrioritisedArray({});
            let model = new ModelMock();

            instance[0] = model;
            instance._ids = {'1': 0};
            instance._dataType = ModelMock;
            instance._onChildChanged({key: '1', ref: {}, val: () => ({})});

            should.equal(model._onChildValue.callCount, 1);
        });
    });
});
