/**
 * Created by tom on 23/10/15.
 */

import chai                         from 'chai';
import sinon                        from 'sinon';
import {
    loadDependencies,
    mockDependency
}                 from '../../meta/TestBootstrap.js';

let should = chai.should();

describe('SharePointDataSource', () => {
    let imports = {};

    before(() => {
        /* Mock web workers for the SharePoint client if we're running tests from nodejs */
        if (typeof Worker === 'undefined') { global.Worker = class Worker { postMessage() {} }; }

        return loadDependencies({
            SharePoint: 'SPSoapAdapter/SharePoint.js'
        }).then((importedObjects) => {
            let originalSharePoint = importedObjects.SharePoint;

            mockDependency('SPSoapAdapter/SharePoint.js', {
                SharePoint: class SharePoint extends originalSharePoint {
                    constructor(options) {
                        super(options);
                        sinon.spy(this, 'on');
                        sinon.spy(this, 'once');
                        sinon.spy(this, 'off');
                        sinon.spy(this, 'set');
                    }
                }
            });
        }).then(() => {
                return loadDependencies({
                    SharePointDataSource: './src/data/datasources/SharePointDataSource.js'
                });
            }
        ).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('builds a dataReference when given a path', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/list');
            should.exist(dataSource._dataReference);
        });
        it('does not build a dataReference when only a site is given', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/');
            should.not.exist(dataSource._dataReference);
        });
        it('saves its options correctly', () => {
            let query = {1: 1};
            let orderBy = 'id';
            let limit = 100;
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/', {query: query, orderBy, limit});
            dataSource.options.query.should.deep.equal(query);
            dataSource.options.orderBy.should.equal(orderBy);
            dataSource.options.limit.should.equal(limit);
        });
    });

    describe('#events', () => {
        it('calls setValueChangedCallback callback immediately after push', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/List');
            let stub = sinon.stub();
            let childRef = dataSource.push({test: true});
            childRef.setValueChangedCallback(stub);

            stub.callCount.should.equal(1);
        });
        it('calls setValueChangedCallback callback immediately after set', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/List/1');
            let stub = sinon.stub();
            dataSource.set({test: true});
            dataSource.setValueChangedCallback(stub);

            stub.callCount.should.equal(1);
        });
        it('triggers the callback in once() exactly one time after calling set(), even if another set() is done afterwards', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/List/1');
            let stub = sinon.stub();
            dataSource.set({test1: true});
            dataSource.once('value', stub);
            dataSource.set({test2: true});

            stub.callCount.should.equal(1);
        });
        it('properly removes callbacks upon calling off() without specifying event type', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/List/1');
            let stub = sinon.stub();
            dataSource.once('value', stub);
            dataSource.off();
            dataSource.set({test: true});
            stub.callCount.should.equal(0);
        });
        it('passes through own on() method to SharePoint.on()', () => {
            let instance = new imports.SharePointDataSource('http://somedomain.org/site/List/1');
            let callback = function () {};
            instance.on('value', callback);
            instance.on('child_added', callback);
            instance.on('child_changed', callback);
            instance.on('child_moved', callback);
            instance.on('child_removed', callback);

            let on = instance._dataReference.on;
            on.callCount.should.equal(5);
            should.equal(on.calledWith('value'), true);
            should.equal(on.calledWith('child_added'), true);
            should.equal(on.calledWith('child_changed'), true);
            should.equal(on.calledWith('child_moved'), true);
            should.equal(on.calledWith('child_removed'), true);
        });

        it('passes through own once() method to SharePoint.on()', () => {
            let instance = new imports.SharePointDataSource('http://somedomain.org/site/List/1');
            let callback = function () {};
            instance.once('value', callback);
            instance.once('child_added', callback);
            instance.once('child_changed', callback);
            instance.once('child_moved', callback);
            instance.once('child_removed', callback);

            let on = instance._dataReference.on;
            on.callCount.should.equal(5);
            should.equal(on.calledWith('value'), true);
            should.equal(on.calledWith('child_added'), true);
            should.equal(on.calledWith('child_changed'), true);
            should.equal(on.calledWith('child_moved'), true);
            should.equal(on.calledWith('child_removed'), true);
        });
    });
});