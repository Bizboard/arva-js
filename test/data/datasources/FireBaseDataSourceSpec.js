/**
 * Created by lundfall on 3/24/16.
 */

import chai                         from 'chai';
import sinon                        from 'sinon';
import {
    loadDependencies,
    mockDependency
}                 from '../../meta/TestBootstrap.js';

let should = chai.should();

describe('FirebaseDataSource', () => {
    let imports = {};
    let on, once, off, push;
    let mockedFirebase = () => {};

    before(() => {
        mockDependency('firebase', mockedFirebase);

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
        push = sinon.stub().returns({key: '1234567890'});

        /* Create a spy mocking the normal firebase.database().ref() object */
        let refSpy = sinon.spy(function(path){
            path = path.indexOf('/') === 0 ? path.substring(1) : path;

            let pathComponents = path.split('/').filter((string) => string != '');
            let key = pathComponents.pop();
            let parent = path.indexOf('http') === 0 ? 'https://' + pathComponents.slice(1).join('/') : `https://x.firebaseio.com/${pathComponents.join('/')}`;
            let toString = path.indexOf('http') === 0 ? path : `https://x.firebaseio.com/${path}`;
            return {
                on, once, off, push, key, toString: () => toString,
                parent: parent[parent.length - 1] === '/' ? parent.substring(0, parent.length - 1) : parent,
                root: 'https://x.firebaseio.com',
                orderByPriority: () => refSpy(path)
            };
        });
        
        mockedFirebase.database = () => {
            return {ref: refSpy};
        };
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.FirebaseDataSource('', {});
            should.exist(instance);
        });
    });

    describe('#events', () => {
        it('passes through own on() method to firebase.database().ref().on()', () => {
            let instance = new imports.FirebaseDataSource('', {});
            let callback = function () {};
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

        it('passes through own once() method to firebase.database().ref().on()', () => {
            let instance = new imports.FirebaseDataSource('', {});
            let callback = function () {};
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

    describe('#behaviour', () => {
        it('has valid paths in path, child, parent, root, and toString methods.', () => {
            let parent = 'parent', child = 'child', path = `/${parent}/${child}`;
            let root = 'https://x.firebaseio.com';

            let instance = new imports.FirebaseDataSource(path, {});
            should.equal(instance.key(), child);
            should.equal(instance.parent(), `${root}/${parent}`);
            should.equal(instance.toString(), `${root}/${parent}/${child}`);

            /* The path() method is defined by the Arva DataSource, and is not part of Firebase */
            should.equal(instance.path(), `/${parent}/${child}`);
        });
    });

    describe('#integration', () => {

        it('does not use absolute URLs in firebase.database().ref()', () => {
            let path = '/parent';
            let instance = new imports.FirebaseDataSource(path, {});
            should.equal(mockedFirebase.database().ref.getCall(0).args[0], path);

            let childPath = 'someChild';
            let child = instance.child(childPath);
            should.equal(mockedFirebase.database().ref.getCall(1).args[0], `${path}/${childPath}`);

            let pushedPath = instance.push({test: 1});
            should.equal(mockedFirebase.database().ref.getCall(2).args[0], `${path}/1234567890`);
        });
    });
});