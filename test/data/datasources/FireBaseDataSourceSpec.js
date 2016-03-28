/**
 * Created by lundfall on 3/24/16.
 */

import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies,
    mockDependency}                 from '../../meta/TestBootstrap.js';

let should = chai.should();

describe('FirebaseDataSource', () => {
    let imports = {};
    let on, once, off;

    before(() => {

        mockDependency('firebase', function Firebase(path){
            this.on = on;
            this.once = once;
            this.off = off;
        });

        return loadDependencies({
            FirebaseDataSource: System.normalizeSync('./src/data/datasources/FirebaseDataSource.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    beforeEach(() => {
        on = sinon.stub();
        once = sinon.stub();
        off = sinon.stub();
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.FirebaseDataSource('', {});
            should.exist(instance);
        });
    });

    describe('#events', () => {
        it('passes through own on() method to Firebase.on()', () => {
            let instance = new imports.FirebaseDataSource('', {});
            let callback = function(){};
            instance.on('value', callback);
            instance.on('child_added', callback);
            instance.on('child_changed', callback);
            instance.on('child_moved', callback);
            instance.on('child_removed', callback);

            on.callCount.should.equal(5);
            should.equal(on.calledWith('value'), true);
            should.equal(on.calledWith('child_added'), true);
            should.equal(on.calledWith('child_changed'), true);
            should.equal(on.calledWith('child_moved'), true);
            should.equal(on.calledWith('child_removed'), true);
        });

        it('passes through own once() method to Firebase.on()', () => {
            let instance = new imports.FirebaseDataSource('', {});
            let callback = function(){};
            instance.once('value', callback);
            instance.once('child_added', callback);
            instance.once('child_changed', callback);
            instance.once('child_moved', callback);
            instance.once('child_removed', callback);

            on.callCount.should.equal(5);
            should.equal(on.calledWith('value'), true);
            should.equal(on.calledWith('child_added'), true);
            should.equal(on.calledWith('child_changed'), true);
            should.equal(on.calledWith('child_moved'), true);
            should.equal(on.calledWith('child_removed'), true);
        });
    });
});